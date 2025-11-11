/* =============================================================================
 * ScvdEvalInterface: DataHost implementation for the offset-first evaluator
 * - Works with the updated evaluator that accumulates anchor/offset/width
 * - No legacy fallback: reads/writes are performed via (anchor, offsetBytes, widthBytes)
 * - No unsafe casts in implementation logic
 * - Assumes ScvdBase exposes the required primitives:
 *     getSymbol(name), getMember(prop), getAddress(),
 *     getElementStride(), getMemberOffset(child),
 *     getBitWidth(), getElementBitWidth(), getSize(), getElementCount(),
 *     readAt(byteOffset, widthBits), writeAt(byteOffset, widthBits, value),
 *     getValue(), setValue(value)
 * ============================================================================= */

import { DataHost, RefContainer } from './evaluator';
import { registerCache } from './scvd-cache-register';
import { ScvdBase } from './model/scvd-base';

export class ScvdEvalInterface implements DataHost {
    /* =============================
   * Resolution (symbol/member)
   * ============================= */

    getSymbolRef(container: RefContainer, name: string, _forWrite?: boolean): ScvdBase | undefined {
        console.log(`GetSymbolRef: name=${name}, base=${container.base?.getExplorerDisplayName()}`);
        const symbol = container.base.getSymbol(name);
        return symbol;
    }

    getMemberRef(container: RefContainer, property: string, _forWrite?: boolean): ScvdBase | undefined {
        console.log(`GetMemberRef: property=${property}, current=${container.current?.getExplorerDisplayName()}`);
        const base: ScvdBase | undefined = container.current;
        if (!base) return undefined;
        const member = base.getMember(property);
        return member;
    }

    /* =============================
   * Metadata (used by evaluator to build offsets)
   * ============================= */

    // the byte step from arr[i] to arr[i+1] (often sizeof(TCB), but it can be larger if there are hardware gaps)
    // Width = how many bits to read, Stride = how far to jump for the next element.
    getElementStride(ref: ScvdBase): number {
        console.log(`GetElementStride: item=${ref.getExplorerDisplayName()}`);
        return ref.getElementStride();
    }

    getMemberOffset(base: ScvdBase, member: ScvdBase): number {
        console.log(`GetMemberOffset: base=${base.getExplorerDisplayName()}, member=${member.getExplorerDisplayName()}`);
        return base.getMemberOffset(member);
    }

    getBitWidth(ref: ScvdBase): number {
        console.log(`GetBitWidth: item=${ref.getExplorerDisplayName()}`);
        return ref.getBitWidth();
    }

    getElementBitWidth(ref: ScvdBase): number {
        console.log(`GetElementBitWidth: item=${ref.getExplorerDisplayName()}`);
        return ref.getElementBitWidth();
    }

    /* =============================
   * Read / Write (anchor + offsetBytes + widthBytes)
   * ============================= */

    readValue(container: RefContainer): number | string | bigint | undefined {
        console.log(`ReadValue: anchor=${container.anchor?.getExplorerDisplayName()}, offsetBytes=${container.offsetBytes}, widthBits=${container.widthBits}`);
        // Require an anchor (top-level symbol) established by the evaluator
        const anchor: ScvdBase | undefined = container.anchor ?? container.current;
        if (!anchor) return undefined;

        const byteOffset: number = container.offsetBytes ?? 0;
        // Prefer explicit widthBits from evaluator; convert to bytes. Otherwise derive from anchor.
        const widthBytes: number = container.widthBits !== undefined
            ? Math.max(1, Math.ceil(container.widthBits / 8))
            : Math.max(1, Math.ceil(anchor.getBitWidth() / 8));

        const widthBits = widthBytes * 8;
        return anchor.readAt(byteOffset, widthBits);
    }

    writeValue(container: RefContainer, value: number | string | bigint): number | string | bigint | undefined {
        console.log(`WriteValue: anchor=${container.anchor?.getExplorerDisplayName()}, offsetBytes=${container.offsetBytes}, widthBits=${container.widthBits}, value=${value}`);
        const anchor: ScvdBase | undefined = container.anchor ?? container.current;
        if (!anchor) return undefined;

        const byteOffset: number = container.offsetBytes ?? 0;
        const widthBytes: number = container.widthBits !== undefined
            ? Math.max(1, Math.ceil(container.widthBits / 8))
            : Math.max(1, Math.ceil(anchor.getBitWidth() / 8));

        const widthBits = widthBytes * 8;
        return anchor.writeAt(byteOffset, widthBits, value);
    }

    /* =============================
   * Optional hooks
   * ============================= */

    resolveColonPath(_container: RefContainer, _parts: string[]): ScvdBase | number | string | undefined {
        return undefined;
    }

    stats(): { symbols?: number; bytesUsed?: number } {
    // If your model can expose detailed stats, override this. Empty object satisfies the interface.
        return {};
    }

    /* =============================
   * Intrinsics (DataHost)
   * ============================= */

    __CalcMemUsed(_container: RefContainer, _args: unknown[]): number {
        const s = this.stats?.();
        if (s?.bytesUsed != null) return s.bytesUsed;
        if (s?.symbols != null) return s.symbols * 16; // heuristic fallback
        return 0;
    }

    __FindSymbol(container: RefContainer, args: unknown[]): ScvdBase | undefined {
        const [name] = args as [unknown?];
        if (typeof name !== 'string') return undefined;
        const ref = container.base.getSymbol(name);
        return ref;
    }

    __GetRegVal(regName: string): number | undefined {
        return registerCache.readRegister(regName);
    }

    __Offset_of(container: RefContainer, args: unknown[]): number {
    // If called as __Offset_of("member") with current set to a struct base
        const [memberName] = args as [unknown?];
        if (typeof memberName === 'string' && container.current) {
            const member = container.current.getMember(memberName);
            return container.current.getMemberOffset(member);
        }
        return 0;
    }

    __size_of(container: RefContainer, _args: unknown[]): number {
    // Return size in bytes
        if (container.member) return Math.ceil(container.member.getBitWidth() / 8);
        if (container.current) return Math.ceil(container.current.getBitWidth() / 8);
        return 0;
    }

    __Symbol_exists(container: RefContainer, args: unknown[]): number {
        const [name] = args as [unknown?];
        if (typeof name !== 'string') return 0;
        return container.base.getSymbol(name) ? 1 : 0;
    }

    __Running(): number | undefined {
        return 1; // domain-specific: 1 = running, 0 = halted
    }

    // Counts the number of items in readlist and read elements.
    _count(container: RefContainer): number | undefined {
        const target: ScvdBase | undefined = container.current ?? container.anchor;
        if (!target) return undefined;
        return target.getElementCount();
    }

    // Returns the memory address of a readlist member.
    _addr(container: RefContainer): number | undefined {
        const anchor: ScvdBase | undefined = container.anchor ?? container.current;
        if (!anchor) return undefined;
        const base = anchor.getAddress();
        return base ?? undefined;
    }
}
