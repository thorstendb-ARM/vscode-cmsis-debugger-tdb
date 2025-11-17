// Target **byte** cache for memory-backed symbols.
// - Fixed-size buffer per symbol
// - On-demand chunk loading via synchronous readChunk(offset,len) callback
// - UINT8/16/32 little-endian read/write helpers

export type ReadChunkFn = (offset: number, length: number) => Uint8Array;

function clampWidth(widthBytes: number): 1 | 2 | 4 {
    return (widthBytes === 1 || widthBytes === 2 || widthBytes === 4) ? widthBytes : 4;
}

function readLE(buf: Uint8Array, off: number, width: 1 | 2 | 4): number | undefined {
    if (off < 0 || off + width > buf.length) return undefined;
    const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    if (width === 1) return dv.getUint8(off);
    if (width === 2) return dv.getUint16(off, true);
    return dv.getUint32(off, true);
}

function writeLE(buf: Uint8Array, off: number, width: 1 | 2 | 4, value: number): boolean {
    if (off < 0 || off + width > buf.length) return false;
    const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    if (width === 1) { dv.setUint8(off, value >>> 0); return true; }
    if (width === 2) { dv.setUint16(off, value >>> 0, true); return true; }
    dv.setUint32(off, value >>> 0, true); return true;
}

function alignDown(v: number, a: number) { return Math.floor(v / a) * a; }
function alignUp(v: number, a: number) { return Math.ceil(v / a) * a; }

export interface TargetEntry {
  name: string;
  totalSize: number;
  chunkSize: number;
  buffer: Uint8Array;
  filled: Set<number>;  // chunk indices
  readChunk: ReadChunkFn;
}

export class TargetByteCache {
    private map = new Map<string, TargetEntry>();

    addTargetSymbol(name: string, totalSize: number, readChunk: ReadChunkFn, chunkSize = 256): void {
        if (this.map.has(name)) return;
        const size = Math.max(1, totalSize | 0);
        const cs = Math.max(1, chunkSize | 0);
        this.map.set(name, {
            name,
            totalSize: size,
            chunkSize: cs,
            buffer: new Uint8Array(size),
            filled: new Set<number>(),
            readChunk,
        });
    }

    has(name: string): boolean { return this.map.has(name); }

    private ensure(name: string, offset: number, length: number): boolean {
        const e = this.map.get(name);
        if (!e) return false;
        if (offset < 0 || length <= 0 || offset + length > e.totalSize) return false;

        const cs = e.chunkSize;
        const s = alignDown(offset, cs);
        const t = alignUp(offset + length, cs);
        for (let p = s; p < t; p += cs) {
            const idx = p / cs;
            if (e.filled.has(idx)) continue;
            const need = Math.min(cs, e.totalSize - p);
            const bytes = e.readChunk(p, need);
            if (!(bytes instanceof Uint8Array) || bytes.length !== need) return false;
            e.buffer.set(bytes, p);
            e.filled.add(idx);
        }
        return true;
    }

    readUint(name: string, byteOffset: number, widthBytes: number): number | undefined {
        const e = this.map.get(name);
        if (!e) return undefined;
        const w = clampWidth(widthBytes);
        if (!this.ensure(name, byteOffset, w)) return undefined;
        return readLE(e.buffer, byteOffset, w);
    }

    writeUint(name: string, byteOffset: number, widthBytes: number, value: number): boolean {
        const e = this.map.get(name);
        if (!e) return false;
        const w = clampWidth(widthBytes);
        if (!this.ensure(name, byteOffset, w)) return false;
        return writeLE(e.buffer, byteOffset, w, value >>> 0);
    }

    dump(name: string): Uint8Array | undefined {
        const e = this.map.get(name);
        return e ? new Uint8Array(e.buffer) : undefined;
    }
}

export function createMockTargetReader(seed: Uint8Array): ReadChunkFn {
    const backing = new Uint8Array(seed);
    return (offset: number, length: number) => backing.subarray(offset, offset + length);
}
