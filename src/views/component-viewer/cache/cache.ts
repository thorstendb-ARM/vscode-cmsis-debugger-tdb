// cache.ts

import { RefContainer } from '../evaluator';

/** Entry stored in the symbol cache. */
export interface SymbolEntry {
  name: string;
  valid: boolean;
  data: MemoryContainer;
}

export class SymbolCache {
    private map = new Map<string, SymbolEntry>();
    constructor(private makeContainer: (name: string) => MemoryContainer) {}

    getSymbol(name: string): SymbolEntry {
        let entry = this.map.get(name);
        if (!entry) {
            entry = { name, valid: false, data: this.makeContainer(name) };
            this.map.set(name, entry);
        }
        return entry;
    }

    /** Remove a symbol from the cache.
     *  Returns true if an entry existed and was removed; false otherwise.
     *  Attempts to dispose the underlying MemoryContainer if it supports it.
     */
    removeSymbol(name: string): boolean {
        const entry = this.map.get(name);
        if (!entry) return false;

        // Best-effort cleanup of the backing container (optional)
        const maybe = entry.data as unknown as {
            dispose?: () => void;
            free?: () => void;
            clear?: () => void;
        };
        try {
            if (typeof maybe?.dispose === 'function') maybe.dispose();
            else if (typeof maybe?.free === 'function') maybe.free();
            else if (typeof maybe?.clear === 'function') maybe.clear();
        } catch {
            // ignore cleanup errors but still remove from the map
        }

        this.map.delete(name);
        return true;
    }

    invalidate(name: string) { const e = this.map.get(name); if (e) e.valid = false; }
    invalidateAll() { this.map.forEach((e) => e.valid = false); }
    clear() { this.map.clear(); }
}

export class MemoryContainer {
    constructor(
    readonly symbolName: string
    ){ }
    private buf: Uint8Array | null = null;
    private winStart = 0;
    private winSize = 0;


    private store: Uint8Array = new Uint8Array(0);
    private ensure(off: number, size: number) {
        // Grow the local store if needed so [off, off+size) fits.
        const needed = off + size;
        if (this.store.length < needed) {
            const next = new Uint8Array(needed);
            next.set(this.store, 0);
            this.store = next;
        }

        // If our current window already covers the requested range, we're done.
        if (this.buf && off >= this.winStart && off + size <= this.winStart + this.winSize) return;

        // Point the window at the requested range in the local store.
        this.buf = this.store.subarray(off, off + size);
        this.winStart = off;
        this.winSize = size;

    }

    get byteLength(): number {
        return this.store.length;
    }

    read(off: number, size: number): Uint8Array {
        this.ensure(off, size);
        if (!this.buf) throw new Error('window not initialized');
        const rel = off - this.winStart;
        return this.buf.subarray(rel, rel + size);
    }

    // (updated) allow writing with optional zero padding to `actualSize`
    write(off: number, data: Uint8Array, actualSize?: number): void {
        const total = actualSize !== undefined ? Math.max(actualSize, data.length) : data.length;
        this.ensure(off, total);
        if (!this.buf) throw new Error('window not initialized');
        const rel = off - this.winStart;

        // write the payload
        this.buf.set(data, rel);

        // zero-fill up to total
        const extra = total - data.length;
        if (extra > 0) {
            this.buf.fill(0, rel + data.length, rel + total);
        }
    }
}

// --- bit helpers (LE) ---
function bytesToLEBigInt(bytes: Uint8Array): bigint {
    let acc = 0n;
    for (let i = 0; i < bytes.length; i++) acc |= BigInt(bytes[i] & 0xff) << BigInt(8 * i);
    return acc;
}
function leBigIntToBytes(v: bigint, size: number): Uint8Array {
    const out = new Uint8Array(size);
    for (let i = 0; i < size; i++) out[i] = Number((v >> BigInt(8 * i)) & 0xffn);
    return out;
}
function extractBitsLE(raw: Uint8Array, bitStart: number, bitLen: number): bigint {
    const acc = bytesToLEBigInt(raw);
    const mask = (1n << BigInt(bitLen)) - 1n;
    return (acc >> BigInt(bitStart)) & mask;
}
function injectBitsLE(raw: Uint8Array, bitStart: number, bitLen: number, value: bigint): Uint8Array {
    const acc = bytesToLEBigInt(raw);
    const mask = ((1n << BigInt(bitLen)) - 1n) << BigInt(bitStart);
    const v = (value & ((1n << BigInt(bitLen)) - 1n)) << BigInt(bitStart);
    const next = (acc & ~mask) | v;
    return leBigIntToBytes(next, raw.length);
}

