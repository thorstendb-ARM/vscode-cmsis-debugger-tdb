// evaluator.ts — ScvdBase-only containers & host-owned intrinsics (strict missing symbol/value errors)

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
import type { ScvdBase } from './model/scvdBase';

export type EvaluateResult = number | string | undefined;

export type CTypeName =
  | 'uint8_t' | 'int8_t'
  | 'uint16_t' | 'int16_t'
  | 'uint32_t' | 'int32_t'
  | 'uint64_t' | 'int64_t'
  | 'float' | 'double';

export type ExternalFunctions = Record<string, (...args: any[]) => any>;

export interface DataHost {
  getSymbolRef(root: ScvdBase, name: string, forWrite?: boolean): ScvdBase | undefined;
  getMemberRef(base: ScvdBase, property: string, forWrite?: boolean): ScvdBase | undefined;
  getIndexRef(base: ScvdBase, index: number, forWrite?: boolean): ScvdBase | undefined;
  readValue(ref: ScvdBase): any;                // may return undefined -> error
  writeValue(ref: ScvdBase, value: any): any;   // may return undefined -> error
  resolveColonPath?(root: ScvdBase, parts: string[]): ScvdBase | any;
  stats?(): { symbols?: number; bytesUsed?: number };
  evalIntrinsic?(name: string, root: ScvdBase, args: any[]): any;

  __CalcMemUsed?(root: ScvdBase, args: any[]): any;
  __FindSymbol?(root: ScvdBase, args: any[]): any;
  __GetRegVal?(root: ScvdBase, args: any[]): any;
  __size_of?(root: ScvdBase, args: any[]): any;
  __Symbol_exists?(root: ScvdBase, args: any[]): any;
  __Offset_of?(root: ScvdBase, args: any[]): any;

  // Optional: external functions table
  functions?: ExternalFunctions;
}

export interface EvalContextInit {
  data: DataHost;
  printf: {
    format?: (spec: FormatSegment['spec'], value: any, ctx: EvalContext) => string | undefined;
  };
  container: ScvdBase;
  functions?: ExternalFunctions;
}

export class EvalContext {
    readonly data: DataHost;
    container: ScvdBase;
    readonly functions: ExternalFunctions;
    readonly printf: NonNullable<EvalContextInit['printf']>;

    constructor(init: EvalContextInit) {
        this.data = init.data;
        const hostFns = (this.data as any)?.functions as ExternalFunctions | undefined;
        this.functions = init.functions ?? hostFns ?? Object.create(null);
        this.printf = init.printf ?? {};
        this.container = init.container;
    }

    ensureSymbol(name: string): ScvdBase | undefined {
        return this.data.getSymbolRef(this.container, name, true);
    }
    getSymbol(name: string): any {
        const ref = this.data.getSymbolRef(this.container, name, false) ?? this.ensureSymbol(name);
        if (!ref) throw new Error(`Unknown symbol '${name}'`);
        const v = this.data.readValue(ref);
        if (v === undefined) throw new Error(`Undefined value for symbol '${name}'`);
        return v;
    }
    setSymbol(name: string, value: any): any {
        const ref = this.data.getSymbolRef(this.container, name, true);
        if (!ref) throw new Error(`Unknown symbol '${name}'`);
        const w = this.data.writeValue(ref, value);
        if (w === undefined) throw new Error(`Write returned undefined for symbol '${name}'`);
        return w;
    }
}

/* =============================================================================
 * Numeric helpers
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
function addVals(a: any, b: any): any {
    if (typeof a === 'string' || typeof b === 'string') return String(a) + String(b);
    if (typeof a === 'bigint' || typeof b === 'bigint') return toBigInt(a) + toBigInt(b);
    return asNumber(a) + asNumber(b);
}

/* =============================================================================
 * Strict reference/value helpers (throw on missing)
 * ============================================================================= */

