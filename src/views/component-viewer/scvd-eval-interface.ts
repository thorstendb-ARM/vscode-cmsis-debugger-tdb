// src/views/component-viewer/scvd-eval-interface.ts
// DataHost using EvalSymbolCache + Cm81MRegisterCache, with:
//  - per-instance virtual vars (auto-add on first use)
//  - optional auto-declare unknown globals on write
//  - module-level helpers to add/read globals without host reference

import { Cm81MRegisterCache } from './cache/register-cache';
import { DataHost, RefContainer } from './evaluator';
import { createMockCm81MRegisterReader } from './mock/cm81m-registers';
import { ScvdBase } from './model/scvd-base';
import { TargetRuntime, GdbClientSync, Symtab } from './cache/target-runtime';
import { CachedMemoryHost, HostOptions } from './cache/cache';

export class ScvdEvalInterface implements DataHost {
    private _registerCache = new Cm81MRegisterCache(createMockCm81MRegisterReader());
    private runtime: TargetRuntime;
    private memHost: CachedMemoryHost;

    constructor(
        gdb: GdbClientSync,
        symtab: Symtab,
        opts?: HostOptions
    ) {
        this.runtime = new TargetRuntime(gdb, symtab);
        this.memHost = new CachedMemoryHost(this.runtime, this.runtime, opts);
    }

    private get registerCache(): Cm81MRegisterCache {
        return this._registerCache;
    }

    // ---------------- DataHost Interface ----------------
    getSymbolRef(container: RefContainer, name: string, _forWrite?: boolean): ScvdBase | undefined {
        const symbol = container.base.getSymbol?.(name);
        return symbol;
    }

    getMemberRef(container: RefContainer, property: string): ScvdBase | undefined {
        const base = container.current;
        const member = base?.getMember(property);
        return member;
    }

    getElementStride(ref: ScvdBase): number {
        return ref.getElementStride() ?? 0;
    }

    getMemberOffset(base: ScvdBase, _member: ScvdBase): number {
        return base.getMemberOffset() ?? 0;
    }

    getBitWidth(ref: ScvdBase): number {
        return ref.getBitWidth() ?? 0;
    }

    getElementBitWidth(ref: ScvdBase): number {
        return ref.getElementBitWidth() ?? 0;
    }

    /* ---------------- Read/Write via caches ---------------- */
    readValue(container: RefContainer): number | string | bigint | undefined {
        const value = this.memHost.readValue(container);
        return value;
    }

    writeValue(container: RefContainer, value: number | string | bigint): any {
        this.memHost.writeValue(container, value);
        return value;
    }

    /* ---------------- Intrinsics ---------------- */

    __FindSymbol(_container: RefContainer, _args: unknown[]): ScvdBase | undefined {
        return undefined;   // will lookup per GDB
    }

    __GetRegVal(regName: string): number | undefined {
        return this.registerCache.read(regName); // read from register cache
    }

    __Symbol_exists(_container: RefContainer, _args: unknown[]): number {
        return 0;   // will lookup per GDB
    }

    __Running(): number | undefined { return 1; }

    _count(container: RefContainer): number | undefined {
        const base = container.current;
        return base?.getElementCount();
    }

    _addr(container: RefContainer): number | undefined {
        const base = container.current;
        return base?.getAddress();
    }
}
