// evaluator.ts — ScvdBase-only, single container context (base/member/index/current)
// Strict error semantics: any unresolved ref/value causes throw; top-level returns undefined

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
import type { ScvdBase } from './model/scvd-base';

/* =============================================================================
 * Public API
 * ============================================================================= */

export type EvaluateResult = number | string | undefined;

/** Container context carried during evaluation. */
export interface RefContainer {
  /** Root model where identifier lookups begin. */
  base: ScvdBase;

  /** Top-level anchor for the final read (e.g., TCB). */
  anchor?: ScvdBase | undefined;
  /** Accumulated byte offset from the anchor. */
  offsetBytes?: number | undefined;
  /** Final read width in bits (host may ignore if unknown). */
  widthBits?: number | undefined;
  /** Bit offset within the first addressed byte (0..7). */
  offsetBitRemainder?: number | undefined;

  /** Current ref resolved by the last resolution step (for chaining). */
  current?: ScvdBase | undefined;
  /** Most recent resolved member reference (child). */
  member?: ScvdBase | undefined;
  /** Most recent numeric index for array access (e.g., arr[3]). */
  index?: number | undefined;
}

/** Host contract used by the evaluator (implemented by ScvdEvalInterface). */
export interface DataHost {
  // Resolution APIs — must set container.current to the resolved ref on success
  getSymbolRef(container: RefContainer, name: string, forWrite?: boolean): ScvdBase | undefined;
  getMemberRef(container: RefContainer, property: string, forWrite?: boolean): ScvdBase | undefined;

  // Value access acts on container.{anchor,offsetBytes,widthBits}
  readValue(container: RefContainer): any;                  // may return undefined -> error
  writeValue(container: RefContainer, value: any): any;     // may return undefined -> error

  // Optional: advanced lookups / intrinsics use the whole container context
  resolveColonPath?(container: RefContainer, parts: string[]): any; // undefined => not found
  stats?(): { symbols?: number; bytesUsed?: number };
  evalIntrinsic?(name: string, container: RefContainer, args: any[]): any; // undefined => not handled

  // Optional metadata (lets evaluator accumulate offsets itself)
  getElementStride?(ref: ScvdBase): number;                       // bytes per element
  getMemberOffset?(base: ScvdBase, member: ScvdBase): number;     // bytes
  getBitWidth?(ref: ScvdBase): number;                            // bits
  getElementBitWidth?(ref: ScvdBase): number;                     // bits (if array of scalars)


  // Optional bit-precise layout
  getElementStrideBits?(ref: ScvdBase): number;                 // bits per element
  getMemberBitOffset?(base: ScvdBase, member: ScvdBase): number; // bits
  // **** OPTIONAL: provide an element model (prototype/type) for array-ish refs
  getElementRef?(ref: ScvdBase): ScvdBase | undefined;

  // Optional named intrinsics
  // Note: __GetRegVal(reg) is special-cased (no container); others use the evalIntrinsic convention


  __GetRegVal?(reg: string): number | undefined;
  __FindSymbol?(symbol: string): number | undefined;
  __CalcMemUsed?(args: number[]): number | undefined;
  __size_of?(symbol: string): number | undefined;
  __Symbol_exists?(symbol: string): number | undefined;
  __Offset_of?(container: RefContainer, typedefMember: string): number | undefined;

  // Additional named intrinsics
  // __Running is special-cased (no container) and returns 1 or 0 for use in expressions
  __Running?(): number | undefined;

  // Pseudo-member evaluators used as obj._count / obj._addr; must return numbers
  _count?(container: RefContainer): number | undefined;
  //_addr?(container: RefContainer): number | undefined;    // added as var because arrays can have different base addresses
}

export type EvalPrintfHook = {
  format: (spec: string, value: any, ctx: EvalContext) => string | undefined;
};


export interface EvalContextInit {
  data: DataHost;
  /** Starting container for symbol resolution (root model). */
  container: ScvdBase;
  printf?: EvalPrintfHook;
}

export class EvalContext {
    readonly data: DataHost;
    /** Composite container context (root + last member/index/current). */
    container: RefContainer;
    readonly printf: { format?: (spec: FormatSegment['spec'], value: any, ctx: EvalContext) => string | undefined };

    constructor(init: EvalContextInit) {
        this.data = init.data;
        this.container = { base: init.container };
        this.printf = init.printf ?? {};
    }
}

/* =============================================================================
 * Helpers
 * ============================================================================= */

