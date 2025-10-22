/*
 * AST Evaluator for the provided Parser
 * -------------------------------------
 * - Stateful symbol table with auto-vivification: unknown identifiers are created with value 0 on first touch
 * - Full support for:
 *   - Assignment and C-style compound assignments
 *   - Prefix/postfix ++ / --
 *   - Unary, binary (including short-circuit && / ||) and conditional (?:)
 *   - Member access (obj.prop) and array indexing (arr[idx])
 *   - Function calls (normal) and intrinsic evaluation-point calls
 *   - Printf-like expressions
 *   - NEW: Colon selector values (`typedef_name:member` and `typedef_name:member:enum`) via ColonPath nodes
 *
 * Notes
 * -----
 * 1) Member access / array indexing
 *    - On **read**: if the base is not an object/array or the property/index is missing, returns 0.
 *    - On **write** (as an l-value): the base is auto-vivified into an object/array when possible.
 *      For example, assigning into `a.b = 1` will create `a = { b: 1 }` if `a` previously didn't hold an object.
 * 2) Symbols
 *    - Top-level identifiers are stored in a local memory table (Map<string, any>), created lazily with value 0.
 * 3) Intrinsics
 *    - See `IntrinsicHost` interface. Default dummy implementation is provided via `createDefaultIntrinsicHost()`.
 * 4) Types
 *    - This file expects the AST node types from the parser. Adjust the import path as needed.
 */

// Adjust the path to where the parser types live in your project
// If this evaluator is in the same module as your parser, you can remove this import
import type {
    ASTNode,
    NumberLiteral,
    StringLiteral,
    Identifier,
    MemberAccess,
    ArrayIndex,
    UnaryExpression,
    BinaryExpression,
    ConditionalExpression,
    AssignmentExpression,
    UpdateExpression,
    CallExpression,
    EvalPointCall,
    PrintfExpression,
    FormatSegment,
    TextSegment,
    ParseResult,
    // NEW
    ColonPath,
} from './parser';

/* =============================================================================
 * Runtime & Context
 * ============================================================================= */

/** Symbol table / memory. Unknown identifiers are auto-created with value 0. */
export type Memory = Map<string, any>;

export interface IntrinsicHost {
  __CalcMemUsed(ctx: EvalContext, args: any[]): any;
  __FindSymbol(ctx: EvalContext, args: any[]): any;
  __GetRegVal(ctx: EvalContext, args: any[]): any;
  __Offset_of(ctx: EvalContext, args: any[]): any;
  __size_of(ctx: EvalContext, args: any[]): any;
  __Symbol_exists(ctx: EvalContext, args: any[]): any;
}

/** Optional normal (non-intrinsic) functions available to CallExpression. */
export type ExternalFunctions = Record<string, (...args: any[]) => any>;

export interface EvalContextInit {
  memory?: Memory;
  intrinsics?: IntrinsicHost;
  functions?: ExternalFunctions;
}

export class EvalContext {
    readonly memory: Memory;
    readonly intrinsics: IntrinsicHost;
    readonly functions: ExternalFunctions;

    constructor(init: EvalContextInit = {}) {
        this.memory = init.memory ?? new Map<string, any>();
        this.intrinsics = init.intrinsics ?? createDefaultIntrinsicHost();
        this.functions = init.functions ?? Object.create(null);
    }

    /** Ensure a symbol exists; if not, create with value 0. */
    ensureSymbol(name: string): void {
        if (!this.memory.has(name)) this.memory.set(name, 0);
    }

    /** Read a symbol (auto-creates with 0 if unknown). */
    getSymbol(name: string): any {
        this.ensureSymbol(name);
        return this.memory.get(name);
    }

    /** Overwrite a symbol. */
    setSymbol(name: string, value: any): any {
        this.memory.set(name, value);
        return value;
    }
}

