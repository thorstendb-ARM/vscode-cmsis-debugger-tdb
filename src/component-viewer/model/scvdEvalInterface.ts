/* =============================================================================
 * ScvdEvalInterface: Extend this to adapt your model (with DataHost intrinsics)
 * ============================================================================= */

import { CTypeName, DataHost, ExternalFunctions } from '../evaluator';
import { registerCache } from '../ScvdCacheRegister';
import { ScvdBase } from './scvdBase';
import { ScvdComponentViewer } from './scvdComonentViewer';

/* --------------------------------------------------------------------------------
 * Helpers (kept local to avoid runtime cycles with the evaluator)
 * -------------------------------------------------------------------------------- */

function sizeOfTypeName(name: CTypeName | string): number | undefined {
    switch (name) {
        case 'uint8_t':
        case 'int8_t':
            return 1;
        case 'uint16_t':
        case 'int16_t':
            return 2;
        case 'uint32_t':
        case 'int32_t':
        case 'float':
            return 4;
        case 'uint64_t':
        case 'int64_t':
        case 'double':
            return 8;
        default:
            return undefined;
    }
}

function isColonPathLike(v: any): boolean {
    return !!(v && typeof v === 'object' && Array.isArray(v.__colonPath));
}


/**
 * Extend this class to connect the evaluator to your data model.
 * - Override `peekModel` / `commitModel` to map top-level identifiers.
 * - Optionally override `resolveColonPath` to support `reg:PC`, `mem:0x1000`, etc.
 * - Override container methods if you expose custom container types.
 * - Intrinsics are implemented here so the evaluator can call them via DataHost.
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

    /** Return the bound symbol wrapper from your model (or `undefined` if unknown). */
    protected peekModel(name: string): ScvdBase | undefined {
        const model = ScvdComponentViewer.castTo(this);
        if (!model) {
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
        if (cachedSym) {
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
   * Return `undefined` to signal "not handled" (the evaluator will carry the token).
   */
    resolveColonPath?(_parts: string[]): any;

    // =====================
    // Intrinsics (DataHost)
    // =====================
    /** Prefer providing these directly. The evaluator will call them via `EvalPointCall`. */
    __CalcMemUsed(_container: any, _args: any[]): any {
        //const s = this.stats?.();
        //if (s?.bytesUsed != null) return s.bytesUsed;
        //if (s?.symbols != null) return s.symbols * 16; // bytes-ish; tune for your domain
        return 0;
    }

    __FindSymbol(_container: any, args: any[]): any {
        const [name] = args ?? [];
        if (typeof name !== 'string') return 0;
        // Spec: auto-create unknown identifiers with value 0 on first touch.
        if (!this.hasSymbol(name)) this.writeSymbol(name, 0);
        return this.readSymbol(name) ?? 0;
    }

    __GetRegVal(_container: any, args: any[]): any {
        const [regName] = args ?? [];
        if (typeof regName === 'string' && regName) {
            // Bridge to your register cache; customize as needed.
            return registerCache.readRegister(regName);
        }
        return 0;
    }

    __Offset_of(_container: any, args: any[]): any {
        const [what] = args ?? [];
        if (isColonPathLike(what) || typeof what === 'string') return 0;
        return 0;
    }

    __size_of(_container: any, args: any[]): any {
        const [arg0] = args ?? [];
        if (typeof arg0 === 'string') {
            const sz = sizeOfTypeName(arg0 as CTypeName | string);
            if (sz !== undefined) return sz;
        }
        return 4;
    }

    __Symbol_exists(_container: any, args: any[]): any {
        const [name] = args ?? [];
        if (typeof name !== 'string') return 0;
        return this.hasSymbol(name) ? 1 : 0; // 1/0 per original truthiness convention
    }
}


/**
 * Demo subclass you can start from:
 *   export class ScvdBase extends ScvdEvalInterface { ... }
 */
/*
export class ScvdBaseImpl extends ScvdEvalInterface {
  constructor(
    public model: {
      symbols?: Record<string, any>;
      regs?: Record<string, number | bigint>;
      mem?: Uint8Array | number[];
    } = {}
  ) { super(); }

  protected peekModel(name: string) {
    // Example strategy: prefer registers if they live as top-level symbols, then "symbols" bag
    if (this.model.regs && name in this.model.regs) return this.model.regs[name] as any;
    return (this.model.symbols?.[name] as any) ?? undefined;
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
