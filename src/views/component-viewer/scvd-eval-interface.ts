// src/views/component-viewer/scvd-eval-interface.ts
// DataHost using EvalSymbolCache + Cm81MRegisterCache, with:
//  - per-instance virtual vars (auto-add on first use)
//  - optional auto-declare unknown globals on write
//  - module-level helpers to add/read globals without host reference

import type { DataHost, RefContainer } from './evaluator';
import type { ScvdBase } from './model/scvd-base';


export class ScvdEvalInterface implements DataHost {
    constructor(
    ) {
    }

    getSymbolRef(container: RefContainer, name: string, _forWrite?: boolean): ScvdBase | undefined {
        const symbol = container.base.getSymbol?.(name);
        return symbol;
    }

    getMemberRef(container: RefContainer, property: string): ScvdBase | undefined {
        const base = container.current;
        const member = base?.getMember?.(property);
        return member;
    }

    /* ---------------- Metadata (delegated to ScvdBase) ---------------- */

    getElementStride(ref: ScvdBase): number {
        return ref.getElementStride() ?? 0;
    }

    getMemberOffset(base: ScvdBase, member: ScvdBase): number {
        return base.getMemberOffset(member) ?? 0;
    }

    getBitWidth(ref: ScvdBase): number {
        return ref.getBitWidth() ?? 0;
    }

    getElementBitWidth(ref: ScvdBase): number {
        return ref.getElementBitWidth() ?? 0;
    }

    /* ---------------- Read/Write via caches ---------------- */

    readValue(_container: RefContainer): number | string | bigint | undefined {
        return 0;
    }

    writeValue(_container: RefContainer, _value: number | string | bigint): any {
        return 0;
    }

    /* ---------------- Intrinsics ---------------- */

    __FindSymbol(_container: RefContainer, _args: unknown[]): ScvdBase | undefined {
        return undefined;   // will lookup per GDB
    }

    __GetRegVal(_regName: string): number | undefined {
        return 0; //this.regs.read(regName); // read from register cache
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
