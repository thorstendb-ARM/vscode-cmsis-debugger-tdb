/*
 * AST Evaluator for the provided Parser (typed variables edition)
 * -----------------------------------------------------------------
 * - Stateful symbol table with optional per-symbol C-like data types
 * - Auto-vivification: unknown identifiers are created with value 0 on first touch
 * - Supports:
 *   - Assignment and C-style compound assignments
 *   - Prefix/postfix ++ / --
 *   - Unary, binary (incl. short-circuit && / ||) and conditional (?:)
 *   - Member access (obj.prop) and array indexing (arr[idx])
 *   - Function calls and intrinsic evaluation-point calls
 *   - Printf-like expressions
 *   - ColonPath symbolic values (typedef_name:member[:enum])
 *
 *  NEW in this version
 *  -------------------
 *  Typed variables with the following data types:
 *    - uint8_t,  int8_t
 *    - uint16_t, int16_t
 *    - uint32_t, int32_t
 *    - uint64_t, int64_t   (backed by BigInt)
 *    - float (32-bit, uses Math.fround), double (64-bit JS number)
 *
 *  Semantics
 *  ---------
 *  • Storage type is enforced on writes via ctx.setSymbol() and on reads via ctx.getSymbol().
 *  • Intermediate arithmetic uses JS numbers, except if any operand is a BigInt (64-bit values),
 *    in which case the operation runs in BigInt and yields a BigInt result.
 *  • Compound assignments and ++/-- wrap correctly because they route through setSymbol().
 *  • You can declare a variable type with ctx.setType(name, CTypeName) or ctx.define(name, type, init?).
 */

// Adjust the path to where the parser types live in your project
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
    ColonPath,
} from './parser';

/* =============================================================================
 * Types & Runtime Context
 * ============================================================================= */

/** Symbol table / memory. Unknown identifiers are auto-created with value 0. */
export type Memory = Map<string, any>;

// Result type for evaluation helpers
export type EvaluateResult = number | string | undefined;

export type CTypeName =
  | 'uint8_t' | 'int8_t'
  | 'uint16_t' | 'int16_t'
  | 'uint32_t' | 'int32_t'
  | 'uint64_t' | 'int64_t'
  | 'float' | 'double';

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
  /** Optional hook to customize printf (%C %E %I %J %N %M %S %T %U) formatting. */
  printf?: {
    /**
     * If you return a string, it is used as the formatted value.
     * Return undefined to fall back to the evaluator’s default formatting.
     */
    format?: (spec: FormatSegment['spec'], value: any, ctx: EvalContext) => string | undefined;
  };
}

export class EvalContext {
    readonly memory: Memory;
    readonly intrinsics: IntrinsicHost;
    readonly functions: ExternalFunctions;
    readonly printf: NonNullable<EvalContextInit['printf']>;

    /** Optional per-symbol type map. */
    readonly types = new Map<string, CTypeName>();

    constructor(init: EvalContextInit = {}) {
        this.memory = init.memory ?? new Map<string, any>();
        this.intrinsics = init.intrinsics ?? createDefaultIntrinsicHost();
        this.functions = init.functions ?? Object.create(null);
        this.printf = init.printf ?? {};
    }

    /** Define or change a variable's type (does not change existing value). */
    setType(name: string, type: CTypeName): void { this.types.set(name, type); }
    getType(name: string): CTypeName | undefined { return this.types.get(name); }

    /** Define a typed variable, optionally with an initial value (coerced). */
    define(name: string, type: CTypeName, initial?: any): void {
        this.setType(name, type);
        if (initial !== undefined) this.setSymbol(name, initial); else this.ensureSymbol(name);
    }

    /** Ensure a symbol exists; if not, create with value 0 (coerced to type if present). */
    ensureSymbol(name: string): void {
        if (!this.memory.has(name)) {
            const t = this.types.get(name);
            const v = t ? coerceOnWrite(0, t) : 0;
            this.memory.set(name, v);
        }
    }

