/* =============================================================================
 * ScvdEvalInterface: DataHost implementation using ScvdBase only
 * - No ComponentViewer import / no local caches
 * - Resolution strictly via ScvdBase.getSymbol / getIndex
 * - readValue -> ScvdBase.getValue(), writeValue -> ScvdBase.setValue(number|string)
 * - Intrinsics implemented (default behaviors), __GetRegVal via registerCache
 * ============================================================================= */

import { DataHost, CTypeName, RefContainer } from './evaluator';
import { registerCache } from './scvd-cache-register';
import { ScvdBase } from './model/scvd-base';

export class ScvdEvalInterface implements DataHost {
    /** Optional function table you can populate from your model. */

    // =============================
    // ScvdBase-centric DataHost API
    // =============================

    /** Resolve a top-level symbol by name, relative to the given root container. */
    getSymbolRef(container: RefContainer, name: string, _forWrite?: boolean): ScvdBase | undefined {
        const symbol = container.base.getSymbol(name);
        if(symbol === undefined) {
            console.error(`ScvdEvalInterface: getSymbolRef: symbol '${name}' not found in root '${container.base.name}'`);
        }
        return symbol;
    }

    /** Resolve a property on a ScvdBase node. */
    getMemberRef(container: RefContainer, property: string, _forWrite?: boolean): ScvdBase | undefined {
        const member = container.base.getMember(property);
        if(member === undefined) {
            console.error(`ScvdEvalInterface: getMemberRef: member '${property}' not found in base '${container.base.name}'`);
        }
        return member;
    }

    /** Resolve an indexed child on a ScvdBase node (arrays/tuples/etc). */
    getIndexRef(container: RefContainer, index: number, _forWrite?: boolean): ScvdBase | undefined {
        return container.base.getIndexRef(index);
    }

    /** Read/write concrete value at a ScvdBase reference. */
    readValue(container: RefContainer): number | string | undefined {
        return container.base.getValue();
    }
    writeValue(container: RefContainer, value: number | string): number | string | undefined {
        return container.base.setValue(value);
    }

    // Optional hooks
    resolveColonPath(_container: RefContainer, _parts: string[]): ScvdBase | number | string | undefined {
        return undefined;
    }
    stats(): { symbols?: number; bytesUsed?: number } {
    // If your model can expose detailed stats, override this. Empty object satisfies the interface.
        return {};
    }

    // =====================
    // Intrinsics (DataHost)
    // =====================
    __CalcMemUsed(_container: RefContainer, _args: any[]): number {
        const s = this.stats?.();
        if (s?.bytesUsed != null) return s.bytesUsed;
        if (s?.symbols != null) return s.symbols * 16; // bytes-ish; tune for your domain
        return 0;
    }

    __FindSymbol(container: RefContainer, args: any[]): ScvdBase | undefined {
        const [name] = args ?? [];
        if (typeof name !== 'string') return undefined;
        const ref = container.base.getSymbol(name);
        return ref;
    }

    __GetRegVal(regName: string): number | undefined {
        return registerCache.readRegister(regName);
    }

    __Offset_of(_container: RefContainer, _args: any[]): number {
    // Domain-specific; return 0 by default.
        return 0;
    }

    __size_of(_container: RefContainer, args: any[]): number {
        const [arg0] = args ?? [];
        if (typeof arg0 === 'string') {
            const sz = sizeOfTypeName(arg0 as CTypeName | string);
            if (sz !== undefined) return sz;
        }
        return 4;
    }

    __Symbol_exists(container: RefContainer, args: any[]): number {
        const [name] = args ?? [];
        if (typeof name !== 'string') return 0;
        return container.base.getSymbol(name) ? 1 : 0;
    }
}

// ---- local helper for sizeof ----
function sizeOfTypeName(name: CTypeName | string): number | undefined {
    switch (name) {
        case 'uint8_t': case 'int8_t': return 1;
        case 'uint16_t': case 'int16_t': return 2;
        case 'uint32_t': case 'int32_t': case 'float': return 4;
        case 'uint64_t': case 'int64_t': case 'double': return 8;
        default: return undefined;
    }
}