export function createDefaultIntrinsicHost(): IntrinsicHost {
    return {
        __CalcMemUsed(ctx: EvalContext, _args: any[]): any {
            // Dummy: count entries and estimate a tiny size per entry
            const entries = ctx.memory.size;
            return entries * 16; // bytes-ish; adapt as needed
        },
        __FindSymbol(ctx: EvalContext, args: any[]): any {
            const [name] = args;
            if (typeof name !== 'string') return 0;
            if (ctx.memory.has(name)) return ctx.memory.get(name);
            // auto-create on first touch, returning 0 per requirement
            ctx.memory.set(name, 0);
            return 0;
        },
        __GetRegVal(_ctx: EvalContext, _args: any[]): any {
            // Dummy: pretend all registers read as 0
            // e.g., args[0] could be a string register name
            return 0;
        },
        __Offset_of(_ctx: EvalContext, args: any[]): any {
            // Expect a symbolic ColonPath value as first argument, but we don't
            // have a real type system here; return 0 as a deterministic stub.
            // Example accepted shapes:
            //  - { __colonPath: ["MyType","field"] }
            //  - { __colonPath: ["MyType","field","EnumVal"] }
            const [ref] = args;
            if (ref && typeof ref === 'object' && Array.isArray((ref as any).__colonPath)) {
                return 0;
            }
            return 0;
        },
        __size_of(_ctx: EvalContext, _args: any[]): any {
            // Dummy: pretend primitive size is 4
            return 4;
        },
        __Symbol_exists(ctx: EvalContext, args: any[]): any {
            const [name] = args;
            if (typeof name !== 'string') return 0;
            return ctx.memory.has(name) ? 1 : 0; // 1/0 for truthiness
        },
    };
}

/* =============================================================================
 * Evaluation
 * ============================================================================= */

type Ref = { get(): any; set(v: any): any };

function isObjectLike(v: any): v is Record<string, any> {
    return typeof v === 'object' && v !== null;
}


function truthy(x: any): boolean {
    return !!x;
}

function asNumber(x: any): number {
    if (typeof x === 'number') return x;
    if (typeof x === 'boolean') return x ? 1 : 0;
    if (typeof x === 'string' && x.trim() !== '') return +x;
    return 0;
}

/** Create an l-value reference for assignments / ++ / --. */
function lref(node: ASTNode, ctx: EvalContext): Ref {
    switch (node.kind) {
        case 'Identifier': {
            const id = node as Identifier;
            ctx.ensureSymbol(id.name);
            return {
                get: () => ctx.getSymbol(id.name),
                set: (v) => ctx.setSymbol(id.name, v),
            };
        }
        case 'MemberAccess': {
            const ma = node as MemberAccess;
            // We allow auto-vivification when used as an l-value: try to create objects along the chain
            // Get a reference to the base object (which itself may be a member/index/identifier)
            const baseRef = lrefable(ma.object)
                ? lref(ma.object as any, ctx)
                : ({
                    get: () => evalNode(ma.object, ctx),
                    set: (_v: any) => {
                        throw new Error('Left side is not assignable (member base).');
                    },
                } satisfies Ref);
            let obj = baseRef.get();
            if (!isObjectLike(obj)) {
                // Auto-vivify base into an object
                obj = {};
                // If base is not actually assignable, this will throw
                baseRef.set(obj);
            }
            const key = ma.property;
            return {
                get: () => (key in obj ? (obj as any)[key] : 0),
                set: (v) => {
                    (obj as any)[key] = v;
                    return v;
                },
            };
        }
        case 'ArrayIndex': {
            const ai = node as ArrayIndex;
            const baseRef = lrefable(ai.array)
                ? lref(ai.array as any, ctx)
                : ({
                    get: () => evalNode(ai.array, ctx),
                    set: (_v: any) => {
                        throw new Error('Left side is not assignable (index base).');
                    },
                } satisfies Ref);
            let base = baseRef.get();
            const indexVal = evalNode(ai.index, ctx);
            const key = isObjectLike(base) ? indexVal : asNumber(indexVal) | 0;
            if (!isObjectLike(base)) {
                // Auto-vivify base into an array if numeric key, otherwise into an object
                base = typeof key === 'number' ? [] : {};
                baseRef.set(base);
            }
            return {
                get: () => {
                    const v = (base as any)[key as any];
                    return v === undefined ? 0 : v;
                },
                set: (v) => ((base as any)[key as any] = v),
            };
        }
        default:
            throw new Error('Invalid assignment target.');
    }
}

