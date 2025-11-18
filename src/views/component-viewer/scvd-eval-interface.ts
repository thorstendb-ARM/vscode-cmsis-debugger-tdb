// src/views/component-viewer/scvd-eval-interface.ts
// DataHost using EvalSymbolCache + Cm81MRegisterCache, with:
//  - per-instance virtual vars (auto-add on first use)
//  - optional auto-declare unknown globals on write
//  - module-level helpers to add/read globals without host reference

import type { DataHost, RefContainer } from './evaluator';
import type { ScvdBase } from './model/scvd-base';
import { ScvdVar } from './model/scvd-var';
import { EvalSymbolCache } from './eval-symbol-cache';
import { Cm81MRegisterCache, createMockCm81MRegisterReader } from './cm81m-registers';
import type { VarInitHook } from './var-init-callback';

export type DeclareGlobalFn = (base: ScvdBase, name: string) => ScvdVar | undefined;

/* ---------------- internal helpers ---------------- */

function widthBytesFrom(container: RefContainer, host: ScvdEvalInterface, ref: ScvdBase): 1 | 2 | 4 {
    const bits: number = (container.widthBits ?? (host.getBitWidth(ref) ?? 0)) | 0;
    const w = Math.max(1, Math.ceil(bits / 8));
    return (w === 1 || w === 2 || w === 4) ? (w as 1 | 2 | 4) : 4;
}
function isTopLevelVar(container: RefContainer): boolean {
    return !!(container.current && container.anchor === container.current);
}

/* ========================================================================== */
/*                               MAIN HOST                                    */
/* ========================================================================== */

export class ScvdEvalInterface implements DataHost {
    readonly cache = new EvalSymbolCache();
    readonly regs: Cm81MRegisterCache;

    private ensureVarsOnAccess: boolean;
    private varInit: VarInitHook | undefined;

    private autoDeclareGlobalsOnWrite: boolean;
    private declareGlobal: DeclareGlobalFn | undefined;

    constructor(init?: {
    targetSymbols?: Array<{ name: string; totalSize: number; readChunk: (off: number, len: number) => Uint8Array; chunkSize?: number }>;
    globalVars?: Record<string, number>;
    readRegister?: (name: string) => number | undefined;
    ensureVarsOnAccess?: boolean;       // default: true
    varInit?: VarInitHook;
    autoDeclareGlobalsOnWrite?: boolean; // default: false
    declareGlobal?: DeclareGlobalFn;
  }) {
        init?.targetSymbols?.forEach(s => this.cache.addTargetSymbol(s.name, s.totalSize, s.readChunk, s.chunkSize));
        if (init?.globalVars) for (const [k, v] of Object.entries(init.globalVars)) this.cache.addGlobalVar(k, v);

        this.regs = new Cm81MRegisterCache(init?.readRegister ?? createMockCm81MRegisterReader());
        this.ensureVarsOnAccess = init?.ensureVarsOnAccess ?? true;
        this.varInit = init?.varInit;

        this.autoDeclareGlobalsOnWrite = init?.autoDeclareGlobalsOnWrite ?? false;
        this.declareGlobal = init?.declareGlobal;
    }

    /* ---------------- public utility for statement engines ---------------- */

    /** Ensure a top-level ScvdVar symbol exists in the model and seed the cache. */
    ensureGlobalSymbol(base: ScvdBase, name: string, initial?: number): ScvdVar | undefined {
        const existing = (base as any).getSymbol?.(name) as ScvdVar | undefined;
        if (existing) {
            if (initial !== undefined) this.cache.vars.ensureGlobal(name, initial >>> 0);
            return existing;
        }
        if (!this.declareGlobal) return undefined;
        const created = this.declareGlobal(base, name);
        if (created) {
            const seed = (initial !== undefined)
                ? initial
                : (this.varInit?.({ kind: 'global', container: { base } as any, anchor: created, symbolName: name, varName: name }) ?? 0);
            this.cache.vars.ensureGlobal(name, (Number(seed) >>> 0));
        }
        return created;
    }