    /** Read a symbol (auto-creates with 0 if unknown). */
    getSymbol(name: string): any {
        this.ensureSymbol(name);
        const v = this.memory.get(name);
        return coerceOnRead(v, this.types.get(name));
    }

    /** Overwrite a symbol (value is coerced to the variable's declared type, if any). */
    setSymbol(name: string, value: any): any {
        const t = this.types.get(name);
        const coerced = t ? coerceOnWrite(value, t) : value;
        this.memory.set(name, coerced);
        return coerced;
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
            return 0;
        },
        __Offset_of(_ctx: EvalContext, _args: any[]): any {
            // No real type model here; accept ColonPath-shaped objects and return 0.
            return 0;
        },
        __size_of(_ctx: EvalContext, args: any[]): any {
            // If given a known C type name (string), return its size in bytes; otherwise 4.
            const [arg0] = args;
            if (typeof arg0 === 'string') {
                const sz = sizeOfTypeName(arg0 as CTypeName | string);
                if (sz !== undefined) return sz;
            }
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
 * Numeric helpers & type coercion
 * ============================================================================= */

const U8_MASK  = 0xFF;
const U16_MASK = 0xFFFF;
const U64_MASK = (1n << 64n) - 1n;
const I64_SIGN = 1n << 63n;

function truthy(x: any): boolean { return !!x; }

function asNumber(x: any): number {
    if (typeof x === 'number') return Number.isFinite(x) ? x : 0;
    if (typeof x === 'boolean') return x ? 1 : 0;
    if (typeof x === 'bigint') return Number(x); // lossy, avoid where precision matters
    if (typeof x === 'string' && x.trim() !== '') {
        const n = +x; return Number.isFinite(n) ? n : 0;
    }
    return 0;
}

function toBigInt(x: any): bigint {
    if (typeof x === 'bigint') return x;
    if (typeof x === 'number') return BigInt(Number.isFinite(x) ? Math.trunc(x) : 0);
    if (typeof x === 'boolean') return x ? 1n : 0n;
    if (typeof x === 'string' && x.trim() !== '') {
        try { return BigInt(x); } catch { return BigInt(Math.trunc(+x) || 0); }
    }
    return 0n;
}

// Integer coercions (<=32-bit use JS number; 64-bit use BigInt)
function toU8(n: any): number { return (asNumber(n) & U8_MASK) >>> 0; }
function toS8(n: any): number { const u = toU8(n);  return (u & 0x80) ? u - 0x100 : u; }
function toU16(n: any): number { return (asNumber(n) & U16_MASK) >>> 0; }
function toS16(n: any): number { const u = toU16(n); return (u & 0x8000) ? u - 0x10000 : u; }
function toU32(n: any): number { return (asNumber(n) >>> 0); }
function toS32(n: any): number { return (asNumber(n) | 0); }

function toU64(n: any): bigint { return toBigInt(n) & U64_MASK; }
function toI64(n: any): bigint { const u = toBigInt(n) & U64_MASK; return (u & I64_SIGN) ? (u - (1n << 64n)) : u; }

function toF32(n: any): number { return Math.fround(asNumber(n)); }
function toF64(n: any): number { return asNumber(n); }

function coerceOnWrite(v: any, t?: CTypeName): any {
    if (!t) return v;
    switch (t) {
        case 'uint8_t':  return toU8(v);
        case 'int8_t':   return toS8(v);
        case 'uint16_t': return toU16(v);
        case 'int16_t':  return toS16(v);
        case 'uint32_t': return toU32(v);
        case 'int32_t':  return toS32(v);
        case 'uint64_t': return toU64(v);
        case 'int64_t':  return toI64(v);
        case 'float':    return toF32(v);
        case 'double':   return toF64(v);
    }
}

function coerceOnRead(v: any, t?: CTypeName): any {
    if (!t) return v;
    // Re-apply the same coercion to keep invariant even if memory was mutated externally
    return coerceOnWrite(v, t);
}

function sizeOfTypeName(name: CTypeName | string): number | undefined {
    switch (name) {
        case 'uint8_t': case 'int8_t': return 1;
        case 'uint16_t': case 'int16_t': return 2;
        case 'uint32_t': case 'int32_t': case 'float': return 4;
        case 'uint64_t': case 'int64_t': case 'double': return 8;
        default: return undefined;
    }
}

/* =============================================================================
 * Evaluation
 * ============================================================================= */

type Ref = { get(): any; set(v: any): any };

function isObjectLike(v: any): v is Record<string, any> {
    return typeof v === 'object' && v !== null;
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
            const baseRef = lrefable(ma.object)
                ? lref(ma.object as any, ctx)
                : ({
                    get: () => evalNode(ma.object, ctx),
                    set: (_v: any) => { throw new Error('Left side is not assignable (member base).'); },
                } satisfies Ref);
            let obj = baseRef.get();
            if (!isObjectLike(obj)) { obj = {}; baseRef.set(obj); }
            const key = ma.property;
            return {
                get: () => (key in obj ? (obj as any)[key] : 0),
                set: (v) => ((obj as any)[key] = v),
            };
        }
        case 'ArrayIndex': {
            const ai = node as ArrayIndex;
            const baseRef = lrefable(ai.array)
                ? lref(ai.array as any, ctx)
                : ({
                    get: () => evalNode(ai.array, ctx),
                    set: (_v: any) => { throw new Error('Left side is not assignable (index base).'); },
                } satisfies Ref);
            let base = baseRef.get();
            const indexVal = evalNode(ai.index, ctx);
            const key = isObjectLike(base) ? indexVal : (asNumber(indexVal) | 0);
            if (!isObjectLike(base)) {
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
    return node.kind === 'Identifier' || node.kind === 'MemberAccess' || node.kind === 'ArrayIndex';
}

/** BigInt-aware arithmetic helpers used by evalBinary and compound assignments */
function addVals(a: any, b: any): any {
    if (typeof a === 'string' || typeof b === 'string') return String(a) + String(b);
    if (typeof a === 'bigint' || typeof b === 'bigint') return toBigInt(a) + toBigInt(b);
    return asNumber(a) + asNumber(b);
}
function subVals(a: any, b: any): any {
    if (typeof a === 'bigint' || typeof b === 'bigint') return toBigInt(a) - toBigInt(b);
    return asNumber(a) - asNumber(b);
}
function mulVals(a: any, b: any): any {
    if (typeof a === 'bigint' || typeof b === 'bigint') return toBigInt(a) * toBigInt(b);
    return asNumber(a) * asNumber(b);
}
function divVals(a: any, b: any): any {
    if (typeof a === 'bigint' || typeof b === 'bigint') {
        const bb = toBigInt(b); if (bb === 0n) throw new Error('Division by zero');
        const aa = toBigInt(a);
        return aa / bb; // BigInt division truncates toward 0
    }
    const nb = asNumber(b); if (nb === 0) throw new Error('Division by zero');
    return asNumber(a) / nb;
}
function modVals(a: any, b: any): any {
    if (typeof a === 'bigint' || typeof b === 'bigint') {
        const bb = toBigInt(b); if (bb === 0n) throw new Error('Division by zero');
        return toBigInt(a) % bb;
    }
    return (asNumber(a) | 0) % (asNumber(b) | 0);
}
function andVals(a: any, b: any): any { return (typeof a === 'bigint' || typeof b === 'bigint') ? (toBigInt(a) & toBigInt(b)) : (((asNumber(a)|0) & (asNumber(b)|0)) >>> 0); }
function xorVals(a: any, b: any): any { return (typeof a === 'bigint' || typeof b === 'bigint') ? (toBigInt(a) ^ toBigInt(b)) : (((asNumber(a)|0) ^ (asNumber(b)|0)) >>> 0); }
function orVals (a: any, b: any): any { return (typeof a === 'bigint' || typeof b === 'bigint') ? (toBigInt(a) | toBigInt(b)) : (((asNumber(a)|0) | (asNumber(b)|0)) >>> 0); }
function shlVals(a: any, b: any): any { return (typeof a === 'bigint' || typeof b === 'bigint') ? (toBigInt(a) << toBigInt(b)) : (((asNumber(a)|0) << (asNumber(b)&31)) >>> 0); }
function sarVals(a: any, b: any): any { return (typeof a === 'bigint' || typeof b === 'bigint') ? (toBigInt(a) >> toBigInt(b)) : (((asNumber(a)|0) >> (asNumber(b)&31)) >>> 0); }
function shrVals(a: any, b: any): any {
    // Logical right shift. For BigInt emulate 64-bit logical: (a & U64) >> b
    if (typeof a === 'bigint' || typeof b === 'bigint') {
        const aa = toBigInt(a) & U64_MASK; const bb = toBigInt(b);
        return (aa >> bb) & U64_MASK;
    }
    return (asNumber(a) >>> (asNumber(b) & 31)) >>> 0;
}

function eqVals(a: any, b: any): boolean {
    if (typeof a === 'string' || typeof b === 'string') return String(a) === String(b);
    if (typeof a === 'bigint' || typeof b === 'bigint') return toBigInt(a) === toBigInt(b);
    return asNumber(a) == asNumber(b);
}
function ltVals(a: any, b: any): boolean {
    if (typeof a === 'bigint' || typeof b === 'bigint') return toBigInt(a) < toBigInt(b);
    return asNumber(a) < asNumber(b);
}
function lteVals(a: any, b: any): boolean {
    if (typeof a === 'bigint' || typeof b === 'bigint') return toBigInt(a) <= toBigInt(b);
    return asNumber(a) <= asNumber(b);
}
function gtVals(a: any, b: any): boolean {
    if (typeof a === 'bigint' || typeof b === 'bigint') return toBigInt(a) > toBigInt(b);
    return asNumber(a) > asNumber(b);
}
function gteVals(a: any, b: any): boolean {
    if (typeof a === 'bigint' || typeof b === 'bigint') return toBigInt(a) >= toBigInt(b);
    return asNumber(a) >= asNumber(b);
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
            return { __colonPath: cp.parts.slice() };
        }
        case 'UnaryExpression': {
            const u = node as UnaryExpression;
            const v = evalNode(u.argument, ctx);
            switch (u.operator) {
                case '+':
                    if (typeof v === 'bigint') return v; // preserve 64-bit
                    return +asNumber(v);
                case '-':
                    return (typeof v === 'bigint') ? (-toBigInt(v)) : (-asNumber(v));
                case '!':
                    return !truthy(v);
                case '~':
                    return (typeof v === 'bigint') ? (~toBigInt(v)) : ((~(asNumber(v) | 0)) >>> 0);
                default:
                    throw new Error(`Unsupported unary operator ${u.operator}`);
            }
        }
        case 'UpdateExpression': {
            const u = node as UpdateExpression;
            const ref = lref(u.argument, ctx);
            const prev = ref.get();
            const next = (typeof prev === 'bigint')
                ? (u.operator === '++' ? (toBigInt(prev) + 1n) : (toBigInt(prev) - 1n))
                : (u.operator === '++' ? asNumber(prev) + 1 : asNumber(prev) - 1);
            ref.set(next);
            return u.prefix ? ref.get() : prev;
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
            // compound: compute from current left value and RHS value
            const leftVal = evalNode(a.left, ctx);
            const rightVal = evalNode(a.right, ctx);
            let result: any;
            switch (a.operator) {
                case '+=': result = addVals(leftVal, rightVal); break;
                case '-=': result = subVals(leftVal, rightVal); break;
                case '*=': result = mulVals(leftVal, rightVal); break;
                case '/=': result = divVals(leftVal, rightVal); break;
                case '%=': result = modVals(leftVal, rightVal); break;
                case '<<=': result = shlVals(leftVal, rightVal); break;
                case '>>=': result = sarVals(leftVal, rightVal); break;
                case '&=': result = andVals(leftVal, rightVal); break;
                case '^=': result = xorVals(leftVal, rightVal); break;
                case '|=': result = orVals(leftVal, rightVal); break;
                default:
                    throw new Error(`Unsupported assignment operator ${a.operator}`);
            }
            return ref.set(result);
        }
        case 'CallExpression': {
            const c = node as CallExpression;
            const fnVal = evalNode(c.callee, ctx);
            const args = c.args.map((a) => evalNode(a, ctx));
            if (typeof fnVal === 'function') return fnVal(...args);
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
            return formatValue(
                (node as FormatSegment).spec,
                evalNode((node as FormatSegment).value, ctx),
                ctx
            );
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

    const a = evalNode(left, ctx);
    const b = evalNode(right, ctx);

    switch (operator) {
        case '+': return addVals(a, b);
        case '-': return subVals(a, b);
        case '*': return mulVals(a, b);
        case '/': return divVals(a, b);
        case '%': return modVals(a, b);
        case '<<': return shlVals(a, b);
        case '>>': return sarVals(a, b);
        case '>>>': return shrVals(a, b);
        case '&': return andVals(a, b);
        case '^': return xorVals(a, b);
        case '|': return orVals(a, b);
        case '==': return eqVals(a, b);
        case '!=': return !eqVals(a, b);
        case '<': return ltVals(a, b);
        case '<=': return lteVals(a, b);
        case '>': return gtVals(a, b);
        case '>=': return gteVals(a, b);
        default:
            throw new Error(`Unsupported binary operator ${operator}`);
    }
}

/* =============================================================================
 * Printf-like evaluation
 * ============================================================================= */

function evalPrintf(node: PrintfExpression, _ctx: EvalContext): string {
    let out = '';
    for (const seg of node.segments) {
        if (seg.kind === 'TextSegment') {
            out += seg.text;
        } else {
            const fs = seg as FormatSegment;
            const v = evalNode(fs.value as any, _ctx as any);
            out += formatValue(fs.spec, v, _ctx);
        }
    }
    return out;
}

function formatValue(spec: FormatSegment['spec'], v: any, ctx?: EvalContext): string {
    // Allow host to override any spec (commonly the domain-specific ones).
    if (ctx?.printf?.format) {
        const override = ctx.printf.format(spec, v, ctx);
        if (typeof override === 'string') return override;
    }
    switch (spec) {
        case 'd': // signed decimal
            if (typeof v === 'bigint') return v.toString(10);
            return String((asNumber(v) | 0));
        case 'u': { // unsigned decimal
            if (typeof v === 'bigint') return (v & U64_MASK).toString(10);
            return String((asNumber(v) >>> 0));
        }
        case 'x': // hex (lowercase)
            if (typeof v === 'bigint') return (v & U64_MASK).toString(16);
            return (asNumber(v) >>> 0).toString(16);
        case 't': // boolean text
            return truthy(v) ? 'true' : 'false';
        case 'S': // string
            return typeof v === 'string' ? v : String(v);
        // Domain-specific placeholders
        case 'C': case 'E': case 'I': case 'J': case 'N': case 'M': case 'T': case 'U':
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
function normalizeEvaluateResult(v: any): EvaluateResult {
    if (v === undefined || v === null) return undefined;
    if (typeof v === 'number' || typeof v === 'string') return v;
    if (typeof v === 'bigint') return v.toString(10);
    if (typeof v === 'boolean') return v ? 1 : 0;
    return undefined; // objects, arrays, etc.
}

export function evaluateParseResult(pr: ParseResult, ctx = new EvalContext()): EvaluateResult {
    try {
        const v = evalNode(pr.ast, ctx);
        return normalizeEvaluateResult(v);
    } catch (e) {
        console.error('Expression AST Evaluation error:', e);
        return undefined;
    }
}

/* =============================================================================
 * Example usage (commented)
 * ============================================================================= */

// const ctx = new EvalContext();
// ctx.define('u8', 'uint8_t', 300);  // stored as 44
// ctx.define('i8', 'int8_t', 130);   // stored as -126
// ctx.define('u64', 'uint64_t', -1); // stored as 0xFFFF_FFFF_FFFF_FFFFn
// ctx.define('f', 'float', 3.14159); // 3.141590118...
//
// // After parsing: const pr = defaultParser.parse("u64 + 5");
// // evaluateParseResult(pr, ctx);