function lrefable(node: ASTNode): boolean {
    return (
        node.kind === 'Identifier' ||
        node.kind === 'MemberAccess' ||
        node.kind === 'ArrayIndex'
    );
}

/** Evaluate (read) a node to a value (no reference). */
export function evalNode(node: ASTNode, ctx: EvalContext): any {
    switch (node.kind) {
        case 'NumberLiteral':
            return (node as NumberLiteral).value;
        case 'StringLiteral':
            return (node as StringLiteral).value;
        case 'Identifier': {
            const id = node as Identifier;
            return ctx.getSymbol(id.name);
        }
        case 'MemberAccess': {
            const { object, property } = node as MemberAccess;
            const base = evalNode(object, ctx);
            if (!isObjectLike(base)) return 0;
            const v = (base as any)[property];
            return v === undefined ? 0 : v;
        }
        case 'ArrayIndex': {
            const { array, index } = node as ArrayIndex;
            const base = evalNode(array, ctx);
            const key = isObjectLike(base) ? evalNode(index, ctx) : (asNumber(evalNode(index, ctx)) | 0);
            if (!isObjectLike(base)) return 0;
            const v = (base as any)[key as any];
            return v === undefined ? 0 : v;
        }
        case 'ColonPath': {
            const cp = node as ColonPath;
            // Return a symbolic value that intrinsics (e.g., __Offset_of) can interpret.
            // If user code treats it as a plain value elsewhere, coerce to 0 as needed.
            return { __colonPath: cp.parts.slice() };
        }
        case 'UnaryExpression': {
            const u = node as UnaryExpression;
            const v = evalNode(u.argument, ctx);
            switch (u.operator) {
                case '+':
                    return +asNumber(v);
                case '-':
                    return -asNumber(v);
                case '!':
                    return !truthy(v);
                case '~':
                    return (~(asNumber(v) | 0)) >>> 0;
                default:
                    throw new Error(`Unsupported unary operator ${u.operator}`);
            }
        }
        case 'UpdateExpression': {
            const u = node as UpdateExpression;
            const ref = lref(u.argument, ctx);
            const prev = asNumber(ref.get());
            const next = u.operator === '++' ? prev + 1 : prev - 1;
            ref.set(next);
            return u.prefix ? next : prev;
        }
        case 'BinaryExpression':
            return evalBinary(node as BinaryExpression, ctx);
        case 'ConditionalExpression': {
            const c = node as ConditionalExpression;
            const t = truthy(evalNode(c.test, ctx));
            return t ? evalNode(c.consequent, ctx) : evalNode(c.alternate, ctx);
        }
        case 'AssignmentExpression': {
            const a = node as AssignmentExpression;
            const ref = lref(a.left, ctx);
            if (a.operator === '=') {
                const val = evalNode(a.right, ctx);
                return ref.set(val);
            }
            // compound
            const leftVal = evalNode(a.left, ctx);
            const rightVal = evalNode(a.right, ctx);
            let result: any;
            switch (a.operator) {
                case '+=':
                    result = asNumber(leftVal) + asNumber(rightVal);
                    break;
                case '-=':
                    result = asNumber(leftVal) - asNumber(rightVal);
                    break;
                case '*=':
                    result = asNumber(leftVal) * asNumber(rightVal);
                    break;
                case '/=': {
                    const b = asNumber(rightVal);
                    if (b === 0) throw new Error('Division by zero');
                    result = asNumber(leftVal) / b;
                    break;
                }
                case '%=':
                    result = (asNumber(leftVal) | 0) % (asNumber(rightVal) | 0);
                    break;
                case '<<=':
                    result = ((asNumber(leftVal) | 0) << (asNumber(rightVal) & 31)) >>> 0;
                    break;
                case '>>=':
                    result = ((asNumber(leftVal) | 0) >> (asNumber(rightVal) & 31)) >>> 0;
                    break;
                case '&=':
                    result = ((asNumber(leftVal) | 0) & (asNumber(rightVal) | 0)) >>> 0;
                    break;
                case '^=':
                    result = ((asNumber(leftVal) | 0) ^ (asNumber(rightVal) | 0)) >>> 0;
                    break;
                case '|=':
                    result = ((asNumber(leftVal) | 0) | (asNumber(rightVal) | 0)) >>> 0;
                    break;
                default:
                    throw new Error(`Unsupported assignment operator ${a.operator}`);
            }
            return ref.set(result);
        }
        case 'CallExpression': {
            const c = node as CallExpression;
            // Resolve callee value (function) and evaluate arguments
            const fnVal = evalNode(c.callee, ctx);
            const args = c.args.map((a) => evalNode(a, ctx));
            if (typeof fnVal === 'function') return fnVal(...args);
            // If callee was an identifier and a named external function exists, call it
            if (c.callee.kind === 'Identifier') {
                const name = (c.callee as Identifier).name;
                const ext = ctx.functions[name];
                if (typeof ext === 'function') return ext(...args);
            }
            throw new Error('Callee is not callable.');
        }
        case 'EvalPointCall': {
            const c = node as EvalPointCall;
            const name = c.intrinsic as keyof IntrinsicHost;
            const args = c.args.map((a) => evalNode(a, ctx));
            const fn = ctx.intrinsics[name];
            if (typeof fn !== 'function') throw new Error(`Missing intrinsic ${name}`);
            return fn(ctx, args);
        }
        case 'PrintfExpression':
            return evalPrintf(node as PrintfExpression, ctx);
        case 'TextSegment':
            return (node as TextSegment).text;
        case 'FormatSegment':
            // Normally these exist only inside PrintfExpression; handle for completeness
            return formatValue((node as FormatSegment).spec, evalNode((node as FormatSegment).value, ctx));
        case 'ErrorNode':
            throw new Error('Cannot evaluate an ErrorNode.');
        default:
            throw new Error(`Unhandled node kind: ${(node as any).kind}`);
    }
}