function mustRef(node: ASTNode, ctx: EvalContext, forWrite = false): ScvdBase {
    switch (node.kind) {
        case 'Identifier': {
            const id = node as Identifier;
            const ref = ctx.data.getSymbolRef(ctx.container, id.name, forWrite);
            if (!ref) throw new Error(`Unknown symbol '${id.name}'`);
            return ref;
        }
        case 'MemberAccess': {
            const ma = node as MemberAccess;
            const baseRef = mustRef(ma.object, ctx, forWrite);
            const child = ctx.data.getMemberRef(baseRef, ma.property, forWrite);
            if (!child) throw new Error(`Missing member '${ma.property}'`);
            return child;
        }
        case 'ArrayIndex': {
            const ai = node as ArrayIndex;
            const baseRef = mustRef(ai.array, ctx, forWrite);
            const idxVal = evalNode(ai.index, ctx);
            const idx = asNumber(idxVal) | 0;
            const child = ctx.data.getIndexRef(baseRef, idx, forWrite);
            if (!child) throw new Error(`Missing index [${idx}]`);
            return child;
        }
        default:
            throw new Error('Invalid reference target.');
    }
}

function mustRead(ref: ScvdBase, ctx: EvalContext, label?: string): any {
    const v = ctx.data.readValue(ref);
    if (v === undefined) throw new Error(label ? `Undefined value for ${label}` : 'Undefined value');
    return v;
}

type LValue = { get(): any; set(v: any): any };

function lref(node: ASTNode, ctx: EvalContext): LValue {
    const ref = mustRef(node, ctx, true);
    return {
        get: () => mustRead(ref, ctx),
        set: (v) => {
            const out = ctx.data.writeValue(ref, v);
            if (out === undefined) throw new Error('Write returned undefined');
            return out;
        },
    };
}

/* =============================================================================
 * Evaluation
 * ============================================================================= */