export type Endianness = 'little' | 'big';
export interface HostOptions { endianness?: Endianness; }

type ElementMeta = {
  offsets: number[];              // append offsets within the symbol
  sizes: number[];                // logical size (actualSize) per append
  bases: number[];                // target base address per append
  elementSize?: number;           // known uniform stride when consistent
};


/** The piece your DataHost delegates to for readValue/writeValue. */
export class CachedMemoryHost {
    private cache: SymbolCache;
    private endianness: Endianness;
    private elementMeta = new Map<string, ElementMeta>();

    private getOrInitMeta(name: string): ElementMeta {
        let m = this.elementMeta.get(name);
        if (!m) {
            // with exactOptionalPropertyTypes: do NOT assign elementSize: undefined
            m = { offsets: [], sizes: [], bases: [] };
            this.elementMeta.set(name, m);
        }
        return m;
    }

    // normalize number|bigint → safe JS number for addresses
    private toAddrNumber(x: number | bigint): number {
        if (typeof x === 'number') {
            if (!Number.isFinite(x) || x < 0 || !Number.isSafeInteger(x)) {
                throw new Error(`invalid target base address (number): ${x}`);
            }
            return x;
        }
        const n = Number(x);
        if (n < 0 || !Number.isSafeInteger(n)) {
            throw new Error(`invalid target base address (bigint out of range): ${x.toString()}`);
        }
        return n;
    }

    constructor(opts?: HostOptions,
    ) {
        this.cache = new SymbolCache((name) => new MemoryContainer(name));
        this.endianness = opts?.endianness ?? 'little';
    }

    private getEntry(varName: string): SymbolEntry {
        const entry = this.cache.getSymbol(varName);
        return entry;
    }

    readValue(container: RefContainer): any {
        const variableName = container.anchor?.name;
        const widthBits = container.widthBits ?? 0;
        if (!variableName || widthBits <= 0) throw new Error('readValue: invalid target');

        const entry = this.getEntry(variableName);
        const byteOff = container.offsetBytes ?? 0;
        const bitStart = container.offsetBitRemainder ?? 0;
        const nBytes = Math.ceil((bitStart + widthBits) / 8);
        const raw = entry.data.read(byteOff, nBytes);

        if (this.endianness !== 'little') {
            // TODO: add BE bit numbering if needed
        }

        const val = extractBitsLE(raw, bitStart, widthBits);
        if (widthBits <= 32) return Number(val);
        if (widthBits <= 64) return val;
        const outBytes = Math.ceil(widthBits / 8);
        const full = bytesToLEBigInt(raw);
        const masked = (full >> BigInt(bitStart)) & ((1n << BigInt(widthBits)) - 1n);
        return leBigIntToBytes(masked, outBytes);
    }

    writeValue(container: RefContainer, value: any, actualSize?: number): void {
        const variableName = container.anchor?.name;
        const widthBits = container.widthBits ?? 0;
        if (!variableName || widthBits <= 0) throw new Error('writeValue: invalid target');

        const entry = this.getEntry(variableName);
        const byteOff = container.offsetBytes ?? 0;
        const bitStart = container.offsetBitRemainder ?? 0;
        const nBytes = Math.ceil((bitStart + widthBits) / 8);

        let valBig: bigint;
        if (typeof value === 'boolean') valBig = value ? 1n : 0n;
        else if (typeof value === 'bigint') valBig = value;
        else if (typeof value === 'number') valBig = BigInt(Math.trunc(value));
        else if (value instanceof Uint8Array) valBig = bytesToLEBigInt(value);
        else throw new Error('writeValue: unsupported value type');

        const raw = entry.data.read(byteOff, nBytes);
        const next = injectBitsLE(raw, bitStart, widthBits, valBig);

        if (actualSize !== undefined && actualSize < nBytes) {
            throw new Error(`writeValue: actualSize (${actualSize}) must be >= computed width (${nBytes})`);
        }

        entry.data.write(byteOff, next, actualSize ?? nBytes);
    }


