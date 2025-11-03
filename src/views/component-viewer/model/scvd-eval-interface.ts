/* =============================================================================
 * ScvdEvalInterface: DataHost implementation using ScvdBase only
 * - No ComponentViewer import / no local caches
 * - Resolution strictly via ScvdBase.getSymbol / getIndex
 * - readValue -> ScvdBase.getValue(), writeValue -> ScvdBase.setValue(number|string)
 * - Intrinsics implemented (default behaviors), __GetRegVal via registerCache
 * ============================================================================= */

import { DataHost, CTypeName } from '../evaluator';
import { registerCache } from '../scvd-cache-register';
import { ScvdBase } from './scvd-base';

export class ScvdEvalInterface implements DataHost {
    /** Optional function table you can populate from your model. */

    // =============================
    // ScvdBase-centric DataHost API
    // =============================

    /** Resolve a top-level symbol by name, relative to the given root container. */
    getSymbolRef(root: ScvdBase, name: string, _forWrite?: boolean): ScvdBase | undefined {
        return root.getSymbol(name);
    }

    /** Resolve a property on a ScvdBase node. */
    getMemberRef(base: ScvdBase, property: string, _forWrite?: boolean): ScvdBase | undefined {
        return base.getSymbol(property);
    }

    /** Resolve an indexed child on a ScvdBase node (arrays/tuples/etc). */
    getIndexRef(base: ScvdBase, index: number, _forWrite?: boolean): ScvdBase | undefined {
        return base.getIndexRef(index);
    }

    /** Read/write concrete value at a ScvdBase reference. */
    readValue(ref: ScvdBase): number | string | undefined {
        return ref.getValue();
    }
    writeValue(ref: ScvdBase, value: number | string): number | string | undefined {
        return ref.setValue(value);
    }

    // Optional hooks
    resolveColonPath(_root: ScvdBase, _parts: string[]): ScvdBase | number | string | undefined {
        return undefined;
    }
    stats(): { symbols?: number; bytesUsed?: number } {
    // If your model can expose detailed stats, override this. Empty object satisfies the interface.
        return {};
    }

    // =====================
    // Intrinsics (DataHost)
    // =====================
    __CalcMemUsed(_root: ScvdBase, _args: any[]): number {
        const s = this.stats?.();
        if (s?.bytesUsed != null) return s.bytesUsed;
        if (s?.symbols != null) return s.symbols * 16; // bytes-ish; tune for your domain
        return 0;
    }

    __FindSymbol(root: ScvdBase, args: any[]): number | string | undefined {
        const [name] = args ?? [];
        if (typeof name !== 'string') return undefined;
        const ref = root.getSymbol(name);
        return ref !== undefined ? this.readValue(ref) : undefined; // <- no 0 fallback
    }

    __GetRegVal(_root: ScvdBase, args: any[]): number | bigint | undefined {
        const [regName] = args ?? [];
        if (typeof regName === 'string' && regName) {
            return registerCache.readRegister(regName);
        }
        return undefined;
    }

    __Offset_of(_root: ScvdBase, _args: any[]): number {
    // Domain-specific; return 0 by default.
        return 0;
    }

    __size_of(_root: ScvdBase, args: any[]): number {
        const [arg0] = args ?? [];
        if (typeof arg0 === 'string') {
            const sz = sizeOfTypeName(arg0 as CTypeName | string);
            if (sz !== undefined) return sz;
        }
        return 4;
    }

    __Symbol_exists(root: ScvdBase, args: any[]): number {
        const [name] = args ?? [];
        if (typeof name !== 'string') return 0;
        return root.getSymbol(name) ? 1 : 0;
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