const U64_MASK = (BigInt(1) << BigInt(64)) - BigInt(1);

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
    if (typeof x === 'boolean') return x ? BigInt(1) : BigInt(0);
    if (typeof x === 'string' && x.trim() !== '') {
        try { return BigInt(x); } catch { return BigInt(Math.trunc(+x) || 0); }
    }
    return BigInt(0);
}

function addVals(a: any, b: any): any {
    if (typeof a === 'string' || typeof b === 'string') return String(a) + String(b);
    if (typeof a === 'bigint' || typeof b === 'bigint') return toBigInt(a) + toBigInt(b);
    return asNumber(a) + asNumber(b);
}
function subVals(a: any, b: any): any { return (typeof a === 'bigint' || typeof b === 'bigint') ? (toBigInt(a) - toBigInt(b)) : (asNumber(a) - asNumber(b)); }
function mulVals(a: any, b: any): any { return (typeof a === 'bigint' || typeof b === 'bigint') ? (toBigInt(a) * toBigInt(b)) : (asNumber(a) * asNumber(b)); }
function divVals(a: any, b: any): any {
    if (typeof a === 'bigint' || typeof b === 'bigint') {
        const bb = toBigInt(b); if (bb === BigInt(0)) throw new Error('Division by zero');
        return toBigInt(a) / bb;
    }
    const nb = asNumber(b); if (nb === 0) throw new Error('Division by zero');
    return asNumber(a) / nb;
}
function modVals(a: any, b: any): any {
    if (typeof a === 'bigint' || typeof b === 'bigint') {
        const bb = toBigInt(b); if (bb === BigInt(0)) throw new Error('Division by zero');
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

/* =============================================================================
 * Small utility to avoid container clobbering during nested evals
 * ============================================================================= */

function withIsolatedContainer<T>(ctx: EvalContext, fn: () => T): T {
    const c = ctx.container;
    const saved = {
        anchor: c.anchor,
        offsetBytes: c.offsetBytes,
        offsetBitRemainder: c.offsetBitRemainder,
        widthBits: c.widthBits,
        current: c.current,
        member: c.member,
        index: c.index,
    };
    try {
        return fn();
    } finally {
        c.anchor = saved.anchor;
        c.offsetBytes = saved.offsetBytes;
        c.offsetBitRemainder = saved.offsetBitRemainder;
        c.widthBits = saved.widthBits;
        c.current = saved.current;
        c.member = saved.member;
        c.index = saved.index;
    }
}

/* =============================================================================
 * Strict ref/value utilities (single-root + contextual hints)
 * ============================================================================= */

type LValue = { get(): any; set(v: any): any };

function addBitOffset(ctx: EvalContext, bits: number) {
    const c = ctx.container as any;
    const add = (bits | 0);
    const total = ((c.offsetBitRemainder ?? 0) + add);
    c.offsetBytes = ((c.offsetBytes ?? 0) + (total >> 3));
    c.offsetBitRemainder = (total & 7);
}


function setWidth(ctx: EvalContext, bits: number | undefined) {
    if (bits !== undefined) ctx.container.widthBits = bits;
}

function mustRef(node: ASTNode, ctx: EvalContext, forWrite = false): ScvdBase {
    switch (node.kind) {
        case 'Identifier': {
            const id = node as Identifier;
            // Identifier lookup always starts from the root base
            const ref = ctx.data.getSymbolRef(ctx.container, id.name, forWrite);
            if (!ref) throw new Error(`Unknown symbol '${id.name}'`);
            // Start a new anchor chain at this identifier
            ctx.container.anchor = ref;
            ctx.container.offsetBytes = 0;
            ctx.container.offsetBitRemainder = 0;
            ctx.container.widthBits = ctx.data.getBitWidth?.(ref);
            // Reset last-context hints for a plain identifier
            ctx.container.member = undefined;
            ctx.container.index = undefined;
            // Set the current target for subsequent resolution
            ctx.container.current = ref;
            return ref;
        }

        case 'MemberAccess': {
            const ma = node as MemberAccess;

            // Fast-path: if object is an ArrayIndex, compute index ONCE, then resolve the member on the element.
            if (ma.object.kind === 'ArrayIndex') {
                const ai = ma.object as ArrayIndex;

                // Resolve array symbol and establish anchor/current
                const baseRef = mustRef(ai.array, ctx, forWrite);

                // Evaluate index in isolation (so i/j/mem.length don't clobber outer anchor)
                const idx = asNumber(withIsolatedContainer(ctx, () => evalNode(ai.index, ctx))) | 0;

                // Remember the index for hosts that use it
                ctx.container.index = idx;

                // Use the thing we're actually indexing (supports nested arr[i][j].field)
                const arrayRef = ctx.container.current ?? baseRef;

                // Apply array bit offset using the correct dimension's stride
                const strideBits = ctx.data.getElementStrideBits?.(arrayRef) ?? ((ctx.data.getElementStride?.(arrayRef) ?? 0) * 8);
                if (typeof strideBits === 'number') addBitOffset(ctx, idx * strideBits);

                // Base for member resolution = element model if host provides one
                const baseForMember = ctx.data.getElementRef?.(arrayRef) ?? arrayRef;
                ctx.container.current = baseForMember;

                // Resolve member
                const child = ctx.data.getMemberRef(ctx.container, ma.property, forWrite);
                if (!child) throw new Error(`Missing member '${ma.property}'`);

                // Accumulate member bit offset & width
                const memberBits = ctx.data.getMemberBitOffset?.(baseForMember, child) ?? ((ctx.data.getMemberOffset?.(baseForMember, child) ?? 0) * 8);
                if (typeof memberBits === 'number') addBitOffset(ctx, memberBits);
                setWidth(ctx, ctx.data.getBitWidth?.(child));

                // Finalize hints
                ctx.container.member = child;
                ctx.container.current = child;
                return child;
            }

            // Default path: resolve base then member
            const baseRef = mustRef(ma.object, ctx, forWrite);

            ctx.container.current = baseRef;
            const child = ctx.data.getMemberRef(ctx.container, ma.property, forWrite);
            if (!child) throw new Error(`Missing member '${ma.property}'`);

            const memberBits = ctx.data.getMemberBitOffset?.(baseRef, child) ?? ((ctx.data.getMemberOffset?.(baseRef, child) ?? 0) * 8);
            if (typeof memberBits === 'number') addBitOffset(ctx, memberBits);
            setWidth(ctx, ctx.data.getBitWidth?.(child));

            ctx.container.member = child;
            ctx.container.current = child;
            return child;
        }

        case 'ArrayIndex': {
            const ai = node as ArrayIndex;

            // Resolve array base (establishes anchor/current on the array)
            const baseRef = mustRef(ai.array, ctx, forWrite);

            // Evaluate the index in isolation
            const idx = asNumber(withIsolatedContainer(ctx, () => evalNode(ai.index, ctx))) | 0;

            // Translate index -> byte offset
            ctx.container.index = idx;

            const arrayRef = ctx.container.current ?? baseRef;
            ctx.container.member = undefined;

            const strideBits = ctx.data.getElementStrideBits?.(arrayRef) ?? ((ctx.data.getElementStride?.(arrayRef) ?? 0) * 8);
            if (typeof strideBits === 'number') addBitOffset(ctx, idx * strideBits);

            // Current target remains base for subsequent member access (or element if host exposes it)
            ctx.container.current = ctx.data.getElementRef?.(arrayRef) ?? arrayRef;

            // Update width to element width if host exposes it
            setWidth(ctx, ctx.data.getElementBitWidth?.(arrayRef));
            return baseRef;
        }

        case 'EvalPointCall': {
            throw new Error('Invalid reference target.');
        }

        default:
            throw new Error('Invalid reference target.');
    }
}

function mustRead(ctx: EvalContext, label?: string): any {
    const v = ctx.data.readValue(ctx.container);
    if (v === undefined) {
        throw new Error(label ? `Undefined value for ${label}` : 'Undefined value');
    }
    return v;
}

function lref(node: ASTNode, ctx: EvalContext): LValue {
    // Resolve and set the current target in the container for writes
    mustRef(node, ctx, true);

    // ⬇️ NEW: snapshot the LHS write target so RHS evaluation can't clobber it
    const target: RefContainer = {
        base: ctx.container.base,
        anchor: ctx.container.anchor,
        offsetBytes: ctx.container.offsetBytes,
        widthBits: ctx.container.widthBits,
        offsetBitRemainder: ctx.container.offsetBitRemainder,
        index: (ctx.container as any).index,  // if you record it
    };
    return {
        get(): any {
            mustRef(node, ctx, false);
            return mustRead(ctx);
        },
        set(v: any): any {
            const out = ctx.data.writeValue(target, v); // ⬅️ use frozen target
            if (out === undefined) throw new Error('Write returned undefined');
            return out;
        }
    };
}
/* =============================================================================
 * Evaluation
 * ============================================================================= */

// Belt-and-braces: value-returning intrinsics that may be written as CallExpression(Identifier(...))
// We still prefer EvalPointCall from the parser, but this keeps us robust.
const VALUE_INTRINSICS = new Set<string>([
    '__GetRegVal',
    '__Running',
    '__CalcMemUsed',
    '__size_of',
    '__Symbol_exists',
    '__Offset_of',
    '__FindSymbol',
]);

export function evalNode(node: ASTNode, ctx: EvalContext): any {
    switch (node.kind) {
        case 'NumberLiteral':  return (node as NumberLiteral).value;
        case 'StringLiteral':  return (node as StringLiteral).value;

        case 'Identifier': {
            mustRef(node, ctx, false);
            return mustRead(ctx, (node as Identifier).name);
        }

        case 'MemberAccess': {
            const ma = node as MemberAccess;
            // Support pseudo-members that evaluate to numbers: obj._count and obj._addr
            if (ma.property === '_count' /*|| ma.property === '_addr'*/) {
                const baseRef = mustRef(ma.object, ctx, false);
                ctx.container.member = baseRef;
                ctx.container.current = baseRef;
                const host = ctx.data as any;
                const fn = host[ma.property] as ((container: RefContainer) => any) | undefined;
                if (typeof fn !== 'function') throw new Error(`Missing pseudo-member ${ma.property}`);
                const out = fn.call(ctx.data, ctx.container);
                if (out === undefined) throw new Error(`Pseudo-member ${ma.property} returned undefined`);
                return out;
            }
            // Default: resolve member and read its value
            mustRef(node, ctx, false);
            return mustRead(ctx);
        }

        case 'ArrayIndex': {
            mustRef(node, ctx, false);
            return mustRead(ctx);
        }

        case 'ColonPath': {
            const cp = node as ColonPath;
            const handled = ctx.data.resolveColonPath?.(ctx.container, cp.parts.slice());
            if (handled === undefined) throw new Error(`Unresolved colon path: ${cp.parts.join(':')}`);
            return handled;
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
                ? (u.operator === '++' ? (toBigInt(prev) + BigInt(1)) : (toBigInt(prev) - BigInt(1)))
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
            if (a.operator === '=') {
                const value = withIsolatedContainer(ctx, () => evalNode(a.right, ctx));
                return ref.set(value);
            }
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
            const args = c.args.map(a => evalNode(a, ctx));

            // Fallback: allow value-returning intrinsics even if AST arrived as CallExpression
            if (c.callee.kind === 'Identifier') {
                const name = (c.callee as Identifier).name;
                if (VALUE_INTRINSICS.has(name)) {
                    return routeIntrinsic(ctx, name, args);
                }

            }

            const fnVal = evalNode(c.callee, ctx);
            if (typeof fnVal === 'function') return (fnVal as Function)(...args);
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
 * Printf helpers (callback-first, spec-agnostic with sensible fallbacks)
 * ============================================================================= */

function formatValue(spec: FormatSegment['spec'], v: any, ctx?: EvalContext): string {
    const override = ctx?.printf?.format?.(spec, v, ctx as EvalContext);
    if (typeof override === 'string') return override;

    switch (spec) {
        case '%':  return '%';
        case 'd':  return (typeof v === 'bigint') ? v.toString(10) : String((asNumber(v) | 0));
        case 'u':  return (typeof v === 'bigint') ? (v & U64_MASK).toString(10) : String((asNumber(v) >>> 0));
        case 'x':  return (typeof v === 'bigint') ? (v & U64_MASK).toString(16) : (asNumber(v) >>> 0).toString(16);
        case 't':  return truthy(v) ? 'true' : 'false';
        case 'S':  return typeof v === 'string' ? v : String(v);
        case 'C': case 'E': case 'I': case 'J': case 'N': case 'M': case 'T': case 'U': return String(v);
        default:   return String(v);
    }
}

/* =============================================================================
 * Intrinsics routing (strict, single-root)
 * ============================================================================= */

function routeIntrinsic(ctx: EvalContext, name: string, args: any[]): any {
    // Explicit numeric intrinsics (simple parameter lists)
    if (name === '__GetRegVal') {
        const fn = (ctx.data as any).__GetRegVal as ((reg: string) => number | undefined) | undefined;
        if (typeof fn !== 'function') throw new Error('Missing intrinsic __GetRegVal');
        const out = fn.call(ctx.data, String(args[0] ?? ''));
        if (out === undefined) throw new Error('Intrinsic __GetRegVal returned undefined');
        return out;
    }
    if (name === '__FindSymbol') {
        const fn = (ctx.data as any).__FindSymbol as ((sym: string) => number | undefined) | undefined;
        if (typeof fn !== 'function') throw new Error('Missing intrinsic __FindSymbol');
        const out = fn.call(ctx.data, String(args[0] ?? ''));
        if (out === undefined) throw new Error('Intrinsic __FindSymbol returned undefined');
        return out | 0;
    }
    if (name === '__CalcMemUsed') {
        const fn = (ctx.data as any).__CalcMemUsed as ((args: any[]) => number | undefined) | undefined;
        if (typeof fn !== 'function') throw new Error('Missing intrinsic __CalcMemUsed');
        const a = args.map(v => Number(v) >>> 0);
        const out = fn.call(ctx.data, a);
        if (out === undefined) throw new Error('Intrinsic __CalcMemUsed returned undefined');
        return out >>> 0;
    }
    if (name === '__size_of') {
        const fn = (ctx.data as any).__size_of as ((sym: string) => number | undefined) | undefined;
        if (typeof fn !== 'function') throw new Error('Missing intrinsic __size_of');
        const out = fn.call(ctx.data, String(args[0] ?? ''));
        if (out === undefined) throw new Error('Intrinsic __size_of returned undefined');
        return out | 0;
    }
    if (name === '__Symbol_exists') {
        const fn = (ctx.data as any).__Symbol_exists as ((sym: string) => number | undefined) | undefined;
        if (typeof fn !== 'function') throw new Error('Missing intrinsic __Symbol_exists');
        const out = fn.call(ctx.data, String(args[0] ?? ''));
        if (out === undefined) throw new Error('Intrinsic __Symbol_exists returned undefined');
        return out | 0;
    }
    // Explicit intrinsic that needs the container but returns a number
    if (name === '__Offset_of') {
        const fn = (ctx.data as any).__Offset_of as ((container: RefContainer, typedefMember: string) => number | undefined) | undefined;
        if (typeof fn !== 'function') throw new Error('Missing intrinsic __Offset_of');
        const out = fn.call(ctx.data, ctx.container, String(args[0] ?? ''));
        if (out === undefined) throw new Error('Intrinsic __Offset_of returned undefined');
        return out >>> 0;
    }
    if (name === '__Running') {
        const fn = (ctx.data as any).__Running as (() => number | undefined) | undefined;
        if (typeof fn !== 'function') throw new Error('Missing intrinsic __Running');
        const out = fn.call(ctx.data);
        if (out === undefined) throw new Error('Intrinsic __Running returned undefined');
        return out | 0;
    }

    // Generic dispatch paths (legacy/custom)
    if (typeof ctx.data.evalIntrinsic === 'function') {
        const out = ctx.data.evalIntrinsic(name, ctx.container, args);
        if (out === undefined) throw new Error(`Intrinsic ${name} returned undefined`);
        return out;
    }
    const direct = (ctx.data as any)[name];
    if (typeof direct === 'function') {
        const out = direct.call(ctx.data, ctx.container, args);
        if (out === undefined) throw new Error(`Intrinsic ${name} returned undefined`);
        return out;
    }
    throw new Error(`Missing intrinsic ${name}`);
}
/* =============================================================================
 * Top-level convenience
 * ============================================================================= */

function normalizeEvaluateResult(v: any): EvaluateResult {
    if (v === undefined || v === null) return undefined;
    if (typeof v === 'number' || typeof v === 'string') return v;
    if (typeof v === 'bigint') return v.toString(10);
    if (typeof v === 'boolean') return v ? 1 : 0;
    return undefined;
}

export function evaluateParseResult(pr: ParseResult, ctx: EvalContext, container?: ScvdBase): EvaluateResult {
    const prevBase = ctx.container.base;
    const saved = { ...ctx.container } as RefContainer;
    const override = container !== undefined;
    if (override) ctx.container.base = container as ScvdBase;
    try {
        const v = evalNode(pr.ast, ctx);
        return normalizeEvaluateResult(v);
    } catch (e) {
        console.error('Error evaluating parse result:', pr, e);
        return undefined;
    } finally {
        if (override) ctx.container.base = prevBase;
        ctx.container.anchor = saved.anchor;
        ctx.container.offsetBytes = saved.offsetBytes;
        ctx.container.widthBits = saved.widthBits;
        ctx.container.current = saved.current;
        ctx.container.member = saved.member;
        ctx.container.index = saved.index;
    }
}