function evalBinary(node: BinaryExpression, ctx: EvalContext): any {
    const { operator, left, right } = node;

    if (operator === '&&') {
        const lv = evalNode(left, ctx);
        return truthy(lv) ? evalNode(right, ctx) : lv; // short-circuit
    }
    if (operator === '||') {
        const lv = evalNode(left, ctx);
        return truthy(lv) ? lv : evalNode(right, ctx); // short-circuit
    }

    // For all other binary ops, evaluate both sides
    const a = evalNode(left, ctx);
    const b = evalNode(right, ctx);

    switch (operator) {
        case '+':
            // Allow string concatenation if either side is string
            if (typeof a === 'string' || typeof b === 'string') return String(a) + String(b);
            return asNumber(a) + asNumber(b);
        case '-':
            return asNumber(a) - asNumber(b);
        case '*':
            return asNumber(a) * asNumber(b);
        case '/': {
            const bb = asNumber(b);
            if (bb === 0) throw new Error('Division by zero');
            return asNumber(a) / bb;
        }
        case '%':
            return (asNumber(a) | 0) % (asNumber(b) | 0);
        case '<<':
            return ((asNumber(a) | 0) << (asNumber(b) & 31)) >>> 0;
        case '>>':
            return ((asNumber(a) | 0) >> (asNumber(b) & 31)) >>> 0;
        case '>>>':
            return (asNumber(a) >>> (asNumber(b) & 31)) >>> 0;
        case '&':
            return ((asNumber(a) | 0) & (asNumber(b) | 0)) >>> 0;
        case '^':
            return ((asNumber(a) | 0) ^ (asNumber(b) | 0)) >>> 0;
        case '|':
            return ((asNumber(a) | 0) | (asNumber(b) | 0)) >>> 0;
        case '==':
            return (asNumber(a) == asNumber(b)) || (typeof a === 'string' && typeof b === 'string' && a === b);
        case '!=':
            return !(((asNumber(a) == asNumber(b)) || (typeof a === 'string' && typeof b === 'string' && a === b)));
        case '<':
            return asNumber(a) < asNumber(b);
        case '<=':
            return asNumber(a) <= asNumber(b);
        case '>':
            return asNumber(a) > asNumber(b);
        case '>=':
            return asNumber(a) >= asNumber(b);
        default:
            throw new Error(`Unsupported binary operator ${operator}`);
    }
}

