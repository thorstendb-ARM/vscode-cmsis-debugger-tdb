// evaluator.ts — cleaned, host-adaptable

// If you have parser node types, keep this import; otherwise you can remove it
// and treat AST nodes as `any`.
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
 * Public API (minimal)
 * ============================================================================= */

export type EvaluateResult = number | string | undefined;

/** Optional C-like names for size queries (kept small) */
export type CTypeName =
  | 'uint8_t' | 'int8_t'
  | 'uint16_t' | 'int16_t'
  | 'uint32_t' | 'int32_t'
  | 'uint64_t' | 'int64_t'
  | 'float' | 'double';

export type ExternalFunctions = Record<string, (...args: any[]) => any>;

/** Host interface: evaluator routes all reads/writes through here. */
export interface DataHost {
  // Symbols (top-level identifiers)
  hasSymbol(name: string): boolean;
  readSymbol(name: string): any | undefined;
  writeSymbol(name: string, value: any): any;

  // Containers
  isContainer(v: any): boolean;
  isArray(v: any): boolean;
  makeObject(): any;
  makeArray(): any;

  // Generic key access (.prop and [key])
  readKey(container: any, key: any): any | undefined;
  writeKey(container: any, key: any, value: any): any;

  // Optional: advanced lookups
  resolveColonPath?(parts: string[]): any;

  // Optional: stats
  stats?(): { symbols?: number; bytesUsed?: number };
}

/** Intrinsics available to EvalPointCall nodes (minimal) */
export interface IntrinsicHost {
  __CalcMemUsed(ctx: EvalContext, args: any[]): any;
  __FindSymbol(ctx: EvalContext, args: any[]): any;
  __GetRegVal(ctx: EvalContext, args: any[]): any;
  __size_of(ctx: EvalContext, args: any[]): any;
  __Symbol_exists(ctx: EvalContext, args: any[]): any;
  __Offset_of(_ctx: EvalContext, args: any[]): any;
}

export interface EvalContextInit {
  data: DataHost;                 // your ScvdBase instance goes here
  intrinsics: IntrinsicHost;      // override if you need
  printf: {
    format?: (spec: FormatSegment['spec'], value: any, ctx: EvalContext) => string | undefined;
  };
  functions?: ExternalFunctions;   // callables referenced by Identifier()
}

/* =============================================================================
 * Eval context
 * ============================================================================= */

export class EvalContext {
    readonly data: DataHost;
    readonly intrinsics: IntrinsicHost;
    readonly functions: ExternalFunctions;
    readonly printf: NonNullable<EvalContextInit['printf']>;

    constructor(init: EvalContextInit) {
        this.data = init.data;
        this.intrinsics = init.intrinsics ?? createDefaultIntrinsicHost();
        // If your DataHost (ScvdEvalInterface) has a .functions table, use it by default.
        const hostFns = (this.data as any)?.functions as ExternalFunctions | undefined;
        this.functions = init.functions ?? hostFns ?? Object.create(null);
        this.printf = init.printf ?? {};
    }

    /** Ensure a symbol exists; create as 0 if missing. */
    ensureSymbol(name: string): void {
        if (!this.data.hasSymbol(name)) this.data.writeSymbol(name, 0);
    }
    /** Read a symbol (auto-create with 0 if unknown). */
    getSymbol(name: string): any {
        this.ensureSymbol(name);
        const v = this.data.readSymbol(name);
        return v === undefined ? 0 : v;
    }
    /** Overwrite a symbol. */
    setSymbol(name: string, value: any): any {
        return this.data.writeSymbol(name, value);
    }
}

/* =============================================================================
 * Default intrinsics (minimal, model-aware where possible)
 * ============================================================================= */

