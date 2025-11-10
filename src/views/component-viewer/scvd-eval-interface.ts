/* =============================================================================
 * ScvdEvalInterface: DataHost implementation using ScvdBase only
 * - No ComponentViewer import / no local caches
 * - Resolution strictly via ScvdBase.getSymbol / getIndex
 * - readValue -> ScvdBase.getValue(), writeValue -> ScvdBase.setValue(number|string)
 * - Intrinsics implemented (default behaviors), __GetRegVal via registerCache
 * ============================================================================= */

import { DataHost, RefContainer } from './evaluator';
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
        const member = container.current?.getMember(property);
        if(member === undefined) {
            console.error(`ScvdEvalInterface: getMemberRef: member '${property}' not found in base '${container.base.name}'`);
        }
        return member;
    }

    /*
     class for variables: name, value array, ...
    */
    /** Read/write concrete value at a ScvdBase reference. */
    readValue(container: RefContainer): number | string | undefined {
        return container.member?.getValue() ?? 1;
    }
    writeValue(container: RefContainer, value: number | string): number | string | undefined {
        return container.member?.setValue(value);
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
        console.log(`__size_of called with arg: ${arg0}`);
        return 4;
    }

    __Symbol_exists(container: RefContainer, args: any[]): number {
        const [name] = args ?? [];
        if (typeof name !== 'string') return 0;
        return container.base.getSymbol(name) ? 1 : 0;
    }

    __Running(): number | undefined {
        return 1;
    }

    // Pseudo-member evaluators used as obj._count / obj._addr; must return numbers
    _count(_container: RefContainer): number | undefined {
        return 1; //container.base.getNumOfElements();
    }

    _addr(_container: RefContainer): number | undefined {
        return 1; //container.base.getAddress();
    }

}

