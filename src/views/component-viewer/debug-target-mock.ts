/**
 * Copyright 2025 Arm Limited
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { MemberInfo, SymbolInfo } from './scvd-debug-target';

/** ---------- MyList fixture: addresses (32-bit, little-endian) ---------- */
const MYLIST_ADDR = {
    // Globals
    ValueA:     0x20005100,
    ValueB:     0x20005120,
    ValueC:     0x20005140,
    ListStart:  0x20005160,   // holds pointer to ValueA
    ValueArray: 0x20005200,   // 3 x MyList (12 bytes each) => 36 bytes
    pArray:     0x20005000,   // 5 pointers (20 bytes)

    // Strings
    Str: {
        ListValueA: 0x20006000,
        ListValueB: 0x20006020,
        ListValueC: 0x20006040,
        V0:         0x20006060,
        V1:         0x20006070,
        V2:         0x20006080,
    }
} as const;

// ── Stack mock configuration ───────────────────────────────────────────────────
const STACK_BYTES  = 200;
const STACK_WORDS  = STACK_BYTES / 4;   // 50
const STACK_ADDR = {
    TStack: 0x20006000,                   // pick any free RAM slot
} as const;

export class DebugTargetMock {

    constructor(
    ) {
    }

    public getMockMemoryData(startAddress: number, size: number): Uint8Array | undefined {
        if(startAddress === 0x20003000) return this.getMockOsRtxInfoData(size);
        if(startAddress === 0x20004000) return this.getMockOsRtxConfigData(size);

        // --- Stack mock: support base reads and arbitrary sub-range/element reads ---
        if (
            startAddress >= STACK_ADDR.TStack &&
            startAddress <  STACK_ADDR.TStack + STACK_BYTES
        ) {
            const offset = startAddress - STACK_ADDR.TStack;
            return this.getMockTStackSlice(size, offset);
        }
        // --- MyList fixture: variables/arrays ---
        if (startAddress === MYLIST_ADDR.ValueC)     return this.getMockValueC(size);
        if (startAddress === MYLIST_ADDR.ValueB)     return this.getMockValueB(size);
        if (startAddress === MYLIST_ADDR.ValueA)     return this.getMockValueA(size);
        if (startAddress === MYLIST_ADDR.ListStart)  return this.getMockListStart(size);
        if (startAddress === MYLIST_ADDR.ValueArray) return this.getMockValueArray(size);
        // Per-element reads (e.g., when dereferencing pArray[3] or pArray[4]):
        if (startAddress === MYLIST_ADDR.ValueArray + 12 * 0) return this.getMockValueArrayElem(size, 0);
        if (startAddress === MYLIST_ADDR.ValueArray + 12 * 1) return this.getMockValueArrayElem(size, 1);
        if (startAddress === MYLIST_ADDR.ValueArray + 12 * 2) return this.getMockValueArrayElem(size, 2);
        if (startAddress === MYLIST_ADDR.pArray)     return this.getMockPArray(size);

        // --- MyList fixture: strings ---
        if (startAddress === MYLIST_ADDR.Str.ListValueC) return this.makeCString('List Value C', size);
        if (startAddress === MYLIST_ADDR.Str.ListValueB) return this.makeCString('List Value B', size);
        if (startAddress === MYLIST_ADDR.Str.ListValueA) return this.makeCString('List Value A', size);
        if (startAddress === MYLIST_ADDR.Str.V0)         return this.makeCString('Value[0]', size);
        if (startAddress === MYLIST_ADDR.Str.V1)         return this.makeCString('Value[1]', size);
        if (startAddress === MYLIST_ADDR.Str.V2)         return this.makeCString('Value[2]', size);

        return undefined;
    }