/* =============================================================================
 * Printf-like evaluation
 * ============================================================================= */

function evalPrintf(node: PrintfExpression, ctx: EvalContext): string {
    let out = '';
    for (const seg of node.segments) {
        if (seg.kind === 'TextSegment') {
            out += seg.text;
        } else {
            const fs = seg as FormatSegment;
            const v = evalNode(fs.value, ctx);
            out += formatValue(fs.spec, v);
        }
    }
    return out;
}

function formatValue(spec: FormatSegment['spec'], v: any): string {
    switch (spec) {
        case 'd': // signed decimal
            return String((asNumber(v) | 0));
        case 'u': // unsigned decimal
            return String((asNumber(v) >>> 0));
        case 'x': // hex (lowercase)
            return (asNumber(v) >>> 0).toString(16);
        case 't': // boolean text
            return truthy(v) ? 'true' : 'false';
        case 'S': // string
            return typeof v === 'string' ? v : String(v);
            // The rest are domain-specific; keep simple placeholders as a starting point
        case 'C':
        case 'E':
        case 'I':
        case 'J':
        case 'N':
        case 'M':
        case 'T':
        case 'U':
            return String(v);
        case '%': // not normally produced (%% handled as a TextSegment '%')
            return '%';
        default:
            return String(v);
    }
}

/* =============================================================================
 * Convenience API
 * ============================================================================= */

/** Evaluate a ParseResult from the parser. */
export function evaluateParseResult(pr: ParseResult, ctx = new EvalContext()): any {
    try {
        if (pr.isPrintf) {
            return evalNode(pr.ast, ctx); // returns string
        }
        return evalNode(pr.ast, ctx);
    } catch (e) {
        console.error('Expression AST Evaluation error:', e);
        return undefined;
    }
}

/** One-shot helper: parse then evaluate. Adjust import for your parser singleton. */
// import { defaultParser } from "./parser";
// export function evaluateExpression(expr: string, ctx = new EvalContext()): any {
//   const pr = defaultParser.parse(expr);
//   return evaluateParseResult(pr, ctx);
// }

/* =============================================================================
 * Minimal self-test (commented)
 * ============================================================================= */

// const ctx = new EvalContext();
// ctx.setSymbol("x", 10);
// ctx.setSymbol("obj", { a: 1, arr: [7, 8] });
//
// // Example usages (assuming you have defaultParser imported):
// const r1 = evaluateExpression("x += 5", ctx); // 15
// const r2 = evaluateExpression("++x", ctx);    // 16 (x now 16)
// const r3 = evaluateExpression("obj.a += obj.arr[0]", ctx); // 8
// const r4 = evaluateExpression("%d[ x ] and %x[ 255 ]", ctx); // printf-like → "16 and ff"
// const r5 = evaluateExpression("__Offset_of(T:field)", ctx); // uses ColonPath symbolic arg → 0 (stub)
//
// console.log({ r1, r2, r3, r4, r5, mem: Object.fromEntries(ctx.memory) });