export function createDefaultIntrinsicHost(): IntrinsicHost {
    return {
        __CalcMemUsed(ctx) {
            const s = ctx.data.stats?.();
            if (s?.bytesUsed != null) return s.bytesUsed;
            if (s?.symbols != null) return s.symbols * 16;
            return 0;
        },
        __FindSymbol(ctx, args) {
            const [name] = args;
            if (typeof name !== 'string') return 0;
            if (ctx.data.hasSymbol(name)) return ctx.getSymbol(name);
            ctx.ensureSymbol(name);
            return ctx.getSymbol(name);
        },
        __GetRegVal(ctx, args) {
            const [regName] = args;
            if (typeof regName !== 'string') return 0;
            const r = (ctx.data as any).resolveColonPath?.(['reg', regName]);
            return r ?? 0;
        },
        __size_of(_ctx, args) {
            const [arg0] = args;
            if (typeof arg0 === 'string') {
                const sz = sizeOfTypeName(arg0 as CTypeName | string);
                if (sz !== undefined) return sz;
            }
            return 4;
        },
        __Symbol_exists(ctx, args) {
            const [name] = args;
            if (typeof name !== 'string') return 0;
            return ctx.data.hasSymbol(name) ? 1 : 0;
        },
        __Offset_of(_ctx: EvalContext, _args: any[]): any {
            // Domain-specific in real systems; here accept ColonPath-like or strings and return 0.
            return 0;
        },
    };
}

/* =============================================================================
 * Numeric helpers (BigInt-aware where needed)
 * ============================================================================= */

const U64_MASK = (1n << 64n) - 1n;

function truthy(x: any): boolean { return !!x; }

