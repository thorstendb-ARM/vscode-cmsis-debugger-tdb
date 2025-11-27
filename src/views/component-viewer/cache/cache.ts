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

    invalidate(name: string) { const e = this.map.get(name); if (e) e.valid = false; }
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

    write(off: number, data: Uint8Array): void {
        this.ensure(off, data.length);
        if (!this.buf) throw new Error('window not initialized');
        const rel = off - this.winStart;
        this.buf.set(data, rel);
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

    writeValue(container: RefContainer, value: any): void {
        const variableName = container.anchor?.name;
        const widthBits = container.widthBits ?? 0;
        if (!variableName || widthBits <= 0) throw new Error('writeValue: invalid target');

        const entry = this.getEntry(variableName);
        const byteOff = container.offsetBytes ?? 0;
        const bitStart = container.offsetBitRemainder ?? 0;
        const nBytes = Math.ceil((bitStart + widthBits) / 8);

        let valBig: bigint;
        if (typeof value === 'boolean') valBig = BigInt(Math.trunc(value ? 1 : 0));
        else if (typeof value === 'bigint') valBig = value;
        else if (typeof value === 'number') valBig = BigInt(Math.trunc(value));
        else if (value instanceof Uint8Array) {
            valBig = bytesToLEBigInt(value);
        } else {
            throw new Error('writeValue: unsupported value type');
        }

        const raw = entry.data.read(byteOff, nBytes);
        const next = injectBitsLE(raw, bitStart, widthBits, valBig);
        entry.data.write(byteOff, next);
    }

    setVariable(name: string, size: number, value: number | bigint | Uint8Array): void {
        const entry = this.getEntry(name);
        const buf = new Uint8Array(size);
        if (typeof value === 'bigint') {
            const valBytes = leBigIntToBytes(value, size);
            buf.set(valBytes, 0);
        } else if (typeof value === 'number') {
            const valBytes = leBigIntToBytes(BigInt(Math.trunc(value)), size);
            buf.set(valBytes, 0);
        } else if (value instanceof Uint8Array) {
            buf.set(value.subarray(0, size), 0);
        } else {
            throw new Error('setVariable: unsupported value type');
        }
        entry.data.write(0, buf);
        entry.valid = true;
    }
}
