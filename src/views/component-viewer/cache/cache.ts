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

        // write payload bytes
        this.buf.set(data, rel);

        // zero-fill any remaining bytes up to total
        const extra = total - data.length;
        if (extra > 0) {
            this.buf.fill(0, rel + data.length, rel + total);
        }
    }

    get byteLength(): number {
        return this.store.length;
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

/** The piece your DataHost delegates to for readValue/writeValue. */
export class CachedMemoryHost {
    private cache: SymbolCache;
    private endianness: Endianness;

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

    // cache.ts — inside export class CachedMemoryHost

    writeValue(container: RefContainer, value: any, actualSize?: number): void {
        const variableName = container.anchor?.name;
        const widthBits = container.widthBits ?? 0;
        if (!variableName || widthBits <= 0) throw new Error('writeValue: invalid target');

        const entry = this.getEntry(variableName);
        const byteOff = container.offsetBytes ?? 0;
        const bitStart = container.offsetBitRemainder ?? 0;
        const nBytes = Math.ceil((bitStart + widthBits) / 8);

        let valBig: bigint;
        if (typeof value === 'boolean') valBig = BigInt(value ? 1 : 0);
        else if (typeof value === 'bigint') valBig = value;
        else if (typeof value === 'number') valBig = BigInt(Math.trunc(value));
        else if (value instanceof Uint8Array) valBig = bytesToLEBigInt(value);
        else throw new Error('writeValue: unsupported value type');

        if (actualSize !== undefined && actualSize < nBytes) {
            throw new Error(`writeValue: actualSize (${actualSize}) must be >= computed byte width (${nBytes})`);
        }

        const raw = entry.data.read(byteOff, nBytes);
        const next = injectBitsLE(raw, bitStart, widthBits, valBig);

        // `next` length is nBytes; pad zeros out to `actualSize` if provided
        entry.data.write(byteOff, next, actualSize ?? nBytes);
    }

    setVariable(
        name: string,
        size: number,
        value: number | bigint | Uint8Array,
        actualSize?: number   // (new) total logical bytes to write (>= size)
    ): void {
        const entry = this.getEntry(name);

        // we append "like an array" if the symbol already exists
        const appendOff = entry.data.byteLength ?? 0;

        // normalize payload to exactly `size` bytes
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

        // validate `actualSize` if provided
        if (actualSize !== undefined && actualSize < size) {
            throw new Error(`setVariable: actualSize (${actualSize}) must be >= size (${size})`);
        }

        // write and zero-pad up to `actualSize` (or `size` if not provided)
        entry.data.write(appendOff, buf, actualSize ?? size);
        entry.valid = true;
    }

    writeBytes(name: string, offset: number, bytes: Uint8Array, size = bytes.length): void {
        this.setVariable(name, size, bytes, offset);
    }

    invalidate(name?: string): void {
        if (name === undefined) this.cache.invalidateAll();
        else this.cache.invalidate(name);
    }

    /** Remove a symbol from the host (delegates to SymbolCache). */
    clearVariable(name: string): boolean {
        return this.cache.removeSymbol(name);
    }

    /** Wipe everything in the cache. */
    clear(): void {
        this.cache.clear();
    }
}
