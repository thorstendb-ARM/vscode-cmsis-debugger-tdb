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
        if (!this.buf) {
            console.error('window not initialized');
            return new Uint8Array(size);
        }
        const rel = off - this.winStart;
        return this.buf.subarray(rel, rel + size);
    }

    // allow writing with optional zero padding to `actualSize`
    write(off: number, data: Uint8Array, actualSize?: number): void {
        const total = actualSize !== undefined ? Math.max(actualSize, data.length) : data.length;
        this.ensure(off, total);
        if (!this.buf) {
            console.error('window not initialized');
            return;
        }
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

// --- helpers (LE encoding) ---
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
                console.error(`invalid target base address (number): ${x}`);
                return 0;
            }
            return x;
        }
        const n = Number(x);
        if (n < 0 || !Number.isSafeInteger(n)) {
            console.error(`invalid target base address (bigint out of range): ${x.toString()}`);
            return 0;
        }
        return n;
    }

    constructor(opts?: HostOptions) {
        this.cache = new SymbolCache((name) => new MemoryContainer(name));
        this.endianness = opts?.endianness ?? 'little';
    }

    private getEntry(varName: string): SymbolEntry {
        const entry = this.cache.getSymbol(varName);
        return entry;
    }

    /** Read a value, using byte-only offsets and widths. */
    readValue(container: RefContainer): any {
        const variableName = container.anchor?.name;
        const widthBytes = container.widthBytes ?? 0;
        if (!variableName || widthBytes <= 0) {
            console.error('readValue: invalid target');
            return;
        }

        const entry = this.getEntry(variableName);
        const byteOff = container.offsetBytes ?? 0;

        const raw = entry.data.read(byteOff, widthBytes);

        if (this.endianness !== 'little') {
            // TODO: add BE support if needed
        }

        // Interpret the bytes:
        //  - ≤4 bytes: JS number
        //  - ≤8 bytes: bigint
        //  - >8 bytes: return raw bytes
        if (widthBytes <= 4) {
            const val = bytesToLEBigInt(raw);
            return Number(val);
        }
        if (widthBytes <= 8) {
            return bytesToLEBigInt(raw);
        }
        // for larger widths, return a copy of the bytes
        return raw.slice();
    }

    /** Write a value, using byte-only offsets and widths. */
    writeValue(container: RefContainer, value: any, actualSize?: number): void {
        const variableName = container.anchor?.name;
        const widthBytes = container.widthBytes ?? 0;
        if (!variableName || widthBytes <= 0) {
            console.error('writeValue: invalid target');
            return;
        }

        const entry = this.getEntry(variableName);
        const byteOff = container.offsetBytes ?? 0;

        let buf: Uint8Array;

        if (value instanceof Uint8Array) {
            if (value.length === widthBytes) {
                buf = value;
            } else {
                // truncate or pad to widthBytes
                buf = new Uint8Array(widthBytes);
                buf.set(value.subarray(0, widthBytes), 0);
            }
        } else {
            // normalize value to bigint then to bytes
            let valBig: bigint;
            if (typeof value === 'boolean') valBig = value ? 1n : 0n;
            else if (typeof value === 'bigint') valBig = value;
            else if (typeof value === 'number') valBig = BigInt(Math.trunc(value));
            else {
                console.error('writeValue: unsupported value type');
                return;
            }

            buf = leBigIntToBytes(valBig, widthBytes);
        }

        if (actualSize !== undefined && actualSize < widthBytes) {
            console.error(`writeValue: actualSize (${actualSize}) must be >= widthBytes (${widthBytes})`);
            return;
        }

        const total = actualSize ?? widthBytes;
        entry.data.write(byteOff, buf, total);
    }

    setVariable(
        name: string,
        size: number,
        value: number | bigint | Uint8Array,
        offset: number,                     // NEW: controls where to place the data
        targetBase?: number | bigint,       // target base address where it was read from
        actualSize?: number,                // total logical bytes for this element (>= size)
    ): void {
        if (!Number.isSafeInteger(offset)) {
            console.error(`setVariable: offset must be a safe integer, got ${offset}`);
            return;
        }

        const entry = this.getEntry(name);

        // Decide where to write:
        //  - offset === -1 → append at the end
        //  - otherwise     → write at the given offset
        const appendOff = offset === -1 ? (entry.data.byteLength ?? 0) : offset;
        if (appendOff < 0) {
            console.error(`setVariable: offset must be >= 0 or -1, got ${offset}`);
            return;
        }

        // normalize payload to exactly `size` bytes (numbers/bigints LE-encoded)
        const buf = new Uint8Array(size);
        if (typeof value === 'bigint') {
            buf.set(leBigIntToBytes(value, size), 0);
        } else if (typeof value === 'number') {
            buf.set(leBigIntToBytes(BigInt(Math.trunc(value)), size), 0);
        } else if (value instanceof Uint8Array) {
            buf.set(value.subarray(0, size), 0); // truncate/zero-pad to `size`
        } else {
            console.error('setVariable: unsupported value type');
            return;
        }

        if (actualSize !== undefined && actualSize < size) {
            console.error(`setVariable: actualSize (${actualSize}) must be >= size (${size})`);
            return;
        }
        const total = actualSize ?? size;

        // write and zero-pad to `total`, extends as needed
        entry.data.write(appendOff, buf, total);

        // record per-append metadata
        const meta = this.getOrInitMeta(name);
        meta.offsets.push(appendOff);
        meta.sizes.push(total);
        meta.bases.push(
            targetBase !== undefined ? this.toAddrNumber(targetBase) : 0
        );

        // maintain uniform stride when consistent
        if (meta.elementSize === undefined && meta.sizes.length === 1) {
            meta.elementSize = total;                // first append sets stride
        } else if (meta.elementSize !== undefined && meta.elementSize !== total) {
            delete meta.elementSize;                 // mixed sizes → remove the optional prop
        }

        entry.valid = true;
    }

    writeBytes(name: string, offset: number, bytes: Uint8Array, size = bytes.length): void {
        // `offset` here is the same "where to write" offset:
        //  - offset === -1 → append at end
        //  - else          → write starting at `offset`
        //
        // For the recorded target base, reuse offset when it's non-negative.
        const base = offset >= 0 ? offset : undefined;
        this.setVariable(name, size, bytes, offset, base);
    }

    /**
     * Write a numeric value into a symbol at a given byte offset.
     *
     * - `size` is the number of bytes to encode (1, 2, 4, 8, ...).
     * - `offset === -1` appends to the end of the symbol.
     * - Otherwise, writes at the given byte offset within the symbol.
     */
    writeNumber(name: string, offset: number, value: number, size: number): void {
        if (!Number.isSafeInteger(size) || size <= 0) {
            console.error(`writeNumber: size must be a positive safe integer, got ${size}`);
            return;
        }
        if (!Number.isFinite(value)) {
            console.error(`writeNumber: value must be finite, got ${value}`);
            return;
        }

        // Reuse setVariable so that metadata (offsets/sizes/bases) stays consistent.
        // For the recorded base, we treat non-negative offset as the base.
        const base = offset >= 0 ? offset : undefined;
        this.setVariable(name, size, value, offset, base, size);
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
        if (!m) {
            console.error(`getElementTargetBase: unknown symbol "${name}"`);
            return undefined;
        }
        if (index < 0 || index >= m.bases.length) {
            console.error(`getElementTargetBase: index ${index} out of range for "${name}"`);
            return undefined;
        }
        return m.bases[index];
    }

    /** Optional: repair or set an address later. */
    setElementTargetBase(name: string, index: number, base: number | bigint): void {
        const m = this.elementMeta.get(name);
        if (!m) {
            console.error(`setElementTargetBase: unknown symbol "${name}"`);
            return;
        }
        if (index < 0 || index >= m.bases.length) {
            console.error(`setElementTargetBase: index ${index} out of range for "${name}"`);
            return;
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