    /* ---------------- Resolution (DataHost) ---------------- */

    getSymbolRef(container: RefContainer, name: string, forWrite?: boolean): ScvdBase | undefined {
        let symbol = (container.base as any).getSymbol?.(name) as ScvdVar | undefined;

        // Auto-declare unknown globals on write if configured
        if (!symbol && forWrite && this.autoDeclareGlobalsOnWrite && this.declareGlobal) {
            const created = this.declareGlobal(container.base, name);
            if (created) {
                const seed = this.varInit?.({
                    kind: 'global', container, anchor: created, symbolName: name, varName: name
                }) ?? 0;
                this.cache.vars.ensureGlobal(name, (Number(seed) >>> 0));
                symbol = created;
            }
        }

        if (symbol) container.current = symbol;
        return symbol;
    }

    getMemberRef(container: RefContainer, property: string): ScvdBase | undefined {
        const base = container.current;
        if (!base) return undefined;

        // Try direct member
        let m = (base as any).getMember?.(property) as ScvdBase | undefined;

        // If base is an array-like, try element type's member
        if (!m) {
            const elem = (base as any).getElementRef?.()
        || (base as any).getElementType?.()
        || (base as any).getElementPrototype?.();
            if (elem) m = (elem as any).getMember?.(property);
        }

        if (m) container.current = m;
        return m;
    }

    /* ---------------- Metadata (delegated to ScvdBase) ---------------- */

    getElementStride(ref: ScvdBase): number { return (ref as any).getElementStride?.() ?? 0; }
    getMemberOffset(base: ScvdBase, member: ScvdBase): number { return (base as any).getMemberOffset?.(member) ?? 0; }
    getBitWidth(ref: ScvdBase): number { return (ref as any).getBitWidth?.() ?? 0; }
    getElementBitWidth(ref: ScvdBase): number { return (ref as any).getElementBitWidth?.() ?? 0; }

    /* ---------------- Read/Write via caches ---------------- */

    readValue(container: RefContainer): number | string | bigint | undefined {
        const anchor: ScvdBase | undefined = container.anchor ?? container.current;
        if (!anchor) return undefined;

        const symName = (anchor as any)?.name as string | undefined;
        if (!symName) return undefined;

        const member = container.member;

        // Virtual member var (per-instance)
        if (member instanceof ScvdVar) {
            const varName = (member as any).name as string | undefined;
            if (!varName) return undefined;
            const byteOffset = container.offsetBytes ?? 0;

            if (this.ensureVarsOnAccess && !this.cache.vars.hasBound(symName, byteOffset, varName)) {
                const initVal = this.varInit?.({
                    kind: 'bound', container, anchor, member: member as ScvdVar,
                    symbolName: symName, byteOffset, varName,
                });
                this.cache.vars.ensureBound(symName, byteOffset, varName, (initVal === undefined ? 0 : Number(initVal)) >>> 0);
            }
            return this.cache.vars.readBound(symName, byteOffset, varName);
        }

        // Top-level helper var (global)
        if (isTopLevelVar(container) && (container.current instanceof ScvdVar)) {
            const varName = (container.current as any).name as string | undefined;
            if (!varName) return undefined;
            if (this.ensureVarsOnAccess && !this.cache.vars.hasGlobal(varName)) {
                const initVal = this.varInit?.({
                    kind: 'global', container, anchor, symbolName: symName, varName,
                });
                this.cache.vars.ensureGlobal(varName, (initVal === undefined ? 0 : Number(initVal)) >>> 0);
            }
            return this.cache.vars.readGlobal(varName);
        }

        // Memory-backed target read
        const width = widthBytesFrom(container, this, anchor);
        const off = container.offsetBytes ?? 0;
        return this.cache.target.readUint(symName, off, width);
    }