export function evalNode(node: ASTNode, ctx: EvalContext): any {
    switch (node.kind) {
        case 'NumberLiteral':  return (node as NumberLiteral).value;
        case 'StringLiteral':  return (node as StringLiteral).value;

        case 'Identifier': {
            const r = mustRef(node, ctx, false);
            return mustRead(r, ctx, (node as Identifier).name);
        }

        case 'MemberAccess': {
            const r = mustRef(node, ctx, false);
            return mustRead(r, ctx);
        }

        case 'ArrayIndex': {
            const r = mustRef(node, ctx, false);
            return mustRead(r, ctx);
        }

        case 'ColonPath': {
            const cp = node as ColonPath;
            const handled = ctx.data.resolveColonPath?.(ctx.container, cp.parts.slice());
            // Colon paths that do not resolve are allowed to flow (domain-specific)
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
                case '<<=': out = (typeof L === 'bigint' || typeof R === 'bigint') ? (toBigInt(L) << toBigInt(R)) : (((asNumber(L)|0) << (asNumber(R)&31)) >>> 0); break;
                case '>>=': out = (typeof L === 'bigint' || typeof R === 'bigint') ? (toBigInt(L) >> toBigInt(R)) : (((asNumber(L)|0) >> (asNumber(R)&31)) >>> 0); break;
                case '&=': out = andVals(L, R); break;
                case '^=': out = xorVals(L, R); break;
                case '|=': out = orVals(L, R); break;
                default: throw new Error(`Unsupported assignment operator ${a.operator}`);
            }
            return ref.set(out);
        }

        case 'CallExpression': {
            const c = node as CallExpression;
            const args = c.args.map(a => evalNode(a, ctx));
            // Prefer external function table BEFORE reading callee symbol value
            if (c.callee.kind === 'Identifier') {
                const name = (c.callee as Identifier).name;
                const ext = ctx.functions[name];
                if (typeof ext === 'function') return ext(...args);
            }
            const fnVal = evalNode(c.callee, ctx); // may throw if missing/undefined
            if (typeof fnVal === 'function') return fnVal(...args);
            throw new Error('Callee is not callable.');
        }

        case 'EvalPointCall': {
            const c = node as EvalPointCall;
            const name = c.intrinsic as string;
            const args = c.args.map(a => evalNode(a, ctx));
            return routeIntrinsic(ctx, name, args);
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
        case '<<': return (typeof a === 'bigint' || typeof b === 'bigint') ? (toBigInt(a) << toBigInt(b)) : (((asNumber(a)|0) << (asNumber(b)&31)) >>> 0);
        case '>>': return (typeof a === 'bigint' || typeof b === 'bigint') ? (toBigInt(a) >> toBigInt(b)) : (((asNumber(a)|0) >> (asNumber(b)&31)) >>> 0);
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
    const override = ctx?.printf?.format?.(spec, v, ctx as EvalContext);
    if (typeof override === 'string') return override;

    switch (spec) {
        case 'd':  return (typeof v === 'bigint') ? v.toString(10) : String((asNumber(v) | 0));
        case 'u':  return (typeof v === 'bigint') ? (v & U64_MASK).toString(10) : String((asNumber(v) >>> 0));
        case 'x':  return (typeof v === 'bigint') ? (v & U64_MASK).toString(16) : (asNumber(v) >>> 0).toString(16);
        case 't':  return truthy(v) ? 'true' : 'false';
        case 'S':  return typeof v === 'string' ? v : String(v);
        case 'C': case 'E': case 'I': case 'J': case 'N': case 'M': case 'T': case 'U': return String(v);
        case '%':  return '%';
        default:   return String(v);
    }
}

/* =============================================================================
 * Intrinsics routing
 * ============================================================================= */

function routeIntrinsic(ctx: EvalContext, name: string, args: any[]): any {
    if (typeof ctx.data.evalIntrinsic === 'function') {
        return ctx.data.evalIntrinsic(name, ctx.container, args);
    }
    const direct = (ctx.data as any)[name];
    if (typeof direct === 'function') {
        return direct.call(ctx.data, ctx.container, args);
    }
    return defaultIntrinsic(name, ctx, args);
}

function defaultIntrinsic(name: string, ctx: EvalContext, args: any[]): any {
    switch (name) {
        case '__CalcMemUsed': {
            const s = ctx.data.stats?.();
            if (s?.bytesUsed != null) return s.bytesUsed;
            if (s?.symbols != null) return s.symbols * 16;
            return 0;
        }
        case '__FindSymbol': {
            // Prefer host override; if we got here, emulate strict behavior
            const [sym] = args;
            if (typeof sym !== 'string') throw new Error('Invalid symbol name');
            const ref = ctx.data.getSymbolRef(ctx.container, sym, false);
            if (!ref) throw new Error(`Unknown symbol '${sym}'`);
            const v = ctx.data.readValue(ref);
            if (v === undefined) throw new Error(`Undefined value for symbol '${sym}'`);
            return v;
        }
        case '__GetRegVal': {
            const [regName] = args;
            if (typeof regName !== 'string') throw new Error('Invalid register name');
            const r = ctx.data.resolveColonPath?.(ctx.container, ['reg', regName]);
            if (r === undefined) throw new Error(`Unknown register '${regName}'`);
            return r;
        }
        case '__size_of': {
            const [arg0] = args;
            if (typeof arg0 === 'string') {
                switch (arg0) {
                    case 'uint8_t': case 'int8_t': return 1;
                    case 'uint16_t': case 'int16_t': return 2;
                    case 'uint32_t': case 'int32_t': case 'float': return 4;
                    case 'uint64_t': case 'int64_t': case 'double': return 8;
                }
            }
            return 4;
        }
        case '__Symbol_exists': {
            const [name] = args;
            if (typeof name !== 'string') return 0;
            const ref = ctx.data.getSymbolRef(ctx.container, name, false);
            return ref ? 1 : 0;
        }
        case '__Offset_of': {
            return 0;
        }
        default:
            throw new Error(`Missing intrinsic ${name}`);
    }
}

/* =============================================================================
 * Convenience
 * ============================================================================= */

function normalizeEvaluateResult(v: any): EvaluateResult {
    if (v === undefined || v === null) return undefined;
    if (typeof v === 'number' || typeof v === 'string') return v;
    if (typeof v === 'bigint') return v.toString(10);
    if (typeof v === 'boolean') return v ? 1 : 0;
    return undefined;
}

export function evaluateParseResult(pr: ParseResult, ctx: EvalContext, container?: ScvdBase): EvaluateResult {
    const prev = ctx.container;
    const override = (container !== undefined);
    if (override) ctx.container = container as ScvdBase;
    try {
        const v = evalNode(pr.ast, ctx);
        return normalizeEvaluateResult(v);
    } catch {
    // Stop evaluation and surface error to caller by returning undefined
        return undefined;
    } finally {
        if (override) ctx.container = prev;
    }
}
