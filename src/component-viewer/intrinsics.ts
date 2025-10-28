// intrinsics.ts
// External, pluggable IntrinsicHost for the AST evaluator.

import type { EvalContext, CTypeName, IntrinsicHost } from './evaluator';
import { registerCache } from './ScvdCacheRegister';

/** Partial override type for supplying custom intrinsic implementations. */
export type IntrinsicOverrides = Partial<IntrinsicHost>;

/** Public factory: start with sensible defaults, then apply overrides. */
export function createIntrinsicHost(overrides: IntrinsicOverrides = {}): IntrinsicHost {
    const base = createDefaultIntrinsicHost();
    return { ...base, ...overrides };
}

/** Default / dummy implementations for all intrinsics (DataHost-based). */
export function createDefaultIntrinsicHost(): IntrinsicHost {
    return {
        __CalcMemUsed(ctx: EvalContext, _args: any[]): any {
            // Prefer DataHost stats if provided; fall back to a tiny heuristic.
            const s = ctx.data.stats?.();
            if (s?.bytesUsed != null) return s.bytesUsed;
            if (s?.symbols != null) return s.symbols * 16; // bytes-ish; tune for your domain
            return 0;
        },

        __FindSymbol(ctx: EvalContext, args: any[]): any {
            const [name] = args ?? [];
            if (typeof name !== 'string') return 0;
            // Spec: auto-create unknown identifiers with value 0 on first touch.
            ctx.ensureSymbol(name);
            return ctx.getSymbol(name);
        },

        __GetRegVal(_ctx: EvalContext, args: any[]): any {
            // Dummy register read bridged to your cache; override as needed.
            const [regName] = args ?? [];
            if (typeof regName === 'string' && regName) {
                return registerCache.readRegister(regName);
            }
            return 0;
        },

        __Offset_of(_ctx: EvalContext, args: any[]): any {
            // Domain-specific in real systems; here accept ColonPath-like or strings and return 0.
            const [what] = args ?? [];
            if (isColonPathLike(what) || typeof what === 'string') return 0;
            return 0;
        },

        __size_of(_ctx: EvalContext, args: any[]): any {
            // If given a C type name, return the canonical size; else default to 4.
            const [arg0] = args ?? [];
            if (typeof arg0 === 'string') {
                const sz = sizeOfTypeName(arg0 as CTypeName | string);
                if (sz !== undefined) return sz;
            }
            return 4;
        },

        __Symbol_exists(ctx: EvalContext, args: any[]): any {
            const [name] = args ?? [];
            if (typeof name !== 'string') return 0;
            return ctx.data.hasSymbol(name) ? 1 : 0; // 1/0 per original truthiness convention
        },
    };
}

/* --------------------------------------------------------------------------------
 * Helpers (kept local to avoid runtime cycles with the evaluator)
 * -------------------------------------------------------------------------------- */

function sizeOfTypeName(name: CTypeName | string): number | undefined {
    switch (name) {
        case 'uint8_t':
        case 'int8_t':
            return 1;
        case 'uint16_t':
        case 'int16_t':
            return 2;
        case 'uint32_t':
        case 'int32_t':
        case 'float':
            return 4;
        case 'uint64_t':
        case 'int64_t':
        case 'double':
            return 8;
        default:
            return undefined;
    }
}

function isColonPathLike(v: any): boolean {
    return !!(v && typeof v === 'object' && Array.isArray(v.__colonPath));
}

/* --------------------------------------------------------------------------------
 * Example: build a host with custom dummy behaviors
 * -------------------------------------------------------------------------------- */

// Usage example (not exported by default):
// export const intrinsics = createIntrinsicHost({
//   __GetRegVal(_ctx, [name]) {
//     const regs: Record<string, number> = { r0: 0, r1: 1, pc: 0x1000, sp: 0x8000 };
//     return typeof name === 'string' && name in regs ? regs[name] : 0xDEADBEEF;
//   },
//   __CalcMemUsed(ctx) {
//     // If your DataHost.stats() includes bytesUsed, the default already uses it.
//     // Otherwise, you can compute your own heuristic here.
//     const typeCount = (ctx as any).types?.size ?? 0;
//     const s = ctx.data.stats?.();
//     const base = s?.symbols != null ? s.symbols * 24 : 0;
//     return base + typeCount * 8;
//   },
//   __Offset_of(_ctx, [colonOrString]) {
//     const table: Record<string, number> = {
//       'Foo:bar': 0,
//       'Foo:baz': 4,
//       'Bar:qux': 8,
//     };
//     const key = Array.isArray(colonOrString?.__colonPath)
//       ? colonOrString.__colonPath.join(':')
//       : String(colonOrString ?? '');
//     return table[key] ?? 0;
//   },
// });
