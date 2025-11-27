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


export interface MemberInfo {
    name: string;
    size: number;
    offset: number;
}

export interface SymbolInfo {
    name: string;
    address: number;
    size: number;
    member: MemberInfo[];
}

export class ScvdDebugTarget {

    constructor(
    ) {
    }

    public getSymbolInfo(symbol: string): SymbolInfo | undefined {
        if(symbol === undefined) {
            return undefined;
        }

        return this.getMockSymbolInfo(symbol);
    }

    public findSymbolAddress(symbol: string): number | undefined {
        const symbolInfo = this.getSymbolInfo(symbol);
        if(symbolInfo === undefined) {
            return undefined;
        }
        return symbolInfo.address;
    }

    public calculateMemoryUsage(startAddress: number, size: number, FillPattern: number, MagicValue: number): number | undefined {
        const memData = this.getMockMemoryData(startAddress, size);
        if(memData !== undefined) {
            let usedBytes = 0;
            const patternBytes1 = new Uint8Array(4);
            const patternBytes2 = new Uint8Array(4);
            // Use FillPattern for the fill pattern bytes (little-endian)
            patternBytes1[0] = (FillPattern & 0xFF);
            patternBytes1[1] = (FillPattern >> 8) & 0xFF;
            patternBytes1[2] = (FillPattern >> 16) & 0xFF;
            patternBytes1[3] = (FillPattern >> 24) & 0xFF;
            // Use MagicValue for the magic value bytes (little-endian)
            patternBytes2[0] = (MagicValue & 0xFF);
            patternBytes2[1] = (MagicValue >> 8) & 0xFF;
            patternBytes2[2] = (MagicValue >> 16) & 0xFF;
            patternBytes2[3] = (MagicValue >> 24) & 0xFF;

            for(let i = 0; i < memData.length; i += 4) {
                const chunk = memData.slice(i, i + 4);
                let match = true;
                for(let j = 0; j < chunk.length; j++) {
                    if(chunk[j] !== patternBytes1[j]) {
                        match = false;
                        break;
                    }
                }
                if(!match) {
                    match = true;
                    for(let j = 0; j < chunk.length; j++) {
                        if(chunk[j] !== patternBytes2[j]) {
                            match = false;
                            break;
                        }
                    }
                }
                if(!match) {
                    usedBytes += chunk.length;
                }
            }

            const usedPercent = Math.floor((usedBytes / size) * 100) & 0x1FF;
            let result = usedBytes & 0xFFFFF; // bits 0..19
            result |= (usedPercent << 20); // bits 20..28

            // Check for overflow (MagicValue overwritten)
            const magicBytes = new Uint8Array(4);
            magicBytes[0] = (MagicValue & 0xFF);
            magicBytes[1] = (MagicValue >> 8) & 0xFF;
            magicBytes[2] = (MagicValue >> 16) & 0xFF;
            magicBytes[3] = (MagicValue >> 24) & 0xFF;

            let overflow = true;
            for(let i = memData.length - 4; i < memData.length; i++) {
                if(memData[i] !== magicBytes[i - (memData.length - 4)]) {
                    overflow = false;
                    break;
                }
            }
            if(overflow) {
                result |= (1 << 31); // set overflow bit
            }

            return result;
        }

        return undefined;
    }

    private getMockMemoryData(_startAddress: number, size: number): Uint8Array | undefined {
        // Mock memory data for tstack
        const data = new Uint8Array(size);
        // Fill with pattern 0x8A8A8A8A
        for(let i = 0; i < size; i +=4) {
            data[i] = 0x8A;
            data[i+1] = 0x8A;
            data[i+2] = 0x8A;
            data[i+3] = 0x8A;
        }
        // Overwrite some bytes to simulate usage
        data[0] = 0x00;
        data[1] = 0x00;
        data[2] = 0x00;
        data[3] = 0x00;

        // Set MagicValue at the end
        const magicOffset = size - 4;
        data[magicOffset] = 0xA5;
        data[magicOffset + 1] = 0x2E;
        data[magicOffset + 2] = 0x5A;
        data[magicOffset + 3] = 0xE2;

        return data;
    }

    private getMockSymbolInfo(symbol: string): SymbolInfo | undefined {
        if(symbol === 'mySymbol') {
            const symbolInfo: SymbolInfo = { name: symbol, address: 0x12345678, size: 4*1, member: [] };
            symbolInfo.member.push(this.mockMemberInfo('A', 1, 4+0));
            symbolInfo.member.push(this.mockMemberInfo('B', 1, 4+1));
            symbolInfo.member.push(this.mockMemberInfo('C', 1, 4+2));
            symbolInfo.member.push(this.mockMemberInfo('D', 1, 4+3));
            return symbolInfo;
        }
        if(symbol === 'tstack') {
            const symbolInfo: SymbolInfo = { name: symbol, address: 0x20002000, size: 4*1, member: [] };
            return symbolInfo;
        }
        return undefined;
    }

    private mockMemberInfo(memberName: string, size: number, offset: number): MemberInfo {
        return {
            name: memberName,
            size,
            offset
        };
    }

}
