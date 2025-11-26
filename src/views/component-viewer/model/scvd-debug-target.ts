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

// https://arm-software.github.io/CMSIS-View/main/elem_component_viewer.html

export interface MemberInfo {
    name: string;
    size: number;
    offset: number;
}

export interface SymbolInfo {
    name: string;
    address: number;
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

    private getMockSymbolInfo(symbol: string): SymbolInfo | undefined {
        if(symbol === 'mySymbol') {
            const symbolInfo: SymbolInfo = { name: symbol, address: 0x12345678, member: [] };
            symbolInfo.member.push(this.mockMemberInfo('A', 1, 4+0));
            symbolInfo.member.push(this.mockMemberInfo('B', 1, 4+1));
            symbolInfo.member.push(this.mockMemberInfo('C', 1, 4+2));
            symbolInfo.member.push(this.mockMemberInfo('D', 1, 4+3));
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