function asNumber(x: any): number {
    if (typeof x === 'number') return Number.isFinite(x) ? x : 0;
    if (typeof x === 'boolean') return x ? 1 : 0;
    if (typeof x === 'bigint') return Number(x);
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

// BigInt-aware ops
function addVals(a: any, b: any): any {
    if (typeof a === 'string' || typeof b === 'string') return String(a) + String(b);
    if (typeof a === 'bigint' || typeof b === 'bigint') return toBigInt(a) + toBigInt(b);
    return asNumber(a) + asNumber(b);
}
function subVals(a: any, b: any): any { return (typeof a === 'bigint' || typeof b === 'bigint') ? (toBigInt(a) - toBigInt(b)) : (asNumber(a) - asNumber(b)); }
function mulVals(a: any, b: any): any { return (typeof a === 'bigint' || typeof b === 'bigint') ? (toBigInt(a) * toBigInt(b)) : (asNumber(a) * asNumber(b)); }
function divVals(a: any, b: any): any {
    if (typeof a === 'bigint' || typeof b === 'bigint') {
        const bb = toBigInt(b); if (bb === 0n) throw new Error('Division by zero');
        return toBigInt(a) / bb;
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
function ltVals(a: any, b: any): boolean { return (typeof a === 'bigint' || typeof b === 'bigint') ? (toBigInt(a) <  toBigInt(b)) : (asNumber(a) <  asNumber(b)); }
function lteVals(a: any, b: any): boolean { return (typeof a === 'bigint' || typeof b === 'bigint') ? (toBigInt(a) <= toBigInt(b)) : (asNumber(a) <= asNumber(b)); }
function gtVals(a: any, b: any): boolean { return (typeof a === 'bigint' || typeof b === 'bigint') ? (toBigInt(a) >  toBigInt(b)) : (asNumber(a) >  asNumber(b)); }
function gteVals(a: any, b: any): boolean { return (typeof a === 'bigint' || typeof b === 'bigint') ? (toBigInt(a) >= toBigInt(b)) : (asNumber(a) >= asNumber(b)); }

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

function lref(node: ASTNode, ctx: EvalContext): Ref {
    switch (node.kind) {
        case 'Identifier': {
            const id = node as Identifier;
            ctx.ensureSymbol(id.name);
            return { get: () => ctx.getSymbol(id.name), set: (v) => ctx.setSymbol(id.name, v) };
        }

        case 'MemberAccess': {
            const ma = node as MemberAccess;
            const baseRef = lrefable(ma.object)
                ? lref(ma.object as any, ctx)
                : ({ get: () => evalNode(ma.object, ctx), set: () => { throw new Error('Left side is not assignable (member base).'); } } as Ref);

            return {
                get: () => {
                    const base = baseRef.get();
                    if (!ctx.data.isContainer(base)) return 0;
                    const v = ctx.data.readKey(base, ma.property);
                    return v === undefined ? 0 : v;
                },
                set: (val) => {
                    let base = baseRef.get();
                    if (!ctx.data.isContainer(base)) {
                        base = ctx.data.makeObject();
                        baseRef.set(base);
                    }
                    return ctx.data.writeKey(base, ma.property, val);
                },
            };
        }

        case 'ArrayIndex': {
            const ai = node as ArrayIndex;
            const baseRef = lrefable(ai.array)
                ? lref(ai.array as any, ctx)
                : ({ get: () => evalNode(ai.array, ctx), set: () => { throw new Error('Left side is not assignable (index base).'); } } as Ref);

            return {
                get: () => {
                    const base = baseRef.get();
                    if (!ctx.data.isContainer(base)) return 0;
                    const idxVal = evalNode(ai.index, ctx);
                    const key = ctx.data.isArray(base) ? (asNumber(idxVal) | 0) : idxVal;
                    const v = ctx.data.readKey(base, key);
                    return v === undefined ? 0 : v;
                },
                set: (val) => {
                    let base = baseRef.get();
                    const idxVal = evalNode(ai.index, ctx);
                    const preferArray = Number.isFinite(asNumber(idxVal));
                    if (!ctx.data.isContainer(base)) {
                        base = preferArray ? ctx.data.makeArray() : ctx.data.makeObject();
                        baseRef.set(base);
                    }
                    const key = ctx.data.isArray(base) ? (asNumber(idxVal) | 0) : idxVal;
                    return ctx.data.writeKey(base, key, val);
                },
            };
        }

        default:
            throw new Error('Invalid assignment target.');
    }
}
function lrefable(node: ASTNode): boolean {
    return node.kind === 'Identifier' || node.kind === 'MemberAccess' || node.kind === 'ArrayIndex';
}

/** Evaluate a node to a value. */
export function evalNode(node: ASTNode, ctx: EvalContext): any {
    switch (node.kind) {
        case 'NumberLiteral':  return (node as NumberLiteral).value;
        case 'StringLiteral':  return (node as StringLiteral).value;

        case 'Identifier':     return ctx.getSymbol((node as Identifier).name);

        case 'MemberAccess': {
            const { object, property } = node as MemberAccess;
            const base = evalNode(object, ctx);
            if (!ctx.data.isContainer(base)) return 0;
            const v = ctx.data.readKey(base, property);
            return v === undefined ? 0 : v;
        }

        case 'ArrayIndex': {
            const { array, index } = node as ArrayIndex;
            const base = evalNode(array, ctx);
            if (!ctx.data.isContainer(base)) return 0;
            const idxVal = evalNode(index, ctx);
            const key = ctx.data.isArray(base) ? (asNumber(idxVal) | 0) : idxVal;
            const v = ctx.data.readKey(base, key);
            return v === undefined ? 0 : v;
        }

        case 'ColonPath': {
            const cp = node as ColonPath;
            const handled = ctx.data.resolveColonPath?.(cp.parts.slice());
            return handled !== undefined ? handled : { __colonPath: cp.parts.slice() };
        }

        case 'UnaryExpression': {
            const u = node as UnaryExpression;
            const v = evalNode(u.argument, ctx);
            switch (u.operator) {
                case '+': return (typeof v === 'bigint') ? v : +asNumber(v);
                case '-': return (typeof v === 'bigint') ? (-toBigInt(v)) : (-asNumber(v));
                case '!': return !truthy(v);
                case '~': return (typeof v === 'bigint') ? (~toBigInt(v)) : ((~(asNumber(v) | 0)) >>> 0);
                default:  throw new Error(`Unsupported unary operator ${u.operator}`);
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

        case 'BinaryExpression':   return evalBinary(node as BinaryExpression, ctx);

        case 'ConditionalExpression': {
            const c = node as ConditionalExpression;
            return truthy(evalNode(c.test, ctx)) ? evalNode(c.consequent, ctx) : evalNode(c.alternate, ctx);
        }

        case 'AssignmentExpression': {
            const a = node as AssignmentExpression;
            const ref = lref(a.left, ctx);
            if (a.operator === '=') return ref.set(evalNode(a.right, ctx));
            const L = evalNode(a.left, ctx);
            const R = evalNode(a.right, ctx);
            let out: any;
            switch (a.operator) {
                case '+=': out = addVals(L, R); break;
                case '-=': out = subVals(L, R); break;
                case '*=': out = mulVals(L, R); break;
                case '/=': out = divVals(L, R); break;
                case '%=': out = modVals(L, R); break;
                case '<<=': out = shlVals(L, R); break;
                case '>>=': out = sarVals(L, R); break;
                case '&=': out = andVals(L, R); break;
                case '^=': out = xorVals(L, R); break;
                case '|=': out = orVals(L, R); break;
                default: throw new Error(`Unsupported assignment operator ${a.operator}`);
            }
            return ref.set(out);
        }

        case 'CallExpression': {
            const c = node as CallExpression;
            const fnVal = evalNode(c.callee, ctx);
            const args = c.args.map(a => evalNode(a, ctx));
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
            const args = c.args.map(a => evalNode(a, ctx));
            const fn = ctx.intrinsics[name];
            if (typeof fn !== 'function') throw new Error(`Missing intrinsic ${name}`);
            return fn(ctx, args);
        }

        case 'PrintfExpression': {
            const pf = node as PrintfExpression;
            let out = '';
            for (const seg of pf.segments) {
                if (seg.kind === 'TextSegment') out += (seg as TextSegment).text;
                else {
                    const fs = seg as FormatSegment;
                    out += formatValue(fs.spec, evalNode(fs.value as any, ctx), ctx);
                }
            }
            return out;
        }

        case 'TextSegment':    return (node as TextSegment).text;
        case 'FormatSegment':  return formatValue((node as FormatSegment).spec, evalNode((node as FormatSegment).value, ctx), ctx);

        case 'ErrorNode':      throw new Error('Cannot evaluate an ErrorNode.');

        default:
            throw new Error(`Unhandled node kind: ${(node as any).kind}`);
    }
}

function evalBinary(node: BinaryExpression, ctx: EvalContext): any {
    const { operator, left, right } = node;
    if (operator === '&&') { const lv = evalNode(left, ctx); return truthy(lv) ? evalNode(right, ctx) : lv; }
    if (operator === '||') { const lv = evalNode(left, ctx); return truthy(lv) ? lv : evalNode(right, ctx); }

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
        default: throw new Error(`Unsupported binary operator ${operator}`);
    }
}

/* =============================================================================
 * Printf helpers
 * ============================================================================= */

function formatValue(spec: FormatSegment['spec'], v: any, ctx?: EvalContext): string {
    const override = ctx?.printf?.format?.(spec, v, ctx);
    if (typeof override === 'string') return override;

    switch (spec) {
        case 'd':  return (typeof v === 'bigint') ? v.toString(10) : String((asNumber(v) | 0));
        case 'u':  return (typeof v === 'bigint') ? (v & U64_MASK).toString(10) : String((asNumber(v) >>> 0));
        case 'x':  return (typeof v === 'bigint') ? (v & U64_MASK).toString(16) : (asNumber(v) >>> 0).toString(16);
        case 't':  return truthy(v) ? 'true' : 'false';
        case 'S':  return typeof v === 'string' ? v : String(v);
            // Domain-specific passthroughs (print as-is)
        case 'C': case 'E': case 'I': case 'J': case 'N': case 'M': case 'T': case 'U': return String(v);
        case '%':  return '%';
        default:   return String(v);
    }
}

/* =============================================================================
 * Convenience: evaluate a parsed expression
 * ============================================================================= */

function normalizeEvaluateResult(v: any): EvaluateResult {
    if (v === undefined || v === null) return undefined;
    if (typeof v === 'number' || typeof v === 'string') return v;
    if (typeof v === 'bigint') return v.toString(10);
    if (typeof v === 'boolean') return v ? 1 : 0;
    return undefined;
}

export function evaluateParseResult(pr: ParseResult, ctx: EvalContext): EvaluateResult {
    try {
        const v = evalNode(pr.ast, ctx);
        return normalizeEvaluateResult(v);
    } catch {
        return undefined;
    }
}

/* =============================================================================
 * Usage (printf stays attached exactly as you wanted)
 * ============================================================================= */

// Example wiring:
//
// import { EvalContext, EvalContextInit, ScvdBase } from './evaluator';
// import { formatSpecifier } from './yourPrintfModule';
//
// export const contextInit: EvalContextInit = {
//   data: new ScvdBase(myModel), // <-- your model adapter instance
//   printf: {
//     format(spec, value, ctx) {
//       return formatSpecifier.formatValue(spec, value, ctx);
//     },
//   },
//   // Optionally, you can add ext. functions here (or set data.functions)
//   // functions: { clamp: (x:number,min:number,max:number)=>Math.min(Math.max(x,min),max) },
// };
