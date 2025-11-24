// src/views/component-viewer/scvd-eval-interface.ts
// DataHost using EvalSymbolCache + Cm81MRegisterCache, with:
//  - per-instance virtual vars (auto-add on first use)
//  - optional auto-declare unknown globals on write
//  - module-level helpers to add/read globals without host reference

import { DataHost, RefContainer } from './evaluator';
import { ScvdBase } from './model/scvd-base';
import { CachedMemoryHost } from './cache/cache';
import { Cm81MRegisterCache } from './cache/register-cache';

export class ScvdEvalInterface implements DataHost {
    private _registerCache: Cm81MRegisterCache;
    private _memHost: CachedMemoryHost;

    constructor(
        memHost: CachedMemoryHost,
        regHost: Cm81MRegisterCache
    ) {
        this._memHost = memHost;
        this._registerCache = regHost;
    }

    private get registerCache(): Cm81MRegisterCache {
        return this._registerCache;
    }

    private get memHost(): CachedMemoryHost {
        return this._memHost;
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

    getMemberOffset(_base: ScvdBase, member: ScvdBase): number {
        const offset = member.getMemberOffset() ?? 0;
        console.log(`ScvdEvalInterface.getMemberOffset: base=${_base.getExplorerDisplayName()}, member=${member.getExplorerDisplayName()} => offset=${offset}`);
        return offset;
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