    public getMockSymbolInfo(symbol: string): SymbolInfo | undefined {
        if(symbol === 'mySymbol') {
            const symbolInfo: SymbolInfo = { name: symbol, address: 0x12345678, size: 4*1, member: [] };
            symbolInfo.member?.push(this.mockMemberInfo('A', 1, 4+0));
            symbolInfo.member?.push(this.mockMemberInfo('B', 1, 4+1));
            symbolInfo.member?.push(this.mockMemberInfo('C', 1, 4+2));
            symbolInfo.member?.push(this.mockMemberInfo('D', 1, 4+3));
            return symbolInfo;
        }
        if (symbol === 'tstack') {
            const s: SymbolInfo = { name: symbol, address: STACK_ADDR.TStack, size: STACK_BYTES, member: [] };
            for (let i = 0; i < STACK_WORDS; i++) {
                s.member?.push(this.mockMemberInfo(`[${i}]`, 4, i * 4));
            }
            return s;
        }
        if(symbol === 'osRtxInfo') {
            const symbolInfo: SymbolInfo = { name: symbol, address: 0x20003000, size: 4*1 };
            return symbolInfo;
        }
        if(symbol === 'osRtxConfig') {
            const symbolInfo: SymbolInfo = { name: symbol, address: 0x20004000, size: 4*1 };
            return symbolInfo;
        }
        if (symbol === 'pArray') {
            // pArray is 5 pointers (32‑bit each)
            const symbolInfo: SymbolInfo = { name: symbol, address: 0x20005000, size: 4 * 5, member: [] };
            for (let i = 0; i < 5; i++) {
                symbolInfo.member?.push(this.mockMemberInfo(`[${i}]`, 4, i * 4));
            }
            return symbolInfo;
        }
        // ── MyList singletons ──────────────────────────────────────────────────────
        if (symbol === 'ValueC') {
            const s: SymbolInfo = { name: symbol, address: MYLIST_ADDR.ValueC, size: 12, member: [] };
            s.member?.push(this.mockMemberInfo('nextL', 4, 0));
            s.member?.push(this.mockMemberInfo('valueL', 4, 4));
            s.member?.push(this.mockMemberInfo('nameL', 4, 8));
            return s;
        }
        if (symbol === 'ValueB') {
            const s: SymbolInfo = { name: symbol, address: MYLIST_ADDR.ValueB, size: 12, member: [] };
            s.member?.push(this.mockMemberInfo('nextL', 4, 0));
            s.member?.push(this.mockMemberInfo('valueL', 4, 4));
            s.member?.push(this.mockMemberInfo('nameL', 4, 8));
            return s;
        }
        if (symbol === 'ValueA') {
            const s: SymbolInfo = { name: symbol, address: MYLIST_ADDR.ValueA, size: 12, member: [] };
            s.member?.push(this.mockMemberInfo('nextL', 4, 0));
            s.member?.push(this.mockMemberInfo('valueL', 4, 4));
            s.member?.push(this.mockMemberInfo('nameL', 4, 8));
            return s;
        }

        // ── Pointer to head of list ────────────────────────────────────────────────
        if (symbol === 'ListStart') {
            // global pointer variable: 4 bytes
            return { name: symbol, address: MYLIST_ADDR.ListStart, size: 4 };
        }

        // ── ValueArray (3 elements) ────────────────────────────────────────────────
        if (symbol === 'ValueArray') {
            const s: SymbolInfo = { name: symbol, address: MYLIST_ADDR.ValueArray, size: 12 * 3, member: [] };
            // Treat each element as a 12-byte "member" for convenient indexing in UIs
            s.member?.push(this.mockMemberInfo('[0]', 12, 0));
            s.member?.push(this.mockMemberInfo('[1]', 12, 12));
            s.member?.push(this.mockMemberInfo('[2]', 12, 24));
            return s;
        }

        // ── pArray (5 pointers) ───────────────────────────────────────────────────
        if (symbol === 'pArray') {
            const s: SymbolInfo = { name: symbol, address: MYLIST_ADDR.pArray, size: 4 * 5, member: [] };
            for (let i = 0; i < 5; i++) s.member?.push(this.mockMemberInfo(`[${i}]`, 4, i * 4));
            return s;
        }
        return undefined;
    }

    public mockEncodeVersion(major: number, minor: number, patch: number): number {
        const version = major * 10000000 + minor * 10000 + patch;
        return version >>> 0;
    }

    public getMockOsRtxInfoData(size: number): Uint8Array {
        // Mock memory data for osRtxInfo
        const data = new Uint8Array(size);
        data.fill(0);

        const osId = 0x12345678;
        const version = this.mockEncodeVersion(5, 1, 3);
        if (size >= 8) {
            data[0] = osId & 0xFF;
            data[1] = (osId >> 8) & 0xFF;
            data[2] = (osId >> 16) & 0xFF;
            data[3] = (osId >> 24) & 0xFF;

            data[4] = version & 0xFF;
            data[5] = (version >> 8) & 0xFF;
            data[6] = (version >> 16) & 0xFF;
            data[7] = (version >> 24) & 0xFF;
        }
        return data;
    }

    /** Slice of the 200-byte tstack, honoring the C initialization. */
    private getMockTStackSlice(size: number, offset: number): Uint8Array {
        const out = new Uint8Array(size);
        out.fill(0x8A);                       // memset(..., 0x8A, 200)

        const SENTINEL = 0xE25A2EA5 >>> 0;

        // Helper to write a u32 only if it is fully inside the requested window
        const tryWriteU32 = (globalByteOffset: number, value: number) => {
            const local = globalByteOffset - offset;
            if (local >= 0 && local + 4 <= size) {
                this.writeU32LE(out, local, value >>> 0);
            }
        };

        // tstack[0] = 0xE25A2EA5
        tryWriteU32(0, SENTINEL);

        // for (i = 49; i >= 10; i--) tstack[i] = i;
        for (let i = STACK_WORDS - 1; i >= 10; i--) {
            tryWriteU32(i * 4, i);
        }

        return out;
    }

    public getMockOsRtxConfigData(size: number): Uint8Array {
        // Mock memory data for osRtxConfig
        const data = new Uint8Array(size);
        data.fill(0);

        const flags = 0x0000000F; // example flags
        const tick_freq = 1000; // example tick frequency

        if (size >= 8) {
            data[0] = flags & 0xFF;
            data[1] = (flags >> 8) & 0xFF;
            data[2] = (flags >> 16) & 0xFF;
            data[3] = (flags >> 24) & 0xFF;

            data[4] = tick_freq & 0xFF;
            data[5] = (tick_freq >> 8) & 0xFF;
            data[6] = (tick_freq >> 16) & 0xFF;
            data[7] = (tick_freq >> 24) & 0xFF;
        }
        return data;
    }