    setVariable(
        name: string,
        size: number,
        value: number | bigint | Uint8Array,
        targetBase?: number | bigint,  // target base address where it was read from
        actualSize?: number,            // total logical bytes for this element (>= size)
    ): void {
        const entry = this.getEntry(name);

        // append behind existing bytes
        const appendOff = entry.data.byteLength ?? 0;

        // normalize payload to exactly `size` bytes (numbers/bigints LE-encoded)
        const buf = new Uint8Array(size);
        if (typeof value === 'bigint') {
            buf.set(leBigIntToBytes(value, size), 0);
        } else if (typeof value === 'number') {
            buf.set(leBigIntToBytes(BigInt(Math.trunc(value)), size), 0);
        } else if (value instanceof Uint8Array) {
            buf.set(value.subarray(0, size), 0); // truncate/zero-pad to `size`
        } else {
            throw new Error('setVariable: unsupported value type');
        }

        if (actualSize !== undefined && actualSize < size) {
            throw new Error(`setVariable: actualSize (${actualSize}) must be >= size (${size})`);
        }
        const total = actualSize ?? size;

        // write and zero-pad to `total`, extends as needed
        entry.data.write(appendOff, buf, total);

        // record per-append metadata
        const meta = this.getOrInitMeta(name);
        meta.offsets.push(appendOff);
        meta.sizes.push(total);
        meta.bases.push(targetBase !== undefined ? this.toAddrNumber(targetBase) : 0);

        // maintain uniform stride when consistent
        if (meta.elementSize === undefined && meta.sizes.length === 1) {
            meta.elementSize = total;                // first append sets stride
        } else if (meta.elementSize !== undefined && meta.elementSize !== total) {
            delete meta.elementSize;                 // mixed sizes → remove the optional prop
        }

        entry.valid = true;
    }

    writeBytes(name: string, offset: number, bytes: Uint8Array, size = bytes.length): void {
        this.setVariable(name, size, bytes, offset);
    }

    invalidate(name?: string): void {
        if (name === undefined) this.cache.invalidateAll();
        else this.cache.invalidate(name);
    }

    clearVariable(name: string): boolean {
        this.elementMeta.delete(name);
        return this.cache.removeSymbol(name);
    }

    clear(): void {
        this.elementMeta.clear();
        this.cache.clear();
    }

    /** Number of array elements recorded for `name`. Defaults to 1 when unknown. */
    getArrayElementCount(name: string): number {
        const m = this.elementMeta.get(name);
        const n = m?.offsets.length ?? 0;
        return n > 0 ? n : 1;
    }

    /** All recorded target base addresses (per append) for `name`. */
    getArrayTargetBases(name: string): (number | undefined)[] {
        const m = this.elementMeta.get(name);
        return m ? m.bases.slice() : [];
    }

    /** Target base address for element `index` of `name` (number | undefined). */
    getElementTargetBase(name: string, index: number): number | undefined {
        const m = this.elementMeta.get(name);
        if (!m) throw new Error(`getElementTargetBase: unknown symbol "${name}"`);
        if (index < 0 || index >= m.bases.length) {
            throw new Error(`getElementTargetBase: index ${index} out of range for "${name}"`);
        }
        return m.bases[index];
    }

    /** Optional: repair or set an address later. */
    setElementTargetBase(name: string, index: number, base: number | bigint): void {
        const m = this.elementMeta.get(name);
        if (!m) throw new Error(`setElementTargetBase: unknown symbol "${name}"`);
        if (index < 0 || index >= m.bases.length) {
            throw new Error(`setElementTargetBase: index ${index} out of range for "${name}"`);
        }
        m.bases[index] = this.toAddrNumber(base);
    }

    // Optional: if you sometimes need to infer a count from bytes for legacy data
    getArrayLengthFromBytes(name: string): number {
        const m = this.elementMeta.get(name);
        if (!m) return 1;
        if (m.offsets.length > 0) return m.offsets.length;

        const entry = this.getEntry(name);
        const totalBytes = entry.data.byteLength ?? 0;
        const stride = m.elementSize;
        if (!stride || stride <= 0) return 1;
        return Math.max(1, Math.floor(totalBytes / stride));
    }


}
