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

import { DebugTargetMock } from './debug-target-mock';


export interface MemberInfo {
    name: string;
    size: number;
    offset: number;
}

export interface SymbolInfo {
    name: string;
    address: number;
    size: number;
    member?: MemberInfo[];
}

export class ScvdDebugTarget {
    private mock = new DebugTargetMock();

    constructor(
    ) {
    }

    // -------------  Interface to debugger  -----------------
    public getSymbolInfo(symbol: string): SymbolInfo | undefined {
        if(symbol === undefined) {
            return undefined;
        }

        return this.mock.getMockSymbolInfo(symbol);
    }

    public getNumArrayElements(symbol: string): number | undefined {
        if(symbol === undefined) {
            return undefined;
        }

        const symbolInfo = this.mock.getMockSymbolInfo(symbol);
        if(symbolInfo !== undefined) {
            return symbolInfo?.member?.length ?? 1;
        }
        return undefined;
    }

    public findSymbolAddress(symbol: string): number | undefined {
        const symbolInfo = this.getSymbolInfo(symbol);
        if(symbolInfo === undefined) {
            return undefined;
        }
        return symbolInfo.address;
    }

    public readMemory(address: number, size: number): Uint8Array | undefined {
        // For testing, return mock data
        return this.mock.getMockMemoryData(address, size);
    }



    // -------------  Utility functions  -----------------
    public convertMemoryToNumber(data: Uint8Array): number | undefined {
        if(data === undefined || data.length === 0 || data.length > 4) {
            return undefined;
        }

        let value = 0;
        for(let i = 0; i < data.length; i++) {
            value |= (data[i] << (i * 8)); // little-endian
        }
        return value;
    }

    public calculateMemoryUsage(startAddress: number, size: number, FillPattern: number, MagicValue: number): number | undefined {
        const memData = this.mock.getMockMemoryData(startAddress, size);
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

}
