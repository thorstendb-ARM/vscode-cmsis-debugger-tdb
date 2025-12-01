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

import { ScvdBase } from '../model/scvd-base';
import { ScvdComplexDataType } from '../model/scvd-data-type';
import { ScvdReadList } from '../model/scvd-readlist';
import { ExecutionContext } from '../scvd-eval-context';
import { StatementBase } from './statement-base';


export class StatementReadList extends StatementBase {

    constructor(item: ScvdBase, parent: StatementBase | undefined) {
        super(item, parent);
    }

    protected onExecute(executionContext: ExecutionContext): void {
        const mustRead = this.scvdItem.mustRead;
        if(mustRead === false) {
            console.log(`${this.line} Skipping "read" as already initialized: ${this.scvdItem.name}`);
            return;
        }

        const scvdReadList = this.scvdItem.castToDerived(ScvdReadList);
        if (scvdReadList === undefined) {
            return;
        }

        const type = scvdReadList.type;
        if(type === undefined) {
            console.error(`${this.line} Executing "read": ${scvdReadList.name}, no type defined`);
            return;
        }

        const typeSize = type.getElementReadSize(); // use size specified in SCVD
        if(typeSize === undefined) {
            console.error(`${this.line} Executing "read": ${scvdReadList.name}, type: ${type.getExplorerDisplayName()}, could not determine type size`);
            return;
        }
        const actualSize = type.getSize() ?? typeSize;
        const readBytes = (scvdReadList.size?.getValue() ?? 1) * typeSize; // Is an Expressions representing the array size or the number of values to read from target. The maximum array size is limited to 512. Default value is 1.
        const itemName = scvdReadList.name;
        if(itemName === undefined) {
            console.error(`${this.line}: Executing "read": no name defined`);
            return;
        }

        const init = scvdReadList.getInit();    // When init="1" previous read items in the list are discarded. Default value is 0.
        if(init === 1) {
            executionContext.memoryHost.clearVariable(itemName);
        }

        let baseAddress: number | undefined = undefined;

        // Check if symbol address is defined
        const symbol = scvdReadList.symbol;
        if(symbol?.symbol !== undefined) {
            const symAddr = executionContext.debugTarget.findSymbolAddress(symbol.symbol);
            if(symAddr === undefined) {
                console.error(`${this.line}: Executing "read": ${scvdReadList.name}, symbol: ${symbol?.name}, could not find symbol address for symbol: ${symbol?.symbol}`);
                return;
            }
            baseAddress = symAddr;
        }

        const offset = scvdReadList.offset?.getValue(); // Offset is attr: size plus var symbols!
        if(offset !== undefined) {
            baseAddress = baseAddress
                ? baseAddress + offset
                : offset;
        }

        if(baseAddress === undefined) {
            console.error(`${this.line}: Executing "read": ${scvdReadList.name}, symbol: ${symbol?.name}, could not find symbol address for symbol: ${symbol?.symbol}`);
            return;
        }

        const count = scvdReadList.getCount();  // Number of list items to read from an array. Default value is 1.
        const next = scvdReadList.getNext();    // Name of a member element in the list that is used as next pointer. This is used to read a linked list. <readlist> stops reading on a NULL pointer.
        const based = scvdReadList.getBased();  // When based="1" the attribute symbol and attribute offset specifies a pointer (or pointer array). Default value is 0.

        if(next !== undefined) {
            const typeItem = type.type?.castToDerived(ScvdComplexDataType);
            if(typeItem === undefined) {
                console.error(`${this.line}: Executing "read": ${scvdReadList.name}, symbol: ${symbol?.name}, type: ${type.getExplorerDisplayName()} is not a complex data type`);
                return;
            }
            const nextMember = typeItem.getMember(next);
            if(nextMember === undefined) {
                console.error(`${this.line}: Executing "read": ${scvdReadList.name}, symbol: ${symbol?.name}, could not find next member: ${next} in type: ${type.getExplorerDisplayName()}`);
                return;
            }

            const nextMemberSize = nextMember.getSize();
            const nextMemberOffset = nextMember.getMemberOffset();
            if(nextMemberSize === undefined || nextMemberOffset === undefined) {
                console.error(`${this.line}: Executing "read": ${scvdReadList.name}, symbol: ${symbol?.name}, could not determine size/offset of next member: ${next} in type: ${type.getExplorerDisplayName()}`);
                return;
            }
            if(nextMemberSize > 4) {
                console.error(`${this.line}: Executing "read": ${scvdReadList.name}, symbol: ${symbol?.name}, next member: ${next} size is larger than 4 bytes (${nextMemberSize} bytes)`);
                return;
            }

            this.readNext(
                executionContext,
                actualSize,
                nextMemberSize,
                nextMemberOffset,
                baseAddress,
                readBytes,
                itemName,
                scvdReadList,
                symbol,
            );
        } else if(count > 0) {
            this.readCount(
                executionContext,
                actualSize,
                count,
                baseAddress,
                typeSize,
                readBytes,
                based,
                itemName,
                scvdReadList,
                symbol
            );
        }

        if(scvdReadList.const === true) {   // Mark variable as already initialized
            scvdReadList.mustRead = false;
        }
        console.log(`${this.line}: Executing target read: ${scvdReadList.name}, symbol: ${symbol?.name}, address: ${baseAddress}, size: ${readBytes} bytes`);
        return;
    }

    private readNext(
        executionContext: ExecutionContext,
        actualSize: number,
        nextSize: number,
        nextOffset: number,
        baseAddress: number,
        readBytes: number,
        itemName: string,
        scvdReadList: ScvdReadList,
        symbol: ScvdBase | undefined,
    ): void {
        let nextPtrAddr: number | undefined = baseAddress;

        while(nextPtrAddr !== undefined && nextPtrAddr !== 0) {
            const itemAddress = nextPtrAddr;
            const readData = executionContext.debugTarget.readMemory(itemAddress, readBytes);
            if(readData === undefined) {
                console.error(`${this.line}: Executing "read": ${scvdReadList.name}, symbol: ${symbol?.name}, address: ${baseAddress}, size: ${readBytes} bytes, readMemory failed`);
                return;
            }

            executionContext.memoryHost.setVariable(itemName, readBytes, readData, itemAddress, actualSize);

            const nextU8Arr = executionContext.debugTarget.readMemory(nextPtrAddr + nextOffset, nextSize);
            if(nextU8Arr !== undefined) {
                nextPtrAddr = executionContext.debugTarget.convertMemoryToNumber(nextU8Arr);
            } else {
                nextPtrAddr = undefined;
            }
        }
    }

    private readCount(
        executionContext: ExecutionContext,
        actualSize: number,
        count: number,
        baseAddress: number,
        typeSize: number,
        readBytes: number,
        based: boolean,
        itemName: string,
        scvdReadList: ScvdReadList,
        symbol: ScvdBase | undefined,
    ): void {
        for(let i = 0; i < count; i++) {
            const itemAddress = baseAddress + (based ? i * 4 : i * typeSize);
            const readData = executionContext.debugTarget.readMemory(itemAddress, readBytes);
            if(readData === undefined) {
                console.error(`${this.line}: Executing "read": ${scvdReadList.name}, symbol: ${symbol?.name}, address: ${baseAddress}, size: ${readBytes} bytes, readMemory failed`);
                return;
            }

            executionContext.memoryHost.setVariable(itemName, readBytes, readData, itemAddress, actualSize);
        }
    }

}
