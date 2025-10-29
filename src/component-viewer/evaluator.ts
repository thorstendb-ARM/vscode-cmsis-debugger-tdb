// evaluator.ts — condensed, drop-in

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
 * Public API
 * ============================================================================= */

export type EvaluateResult = number | string | undefined;

/** Scalar C-like types supported by the evaluator’s numeric coercions. */
export type CTypeName =
  | 'uint8_t' | 'int8_t'
  | 'uint16_t' | 'int16_t'
  | 'uint32_t' | 'int32_t'
  | 'uint64_t' | 'int64_t'
  | 'float' | 'double';

/** Aggregate C-like type descriptors (containers are opaque to the evaluator). */
export type CTypeDesc =
  | { kind: 'scalar'; ctype: CTypeName }
  | { kind: 'struct'; fields: Record<string, CTypeDesc> }
  | { kind: 'array'; of: CTypeDesc; length: number };

/** Host interface: all symbol + container access goes through here. */
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

  // Optional: simple stats
  stats?(): { symbols?: number; bytesUsed?: number };

  // Optional: symbol → C type descriptor registry (for structs/arrays)
  registerType?(symbol: string, desc: CTypeDesc): void;
  getType?(symbol: string): CTypeDesc | undefined;
}

/** Minimal, in-memory host (Map-backed, plain objects/arrays). */
export function createBasicDataHost(): DataHost {
    const symbols = new Map<string, any>();
    const types = new Map<string, CTypeDesc>();

    return {
        hasSymbol: n => symbols.has(n),
        readSymbol: n => symbols.get(n),
        writeSymbol: (n, v) => (symbols.set(n, v), v),

        isContainer: v => typeof v === 'object' && v !== null,
        isArray: Array.isArray,
        makeObject: () => ({}),
        makeArray: () => ([]),

        readKey: (c, k) => (typeof c === 'object' && c !== null) ? (c as any)[k] : undefined,
        writeKey: (c, k, v) => ((c as any)[k] = v),

        stats: () => ({ symbols: symbols.size }),

        registerType: (s, d) => types.set(s, d),
        getType: (s) => types.get(s),
    };
}

/** Intrinsics available to EvalPointCall nodes. Keep minimal, no external deps. */
export interface IntrinsicHost {
  __CalcMemUsed(ctx: EvalContext, args: any[]): any;
  __FindSymbol(ctx: EvalContext, args: any[]): any;
  __GetRegVal(ctx: EvalContext, args: any[]): any;
  __Offset_of(ctx: EvalContext, args: any[]): any;
  __size_of(ctx: EvalContext, args: any[]): any;
  __Symbol_exists(ctx: EvalContext, args: any[]): any;
}

/** Functions callable by CallExpression (optional). */
export type ExternalFunctions = Record<string, (...args: any[]) => any>;

export interface EvalContextInit {
  data?: DataHost;
  intrinsics?: IntrinsicHost;
  functions?: ExternalFunctions;
  printf?: {
    format?: (spec: FormatSegment['spec'], value: any, ctx: EvalContext) => string | undefined;
  };
}

/** Execution context: routes all reads/writes through DataHost. */
export class EvalContext {
    readonly data: DataHost;
    readonly intrinsics: IntrinsicHost;
    readonly functions: ExternalFunctions;
    readonly printf: NonNullable<EvalContextInit['printf']>;

    /** Per-symbol scalar type coercions (only top-level identifiers). */
    private scalarTypes = new Map<string, CTypeName>();

    constructor(init: EvalContextInit = {}) {
        this.data = init.data ?? createBasicDataHost();
        this.intrinsics = init.intrinsics ?? createDefaultIntrinsicHost();
        this.functions = init.functions ?? Object.create(null);
        this.printf = init.printf ?? {};
    }

    /* ---- Scalar type API (coercion for top-level symbols only) ---- */

    setType(name: string, type: CTypeName): void {
        this.scalarTypes.set(name, type);
    }
    getType(name: string): CTypeName | undefined {
        return this.scalarTypes.get(name);
    }
    convertType(name: string): CTypeName | undefined {
        // Check explicit scalar type mapping first
        const mapped = this.scalarTypes.get(name);
        if (mapped) return mapped;

        // If the identifier itself is a known CTypeName, return it
        const scalarNames: readonly CTypeName[] = [
            'uint8_t','int8_t',
            'uint16_t','int16_t',
            'uint32_t','int32_t',
            'uint64_t','int64_t',
            'float','double',
        ];
        return scalarNames.includes(name as CTypeName) ? (name as CTypeName) : undefined;
    }

    /** Define a typed variable with an optional initial value (coerced). */
    define(name: string, type: CTypeName, initial?: any): void {
        this.setType(name, type);
        if (initial !== undefined) this.setSymbol(name, initial);
        else this.ensureSymbol(name);
    }

    /** Ensure a symbol exists; create with 0 (coerced if scalar type was set). */
    ensureSymbol(name: string): void {
        if (!this.data.hasSymbol(name)) {
            const t = this.getType(name);
            const v = t ? coerceOnWrite(0, t) : 0;
            this.data.writeSymbol(name, v);
        }
    }

    /** Read a symbol (auto-create with 0 if unknown). */
    getSymbol(name: string): any {
        this.ensureSymbol(name);
        const v = this.data.readSymbol(name);
        return coerceOnRead(v, this.getType(name));
    }

    /** Overwrite a symbol; value is coerced to its declared scalar type, if any. */
    setSymbol(name: string, value: any): any {
        const t = this.getType(name);
        const coerced = t ? coerceOnWrite(value, t) : value;
        this.data.writeSymbol(name, coerced);
        return coerced;
    }
}

/* =============================================================================
 * Default intrinsics (minimal)
 * ============================================================================= */

export function createDefaultIntrinsicHost(): IntrinsicHost {
    return {
        __CalcMemUsed(ctx, _args) {
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
        __GetRegVal(_ctx, _args) {
            return 0;
        },
        __Offset_of(_ctx, _args) {
            return 0;
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
    };
}

/* =============================================================================
 * Numeric helpers & scalar coercions
 * ============================================================================= */

const U8_MASK  = 0xFF;
const U16_MASK = 0xFFFF;
const U64_MASK = (1n << 64n) - 1n;
const I64_SIGN = 1n << 63n;

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

// <=32-bit: JS number; 64-bit: BigInt
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
function coerceOnRead(v: any, t?: CTypeName): any { return t ? coerceOnWrite(v, t) : v; }

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

/* BigInt-aware helpers */
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
            return { __colonPath: cp.parts.slice() };
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

export function evaluateParseResult(pr: ParseResult, ctx = new EvalContext()): EvaluateResult {
    try {
        const v = evalNode(pr.ast, ctx);
        return normalizeEvaluateResult(v);
    } catch {
        return undefined;
    }
}