    // ---------------------------------- Helpers ----------------------------------

    public mockMemberInfo(memberName: string, size: number, offset: number): MemberInfo {
        return {
            name: memberName,
            size,
            offset
        };
    }

    /** Write a 32-bit unsigned value in little-endian into dst at off. */
    private writeU32LE(dst: Uint8Array, off: number, value: number): void {
        dst[off + 0] = (value >>> 0) & 0xFF;
        dst[off + 1] = (value >>> 8) & 0xFF;
        dst[off + 2] = (value >>> 16) & 0xFF;
        dst[off + 3] = (value >>> 24) & 0xFF;
    }

    /** Make a (possibly truncated) C-string buffer of 'size' bytes. */
    private makeCString(text: string, size: number): Uint8Array {
        const out = new Uint8Array(size);
        const n = Math.max(0, Math.min(size - 1, text.length));
        for (let i = 0; i < n; i++) out[i] = text.charCodeAt(i) & 0xFF;
        if (size > 0) out[n] = 0; // NUL-terminate if there’s room
        return out;
    }

    /** Produce bytes for a single MyList struct. Offsets: 0=next*, 4=value (u32), 8=name* */
    private makeMyListStruct(size: number, nextPtr: number, value: number, namePtr: number): Uint8Array {
        const out = new Uint8Array(size);
        if (size >= 4)  this.writeU32LE(out, 0, nextPtr >>> 0);
        if (size >= 8)  this.writeU32LE(out, 4, value >>> 0);
        if (size >= 12) this.writeU32LE(out, 8, namePtr >>> 0);
        return out;
    }

    /** ValueC/B/A as standalone MyList values */
    public getMockValueC(size: number): Uint8Array {
        return this.makeMyListStruct(size, /*next*/0, /*value*/50, /*name*/MYLIST_ADDR.Str.ListValueC);
    }
    public getMockValueB(size: number): Uint8Array {
        return this.makeMyListStruct(size, /*next*/MYLIST_ADDR.ValueC, /*value*/12, /*name*/MYLIST_ADDR.Str.ListValueB);
    }
    public getMockValueA(size: number): Uint8Array {
        return this.makeMyListStruct(size, /*next*/MYLIST_ADDR.ValueB, /*value*/4,  /*name*/MYLIST_ADDR.Str.ListValueA);
    }

    /** ListStart holds a single pointer to ValueA */
    public getMockListStart(size: number): Uint8Array {
        const out = new Uint8Array(size);
        if (size >= 4) this.writeU32LE(out, 0, MYLIST_ADDR.ValueA);
        return out;
    }

    /** ValueArray: 3 MyList structs at ValueArray + (i * 12) */
    public getMockValueArray(size: number): Uint8Array {
        // If the caller requests the whole array at base address:
        const out = new Uint8Array(size);
        const elemSize = 12;
        const elems = [
            { next: 0, value: 10, name: MYLIST_ADDR.Str.V0 },
            { next: 0, value: 20, name: MYLIST_ADDR.Str.V1 },
            { next: 0, value: 30, name: MYLIST_ADDR.Str.V2 },
        ];
        for (let i = 0; i < elems.length; i++) {
            const base = i * elemSize;
            if (size >= base + 4)  this.writeU32LE(out, base + 0, elems[i].next);
            if (size >= base + 8)  this.writeU32LE(out, base + 4, elems[i].value);
            if (size >= base + 12) this.writeU32LE(out, base + 8, elems[i].name);
        }
        return out;
    }

    /** ValueArray[i] address reads for element-only loads (12 bytes each). */
    public getMockValueArrayElem(size: number, index: number): Uint8Array {
        const entries = [
            { next: 0, value: 10, name: MYLIST_ADDR.Str.V0 },
            { next: 0, value: 20, name: MYLIST_ADDR.Str.V1 },
            { next: 0, value: 30, name: MYLIST_ADDR.Str.V2 },
        ];
        const e = entries[index] ?? entries[0];
        return this.makeMyListStruct(size, e.next, e.value, e.name);
    }

    /** pArray: 5 pointers: &ValueA, &ValueB, &ValueC, &ValueArray[0], &ValueArray[1] */
    public getMockPArray(size: number): Uint8Array {
        const out = new Uint8Array(size);
        const ptrs = [
            MYLIST_ADDR.ValueA,
            MYLIST_ADDR.ValueB,
            MYLIST_ADDR.ValueC,
            MYLIST_ADDR.ValueArray + 12 * 0,
            MYLIST_ADDR.ValueArray + 12 * 1,
        ];
        for (let i = 0; i < ptrs.length; i++) {
            const off = i * 4;
            if (size >= off + 4) this.writeU32LE(out, off, ptrs[i]);
        }
        return out;
    }
}
