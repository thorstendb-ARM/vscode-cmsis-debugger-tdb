// FILE: src/cache-variable.ts
/*
 * Variable cache (SYNC VERSION)
 * - Map: variable name -> { var: Uint32Array, member: Uint32Array }
 * - Primary entry points: read/write (byte-oriented)
 * - Little-endian, supports cross-32-bit boundaries, expands on demand
 */

import { ScvdCacheBase, TargetFetchFn } from './scvd-cache-base';

export type VariableContainer = { var: Uint32Array; member: Uint32Array };
export enum VarField { Variable = 'variable', Member = 'member' }

function fieldKey(which: VarField): 'var' | 'member' {
    return which === VarField.Member ? 'member' : 'var';
}

export class ScvdCacheVariable extends ScvdCacheBase<VariableContainer> {
    constructor(fetchFn: TargetFetchFn) { super(fetchFn); }

    protected exprFor(name: string, offset: number, size: number) {
        return `mem:${name}@${offset}:${size}`;
    }

    protected ensureCapacity(c: any, field: 'var' | 'member', requiredBytes: number) {
        const requiredWords = Math.ceil(requiredBytes / 4);
        if (c.value[field].length < requiredWords) {
            const grown = new Uint32Array(requiredWords);
            grown.set(c.value[field]);
            c.value[field] = grown;
        }
    }

    protected view(c: any, field: 'var' | 'member') {
        return new DataView(c.value[field].buffer, 0, c.value[field].length * 4);
    }

    /** Primary read entry point (bytes). */
    read(variableName: string, offset: number, size: number, which: VarField = VarField.Variable): Uint8Array {
        return this.readBytes(variableName, offset, size, which);
    }

    /** Primary write entry point (bytes). */
    write(variableName: string, offset: number, data: Uint8Array, which: VarField = VarField.Variable): void {
        this.writeBytes(variableName, offset, data, which);
    }

    /** Read a byte range; fetches/extends from target if needed (SYNC). */
    readBytes(variableName: string, offset: number, size: number, which: VarField = VarField.Variable): Uint8Array {
        const init = () => ({ var: new Uint32Array(0), member: new Uint32Array(0) });
        let container = this.getContainer(variableName);
        const fld = fieldKey(which);

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
                    this.ensureCapacity(c, fld, end);
                    const dv = this.view(c, fld);
                    for (let i = 0; i < bytes.byteLength; i++) dv.setUint8(offset + i, bytes[i]);
                    return c.value;
                }
            );
        } else if ((offset + size) > (container.value[fld].length * 4)) {
            const currentBytes = container.value[fld].length * 4;
            const missing = (offset + size) - currentBytes;
            const tailOffset = currentBytes;
            const raw = this.fetchFn(this.exprFor(variableName, tailOffset, missing));
            let bytes: Uint8Array;
            if (raw instanceof Uint8Array) bytes = raw;
            else if (raw instanceof ArrayBuffer) bytes = new Uint8Array(raw);
            else if (Array.isArray(raw)) bytes = new Uint8Array(raw);
            else throw new Error(`Unexpected memory payload for ${variableName}`);
            this.ensureCapacity(container, fld, tailOffset + bytes.byteLength);
            const dv = this.view(container, fld);
            for (let i = 0; i < bytes.byteLength; i++) dv.setUint8(tailOffset + i, bytes[i]);
            container.valid = true;
            container.lastUpdated = Date.now();
        }

        const dv = this.view(container, fld);
        const out = new Uint8Array(size);
        for (let i = 0; i < size; i++) out[i] = dv.getUint8(offset + i);
        return out;
    }

    /** Read an unsigned integer of 1,2, or 4 bytes (little-endian). */
    readUint(variableName: string, offset: number, size: 1 | 2 | 4, which: VarField = VarField.Variable): number {
        const bytes = this.readBytes(variableName, offset, size, which);
        if (size === 1) return bytes[0];
        if (size === 2) return (bytes[0] | (bytes[1] << 8)) >>> 0;
        return ((bytes[0]) | (bytes[1] << 8) | (bytes[2] << 16) | ((bytes[3] << 24) >>> 0)) >>> 0;
    }

    /** Write raw bytes (extends storage if necessary). */
    writeBytes(variableName: string, offset: number, data: Uint8Array, which: VarField = VarField.Variable) {
        const c = this.getOrInit(variableName, () => ({ var: new Uint32Array(0), member: new Uint32Array(0) }));
        const end = offset + data.byteLength;
        const fld = fieldKey(which);
        this.ensureCapacity(c, fld, end);
        const dv = this.view(c, fld);
        for (let i = 0; i < data.byteLength; i++) dv.setUint8(offset + i, data[i]);
        c.valid = true;
        c.dirty = true;
        c.lastUpdated = Date.now();
    }

    /** Write an unsigned little-endian number of 1,2, or 4 bytes. */
    writeUint(variableName: string, offset: number, size: 1 | 2 | 4, value: number, which: VarField = VarField.Variable) {
        const data = new Uint8Array(size);
        const v = value >>> 0;
        if (size >= 1) data[0] = v & 0xFF;
        if (size >= 2) data[1] = (v >>> 8) & 0xFF;
        if (size >= 4) { data[2] = (v >>> 16) & 0xFF; data[3] = (v >>> 24) & 0xFF; }
        this.writeBytes(variableName, offset, data, which);
    }

    dump(variableName: string): { var: Uint32Array; member: Uint32Array } | undefined {
        const c = this.getContainer(variableName);
        if (!c) return undefined;
        return {
            var: c.value.var.slice(),
            member: c.value.member.slice(),
        };
    }
}

/** Mock for memory (member-only) — used to provide bytes for the 'member' field. */
export class MockMemoryTarget {
    private memory = new Map<string, Uint8Array>();

    seed(symbol: string, bytes: Uint8Array) { this.memory.set(symbol, new Uint8Array(bytes)); }

    /** Synchronous byte-range fetch */
    fetch: TargetFetchFn = (expr: string): unknown => {
        if (!expr.startsWith('mem:')) throw new Error(`MockMemberTarget cannot handle ${expr}`);
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
