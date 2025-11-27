// src/views/component-viewer/scvd-eval-interface.ts
// DataHost using EvalSymbolCache + Cm81MRegisterCache, with:
//  - per-instance virtual vars (auto-add on first use)
//  - optional auto-declare unknown globals on write
//  - module-level helpers to add/read globals without host reference

import { DataHost, RefContainer } from './evaluator';
import { ScvdBase } from './model/scvd-base';
import { CachedMemoryHost } from './cache/cache';
import { Cm81MRegisterCache } from './cache/register-cache';
import { ScvdDebugTarget } from './model/scvd-debug-target';

export class ScvdEvalInterface implements DataHost {
    private _registerCache: Cm81MRegisterCache;
    private _memHost: CachedMemoryHost;
    private _debugTarget: ScvdDebugTarget;

    constructor(
        memHost: CachedMemoryHost,
        regHost: Cm81MRegisterCache,
        debugTarget: ScvdDebugTarget
    ) {
        this._memHost = memHost;
        this._registerCache = regHost;
        this._debugTarget = debugTarget;
    }

    private get registerCache(): Cm81MRegisterCache {
        return this._registerCache;
    }

    private get memHost(): CachedMemoryHost {
        return this._memHost;
    }

    private get debugTarget(): ScvdDebugTarget {
        return this._debugTarget;
    }

    // ---------------- DataHost Interface ----------------
    getSymbolRef(container: RefContainer, name: string, _forWrite?: boolean): ScvdBase | undefined {
        const symbol = container.base.getSymbol?.(name);
        return symbol;
    }

    getMemberRef(container: RefContainer, property: string, _forWrite?: boolean): ScvdBase | undefined {
        const base = container.current;
        return base?.getMember(property);
    }

    // getElementRef(ref: ScvdBase): ScvdBase | undefined {
    //     return ref.getElementRef(); // ref to type
    // }

    /*how far to move in memory to get from element i to element i+1.
      Returns bytes (the evaluator multiplies by 8 to get bits). Think: addressing step / spacing / pitch.
      Element bit width answers: “how many bits should I read/write for one element?”
    */
    getElementBitWidth(ref: ScvdBase): number {
        return this.getBitWidth(ref);
    }

    /* bytes per element (including any padding/alignment inside the array layout).
       how many bits of the current element are meaningful when reading/writing.
       Think: value width / mask size.
       Stride only answers: “how far do I move to get from element i to i+1?”
    */
    getElementStride(ref: ScvdBase): number {
        return ref.getElementStride() ?? 0;
    }

    getMemberOffset(_base: ScvdBase, member: ScvdBase): number {
        const offset = member.getMemberOffset() ?? 0;
        console.log(`getMemberOffset: base=${_base.getExplorerDisplayName()} member=${member.getExplorerDisplayName()} => ${offset}`);
        return offset;
    }

    /* width in bits of that node itself:
      - For scalars/structs/unions: their full bit width.
      - For arrays: either the total array width (count × stride × 8)
        if known, or leave it ambiguous. Do not return the element width for an array; that’s what getElementBitWidth is for.
    */
    getBitWidth(ref: ScvdBase): number {
        const size = ref.getSize();
        if(size !== undefined) {
            return size * 8;
        }
        console.error(`ScvdEvalInterface.getBitWidth: size undefined for ${ref.getExplorerDisplayName()}`);
        return 0;
    }

    /* ---------------- Read/Write via caches ---------------- */
    readValue(container: RefContainer): number | string | bigint | undefined {
        try {
            const value = this.memHost.readValue(container);
            return value;
        } catch (e) {
            console.error(`ScvdEvalInterface.readValue: exception for container with base=${container.base.getExplorerDisplayName()}: ${e}`);
            return undefined;
        }
    }

    writeValue(container: RefContainer, value: number | string | bigint): any {
        try {
            this.memHost.writeValue(container, value);
            return value;
        } catch (e) {
            console.error(`ScvdEvalInterface.writeValue: exception for container with base=${container.base.getExplorerDisplayName()}: ${e}`);
            return undefined;
        }
    }

    /* ---------------- Intrinsics ---------------- */

    __FindSymbol(symbolName: string): number | undefined {
        if (typeof symbolName === 'string') {
            const symbolAddress = this.debugTarget.findSymbolAddress(symbolName);
            return symbolAddress;
        }
        return undefined;
    }

    __GetRegVal(regName: string): number | undefined {
        return this.registerCache.read(regName); // read from register cache
    }

    __Symbol_exists(symbol: string): number | undefined {
        return this.debugTarget.findSymbolAddress(symbol) ? 1 : 0;
    }

    /* Returns
    A packed 32-bit integer value that indicates memory usage in bytes, in percent, and memory overflow:
    Bit 0..19 Used memory in Bytes (how many bytes of FillPattern are overwritten)
    Bit 20..28 Used memory in percent (how many percent of FillPattern are overwritten)
    Bit 31 Memory overflow (MagicValue is overwritten)
    */
    __CalcMemUsed(_args: number[]): number | undefined {
        const StackAddress: number = _args[0];
        const StackSize: number = _args[1];
        const FillPattern: number = _args[2];
        const MagicValue: number = _args[3];
        const memUsed = this.debugTarget.calculateMemoryUsage(
            StackAddress,
            StackSize,
            FillPattern,
            MagicValue
        );
        return memUsed;
    }

    __size_of(symbol: string): number | undefined {
        const symbolRef = this.debugTarget.getSymbolInfo(symbol);
        if (symbolRef) {
            const size = symbolRef.size;
            return size;
        }
        return undefined;
    }

    __Offset_of(container: RefContainer, typedefMember: string): number | undefined {
        const memberRef = container.base.getMember(typedefMember);
        if (memberRef) {
            const offset = memberRef.getMemberOffset();
            return offset;
        }
        return undefined;
    }

    __Running(): number | undefined {
        return 1;
    }

    _count(container: RefContainer): number | undefined {
        const base = container.current;
        return base?.getElementCount();
    }

    _addr(container: RefContainer): number | undefined {
        const base = container.current;
        return base?.getAddress();
    }
}
