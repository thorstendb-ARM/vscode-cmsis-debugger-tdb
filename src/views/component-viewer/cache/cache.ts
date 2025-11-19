// cache.ts

import { RefContainer } from '../evaluator';
import { ScvdBase } from '../model/scvd-base';

/** Memory I/O used by the cache host (sync). */
export interface MemoryBackend {
  read(addr: number, size: number): Uint8Array;
  write(addr: number, data: Uint8Array): void;
}

/** Symbol→address/name mapping used by cache host. */
export interface ModelAddressName {
  addressOf(ref: ScvdBase): number;
  nameOf(ref: ScvdBase): string;
}

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
    readonly symbolName: string,
    private backend: MemoryBackend,
    private _baseAddress: number,
    ) {}

    get baseAddress(): number { return this._baseAddress; }
    set baseAddress(v: number) { this._baseAddress = v; this.buf = null; }

    private buf: Uint8Array | null = null;
    private winStart = 0;
    private winSize = 0;

    private ensure(off: number, size: number) {
        if (this.buf && off >= this.winStart && off + size <= this.winStart + this.winSize) return;
        const addr = this._baseAddress + off;
        const bytes = this.backend.read(addr, size);
        if (bytes.length !== size) throw new Error(`Backend read ${bytes.length}B, expected ${size}B`);
        this.buf = bytes; this.winStart = off; this.winSize = size;
    }

    read(off: number, size: number): Uint8Array {
        this.ensure(off, size);
        if (!this.buf) throw new Error('window not initialized');
        return this.buf.subarray(0, size); // aligned to 'off'
    }

    write(off: number, data: Uint8Array): void {
        this.ensure(off, data.length);
        if (!this.buf) throw new Error('window not initialized');
        this.buf.set(data, 0);
        this.backend.write(this._baseAddress + off, data);
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

    constructor(
    private backend: MemoryBackend,
    private addrName: ModelAddressName,
    opts?: HostOptions,
    ) {
        this.cache = new SymbolCache((name) => new MemoryContainer(name, this.backend, 0));
        this.endianness = opts?.endianness ?? 'little';
    }

    private getEntry(anchor: ScvdBase): SymbolEntry {
        const name = this.addrName.nameOf(anchor);
        const entry = this.cache.getSymbol(name);
        const baseAddr = this.addrName.addressOf(anchor);
        if (entry.data.baseAddress !== baseAddr) {
            entry.data.baseAddress = baseAddr;
            entry.valid = false;
        }
        return entry;
    }

    readValue(container: RefContainer): any {
        const anchor = container.anchor;
        const widthBits = container.widthBits ?? 0;
        if (!anchor || widthBits <= 0) throw new Error('readValue: invalid target');

        const entry = this.getEntry(anchor);
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
        const anchor = container.anchor;
        const widthBits = container.widthBits ?? 0;
        if (!anchor || widthBits <= 0) throw new Error('writeValue: invalid target');

        const entry = this.getEntry(anchor);
        const byteOff = container.offsetBytes ?? 0;
        const bitStart = container.offsetBitRemainder ?? 0;
        const nBytes = Math.ceil((bitStart + widthBits) / 8);

        let valBig: bigint;
        if (typeof value === 'bigint') valBig = value;
        else if (typeof value === 'number') valBig = BigInt(Math.trunc(value));
        else if (value instanceof Uint8Array) {
            valBig = bytesToLEBigInt(value);
        } else throw new Error('writeValue: unsupported value type');

        const raw = entry.data.read(byteOff, nBytes);
        const next = injectBitsLE(raw, bitStart, widthBits, valBig);
        entry.data.write(byteOff, next);
    }
}