    writeValue(container: RefContainer, value: number | string | bigint): any {
        const anchor: ScvdBase | undefined = container.anchor ?? container.current;
        if (!anchor) return undefined;

        const symName = (anchor as any)?.name as string | undefined;
        if (!symName) return undefined;

        const member = container.member;

        // Virtual member var (per-instance)
        if (member instanceof ScvdVar) {
            const varName = (member as any).name as string | undefined;
            if (!varName) return undefined;
            const byteOffset = container.offsetBytes ?? 0;

            if (this.ensureVarsOnAccess && !this.cache.vars.hasBound(symName, byteOffset, varName)) {
                const initVal = this.varInit?.({
                    kind: 'bound', container, anchor, member: member as ScvdVar,
                    symbolName: symName, byteOffset, varName,
                });
                this.cache.vars.ensureBound(symName, byteOffset, varName, (initVal === undefined ? 0 : Number(initVal)) >>> 0);
            }
            const ok = this.cache.vars.writeBound(symName, byteOffset, varName, Number(value));
            return ok ? value : undefined;
        }

        // Top-level helper var (global)
        if (isTopLevelVar(container) && (container.current instanceof ScvdVar)) {
            const varName = (container.current as any).name as string | undefined;
            if (!varName) return undefined;
            if (this.ensureVarsOnAccess && !this.cache.vars.hasGlobal(varName)) {
                const initVal = this.varInit?.({
                    kind: 'global', container, anchor, symbolName: symName, varName,
                });
                this.cache.vars.ensureGlobal(varName, (initVal === undefined ? 0 : Number(initVal)) >>> 0);
            }
            const ok = this.cache.vars.writeGlobal(varName, Number(value));
            return ok ? value : undefined;
        }

        // Memory-backed target write
        const width = widthBytesFrom(container, this, anchor);
        const off = container.offsetBytes ?? 0;
        const ok = this.cache.target.writeUint(symName, off, width, Number(value));
        return ok ? value : undefined;
    }

    /* ---------------- Intrinsics ---------------- */

    __FindSymbol(container: RefContainer, args: unknown[]): ScvdBase | undefined {
        const a = args as unknown[];
        const name = (a && typeof a[0] === 'string') ? (a[0] as string) : undefined;
        if (!name) return undefined;
        return (container.base as any).getSymbol?.(name) ?? undefined;
    }

    __GetRegVal(regName: string): number | undefined {
        return this.regs.read(regName);
    }

    __Symbol_exists(container: RefContainer, args: unknown[]): number {
        const a = args as unknown[];
        const name = (a && typeof a[0] === 'string') ? (a[0] as string) : undefined;
        if (!name) return 0;
        return (container.base as any).getSymbol?.(name) ? 1 : 0;
    }

    __Running(): number | undefined { return 1; }
}

/* ========================================================================== */
/*                     MODULE-LEVEL GLOBAL HELPERS                            */
/*  Use these when you DON'T have a host reference in scope.                  */
/*  Make sure to call setActiveEvalHost(...) once during app boot.            */
/* ========================================================================== */

let ACTIVE_EVAL_HOST: ScvdEvalInterface | undefined;

/** Register the active eval host (call once during app bootstrap). */
export function setActiveEvalHost(host: ScvdEvalInterface): void {
    ACTIVE_EVAL_HOST = host;
}

/** Ensure a global symbol exists in the model and seed its value. */
export function ensureGlobalVar(base: ScvdBase, name: string, initial?: number): ScvdVar | undefined {
    const h = ACTIVE_EVAL_HOST;
    if (!h) throw new Error('Active eval host not set. Call setActiveEvalHost(...) first.');
    return h.ensureGlobalSymbol(base, name, initial);
}

/** Set or seed the global value in the cache (symbol should already exist). */
export function setGlobalValue(name: string, value: number): void {
    const h = ACTIVE_EVAL_HOST;
    if (!h) throw new Error('Active eval host not set. Call setActiveEvalHost(...) first.');
    h.cache.vars.ensureGlobal(name, value >>> 0);
}

/** Read a global value from the cache. */
export function getGlobalValue(name: string): number | undefined {
    const h = ACTIVE_EVAL_HOST;
    if (!h) throw new Error('Active eval host not set. Call setActiveEvalHost(...) first.');
    return h.cache.vars.readGlobal(name);
}
