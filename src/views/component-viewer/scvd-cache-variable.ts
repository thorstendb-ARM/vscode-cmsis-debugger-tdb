// FILE: src/cache-variable.ts
/*
 * Variable cache (SYNC VERSION)
 * - Map: variable name -> Uint32Array backing (little-endian alignment)
 * - readBytes/readUint and writeBytes/writeUint are synchronous
 */

import { ScvdCacheBase, TargetFetchFn } from './scvd-cache-base';


export class ScvdCacheVariable extends ScvdCacheBase<Uint32Array> {
    constructor(fetchFn: TargetFetchFn) { super(fetchFn); }
    protected exprFor(name: string, offset: number, size: number) {
        return `mem:${name}@${offset}:${size}`;
    }
    protected ensureCapacity(c: any, requiredBytes: number) {
        const requiredWords = Math.ceil(requiredBytes / 4);
        if (c.value.length < requiredWords) {
            const grown = new Uint32Array(requiredWords);
            grown.set(c.value);
            c.value = grown;
        }
    }
    protected view(c: any) { return new DataView(c.value.buffer, 0, c.value.length * 4); }

    /** Read a byte range; fetches/extends from target if needed (SYNC). */
    readBytes(variableName: string, offset: number, size: number): Uint8Array {
        const init = () => new Uint32Array(0);
        let container = this.getContainer(variableName);

        if (!container || !container.valid) {
            container = this.fetchIfInvalidSync(
                variableName,
                this.exprFor(variableName, offset, size),
                init,
                (raw) => {
                    let bytes: Uint8Array;
                    if (raw instanceof Uint8Array) bytes = raw;
                    else if (raw instanceof ArrayBuffer) bytes = new Uint8Array(raw);
                    else if (Array.isArray(raw)) bytes = new Uint8Array(raw);
                    else throw new Error(`Unexpected memory payload for ${variableName}`);
                    const c = this.getOrInit(variableName, init);
                    const end = offset + bytes.byteLength;
                    this.ensureCapacity(c, end);
                    const dv = this.view(c);
                    for (let i = 0; i < bytes.byteLength; i++) dv.setUint8(offset + i, bytes[i]);
                    return c.value;
                }
            );
        } else if ((offset + size) > (container.value.length * 4)) {
            const currentBytes = container.value.length * 4;
            const missing = (offset + size) - currentBytes;
            const tailOffset = currentBytes;
            const raw = this.fetchFn(this.exprFor(variableName, tailOffset, missing));
            let bytes: Uint8Array;
            if (raw instanceof Uint8Array) bytes = raw;
            else if (raw instanceof ArrayBuffer) bytes = new Uint8Array(raw);
            else if (Array.isArray(raw)) bytes = new Uint8Array(raw);
            else throw new Error(`Unexpected memory payload for ${variableName}`);
            this.ensureCapacity(container, tailOffset + bytes.byteLength);
            const dv = this.view(container);
            for (let i = 0; i < bytes.byteLength; i++) dv.setUint8(tailOffset + i, bytes[i]);
            container.valid = true;
            container.lastUpdated = Date.now();
        }

        const dv = this.view(container);
        const out = new Uint8Array(size);
        for (let i = 0; i < size; i++) out[i] = dv.getUint8(offset + i);
        return out;
    }

    /** Read an unsigned integer of 1,2, or 4 bytes (little-endian). */
    readUint(variableName: string, offset: number, size: 1 | 2 | 4): number {
        const bytes = this.readBytes(variableName, offset, size);
        if (size === 1) return bytes[0];
        if (size === 2) return (bytes[0] | (bytes[1] << 8)) >>> 0;
        return ((bytes[0]) | (bytes[1] << 8) | (bytes[2] << 16) | ((bytes[3] << 24) >>> 0)) >>> 0;
    }

    /** Write raw bytes (extends storage if necessary). */
    writeBytes(variableName: string, offset: number, data: Uint8Array) {
        const c = this.getOrInit(variableName, () => new Uint32Array(0));
        const end = offset + data.byteLength;
        this.ensureCapacity(c, end);
        const dv = this.view(c);
        for (let i = 0; i < data.byteLength; i++) dv.setUint8(offset + i, data[i]);
        c.valid = true;
        c.dirty = true;
        c.lastUpdated = Date.now();
    }

    /** Write an unsigned little-endian number of 1,2, or 4 bytes. */
    writeUint(variableName: string, offset: number, size: 1 | 2 | 4, value: number) {
        const data = new Uint8Array(size);
        const v = value >>> 0;
        if (size >= 1) data[0] = v & 0xFF;
        if (size >= 2) data[1] = (v >>> 8) & 0xFF;
        if (size >= 4) { data[2] = (v >>> 16) & 0xFF; data[3] = (v >>> 24) & 0xFF; }
        this.writeBytes(variableName, offset, data);
    }

    dump(variableName: string): Uint32Array | undefined {
        const c = this.getContainer(variableName);
        if (!c) return undefined;
        const copy = new Uint32Array(c.value.length);
        copy.set(c.value);
        return copy;
    }
}

/** Mock for memory (SYNC). */
export class MockMemoryTarget {
    private memory = new Map<string, Uint8Array>();

    seed(symbol: string, bytes: Uint8Array) { this.memory.set(symbol, new Uint8Array(bytes)); }

    /** Synchronous byte-range fetch */
    fetch: TargetFetchFn = (expr: string): unknown => {
        if (!expr.startsWith('mem:')) throw new Error(`MockMemoryTarget cannot handle ${expr}`);
        const body = expr.slice(4);
        const [symbol, rest] = body.split('@');
        const [offStr, sizeStr] = (rest ?? '0:0').split(':');
        const offset = parseInt(offStr || '0', 10) >>> 0;
        const size = parseInt(sizeStr || '0', 10) >>> 0;
        const backing = this.memory.get(symbol) ?? new Uint8Array(0);
        const out = new Uint8Array(size);
        for (let i = 0; i < size; i++) out[i] = backing[offset + i] ?? 0;
        return out;
    };
}

// Example usage (sync):
// const memTarget = new MockMemoryTarget();
// memTarget.seed('buf', new Uint8Array([0xAA,0xBB,0xCC,0xDD, 0x01,0x02,0x03,0x04]));
// const varCache = new ScvdCacheVariable(memTarget.fetch);
// const slice = varCache.readBytes('buf', 2, 6);
// varCache.writeUint('buf', 4, 4, 0x99AABBCC);


