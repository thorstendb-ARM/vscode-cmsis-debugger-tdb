/* =============================================================================
 * ScvdEvalInterface: Extend this to adapt your model
 * ============================================================================= */

import { DataHost, ExternalFunctions } from '../evaluator';
import { ScvdBase } from './scvdBase';
import { ScvdComponentViewer } from './scvdComonentViewer';

/**
 * Extend this class to connect the evaluator to your data model.
 * - Override `peekModel` / `commitModel` to map top-level identifiers.
 * - Optionally override `resolveColonPath` to support `reg:PC`, `mem:0x1000`, etc.
 * - Override container methods if you expose custom container types.
 */
export abstract class ScvdEvalInterface implements DataHost {
    /** Local symbol cache (mirrors model when you choose to). */
    protected symbols = new Map<string, ScvdBase>();

    /** Optional function table you can populate from your model. */
    functions: ExternalFunctions = Object.create(null);


    // ---- DataHost: symbols ----
    hasSymbol(name: string): boolean {
        return this.cacheSymbol(name) !== undefined;
    }

    readSymbol(name: string): any | undefined {
        const symbol = this.cacheSymbol(name);
        return symbol?.getValue() ?? undefined;
    }

    writeSymbol(name: string, value: any): any {
        const symbol = this.cacheSymbol(name);
        return symbol?.setValue(value) ?? undefined;
    }

    // ---- DataHost: containers (override if you expose custom containers) ----
    isContainer(v: any): boolean {
        return typeof v === 'object' && v !== null;
    }
    isArray(v: any): boolean {
        return Array.isArray(v);
    }
    makeObject(): any {
        return {};
    }
    makeArray(): any {
        return [];
    }

    readKey(container: any, key: any): any | undefined {
        if (typeof container === 'object' && container !== null) {
            // Default: plain object/array access
            return (container as any)[this.isArray(container) ? (Number(key) | 0) : key];
        }
        return undefined;
    }

    writeKey(container: any, key: any, value: any): any {
        if (typeof container === 'object' && container !== null) {
            (container as any)[this.isArray(container) ? (Number(key) | 0) : key] = value;
            return value;
        }
        throw new Error('writeKey on non-container');
    }

    stats() {
        return { symbols: this.symbols.size };
    }

    // ---- Hooks you should override in your subclass ----

    /** Return the current value of a symbol from your model (or `undefined` if unknown). */

    protected peekModel(name: string): ScvdBase | undefined {
        const model = ScvdComponentViewer.castTo(this);
        if(!model) {
            return undefined;
        }

        return model.getVar(name);
    }

    /** Persist a symbol back into your model (no-op by default). */
    protected commitModel(_name: string, _value: any): void {
        /* no-op */
    }

    private cacheSymbol(name: string): ScvdBase | undefined {
        const cachedSym = this.symbols.get(name);
        if(cachedSym) {
            return cachedSym;
        }
        const newSym = this.peekModel(name);
        if (newSym !== undefined) {
            this.symbols.set(name, newSym);
        }
        return newSym;
    }

    /**
   * Optional: Resolve colon-paths like `reg:PC` or `mem:0x1000`.
   * Return `undefined` to signal "not handled".
   */
    resolveColonPath?(_parts: string[]): any;

    // Model evaluation functions

}


/**
 * Demo subclass you can start from:
 *   export class ScvdBase extends ScvdEvalInterface { ... }
 */
/*
export class ScvdBase extends ScvdEvalInterface {
    constructor(
    public model: {
      symbols?: Record<string, any>;
      regs?: Record<string, number | bigint>;
      mem?: Uint8Array | number[];
    } = {}
    ) { super(); }

    protected peekModel(name: string) {
    // Example strategy: prefer registers if they live as top-level symbols, then "symbols" bag
        if (this.model.regs && name in this.model.regs) return this.model.regs[name];
        return this.model.symbols?.[name];
    }

    protected commitModel(name: string, value: any) {
    // Example: write back to a "symbols" bag (leave regs read-only by default)
        if (!this.model.symbols) this.model.symbols = {};
        this.model.symbols[name] = value;
    }

    override readKey(container: any, key: any) {
    // Example: allow random access to a `mem` container
        if (container === this.model.mem && this.model.mem) {
            const idx = (asNumber(key) | 0) >>> 0;
            return (this.model.mem as any)[idx] ?? 0;
        }
        return super.readKey(container, key);
    }

    override writeKey(container: any, key: any, value: any) {
        if (container === this.model.mem && this.model.mem) {
            const idx = (asNumber(key) | 0) >>> 0;
            (this.model.mem as any)[idx] = asNumber(value) | 0;
            return value;
        }
        return super.writeKey(container, key, value);
    }

    override resolveColonPath(parts: string[]) {
    // Demo mappings:
    //   reg:NAME   -> model.regs[NAME] ?? 0
    //   sym:NAME   -> model.symbols[NAME] ?? 0
    //   mem:INDEX  -> model.mem[INDEX]   ?? 0
        const [root, p1] = parts;
        if (root === 'reg' && p1) return this.model.regs?.[p1] ?? 0;
        if (root === 'sym' && p1) return this.model.symbols?.[p1] ?? 0;
        if (root === 'mem' && p1) {
            const idx = (asNumber(p1) | 0) >>> 0;
            const arr: any = this.model.mem;
            return arr ? (arr[idx] ?? 0) : 0;
        }
        return undefined;
    }
}
*/
