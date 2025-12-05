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
import { ScvdExpression } from '../model/scvd-expression';
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

        // ---- fetch item name ----
        const itemName = scvdReadList.name;
        if(itemName === undefined) {
            console.error(`${this.line}: Executing "read": no name defined`);
            return;
        }

        // ---- handle init ----
        const init = scvdReadList.getInit();    // When init="1" previous read items in the list are discarded. Default value is 0.
        if(init === 1) {
            executionContext.memoryHost.clearVariable(itemName);
        }

        // ---- fetch type size ----
        const targetSize = scvdReadList.getTargetSize();
        if(targetSize === undefined) {
            console.error(`${this.line} Executing "read": ${scvdReadList.name}, type: ${scvdReadList.getExplorerDisplayName()}, could not determine target size`);
            return;
        }
        const virtualSize = scvdReadList.getVirtualSize() ?? targetSize;    // if type has <var> members, include their size in the variable allocation

        // ---- calculate read size ----
        const based = scvdReadList.getIsPointer();  // When based="1" the attribute symbol and attribute offset specifies a pointer (or pointer array). Default value is 0.
        const readBytes = (based === true)? 4 : targetSize;

        // ---- calculate base address from symbol and/or offset ----
        let baseAddress: number | undefined = undefined;

        // Check if symbol address is defined, use as base address
        const symbol = scvdReadList.symbol;
        if(symbol?.symbol !== undefined) {
            const symAddr = executionContext.debugTarget.findSymbolAddress(symbol.symbol);
            if(symAddr === undefined) {
                console.error(`${this.line}: Executing "read": ${scvdReadList.name}, symbol: ${symbol?.name}, could not find symbol address for symbol: ${symbol?.symbol}`);
                return;
            }
            baseAddress = symAddr;
        }

        // Add offset to base address. If no symbol defined, offset is used as base address
        const offset = scvdReadList.offset?.getValue(); // Offset is attr: size plus var symbols!
        if(offset !== undefined) {
            baseAddress = baseAddress
                ? baseAddress + offset
                : offset;
        }

        // Check that base address is valid
        if(baseAddress === undefined) {
            console.error(`${this.line}: Executing "read": ${scvdReadList.name}, symbol: ${symbol?.name}, could not find symbol address for symbol: ${symbol?.symbol}`);
            return;
        }

        // ---- prepare for linked list read if next member is defined ----
        let nextOffset: number | undefined = undefined;
        let nextTargetSize: number | undefined = undefined;

        const next = scvdReadList.getNext();    // Name of a member element in the list that is used as next pointer. This is used to read a linked list. <readlist> stops reading on a NULL pointer.
        if(next !== undefined) {
        // ---- fetch type info ----
            const typeItem = scvdReadList.type;
            if(typeItem === undefined) {
                console.error(`${this.line} Executing "read": ${scvdReadList.name}, no type defined`);
                return;
            }

            const nextMember = typeItem.getMember(next);
            if(nextMember !== undefined) {
                nextTargetSize = nextMember.getTargetSize();
                nextOffset = nextMember.getMemberOffset();
                if(nextTargetSize === undefined || nextOffset === undefined) {
                    console.error(`${this.line}: Executing "read": ${scvdReadList.name}, symbol: ${symbol?.name}, could not determine size/offset of next member: ${next} in type: ${typeItem.getExplorerDisplayName()}`);
                    return;
                }
                if(nextTargetSize > 4) {
                    console.error(`${this.line}: Executing "read": ${scvdReadList.name}, symbol: ${symbol?.name}, next member: ${next} size is larger than 4 bytes (${nextTargetSize} bytes)`);
                    return;
                }
            }
        }

        // ---- fetch count of items to read. count is always 1..1024 ----
        const count = scvdReadList.getCount();  // Number of list items to read, default is 1. Limited to 1..1024 in ScvdExpression.

        // ---- calculate next address ----
        let nextPtrAddr: number | undefined = baseAddress;

        let readIdx = 0;
        while(nextPtrAddr !== undefined) {
            const itemAddress = nextPtrAddr;
            const readData = executionContext.debugTarget.readMemory(itemAddress, readBytes);
            if(readData === undefined) {
                console.error(`${this.line}: Executing "read": ${scvdReadList.name}, symbol: ${symbol?.name}, address: ${baseAddress}, size: ${readBytes} bytes, readMemory failed`);
                return;
            }

            executionContext.memoryHost.setVariable(itemName, readBytes, readData, itemAddress, virtualSize);

            // calculate next address
            if(next) {
                if(nextTargetSize === undefined || nextOffset === undefined) {
                    return;
                }
                //const nextU8Arr = executionContext.debugTarget.readMemory(nextPtrAddr + nextOffset, nextTargetSize);
                const exprStr = `${itemName}[${readIdx}].${next}`;
                const expr = new ScvdExpression(undefined, exprStr, '');
                expr.configure();
                expr.setExecutionContext(executionContext);
                expr.evaluate();
                const result = expr.result;
                if(result === undefined) {
                    console.error(`${this.line}: Executing "read": ${scvdReadList.name}, symbol: ${symbol?.name}, could not evaluate next pointer expression: ${exprStr}`);
                    return;
                }
                if (typeof result !== 'number') {
                    console.error(`${this.line}: Executing "read": ${scvdReadList.name}, symbol: ${symbol?.name}, next pointer expression: ${exprStr} did not evaluate to a number`);
                    return;
                }
                nextPtrAddr = result;
            } else {
                nextPtrAddr = baseAddress + (based ? (readIdx * 4) : (readIdx * targetSize));
            }

            if(nextPtrAddr === 0) {
                break;  // NULL pointer, end of linked list
            }
            readIdx ++;

            // check count
            if(count !== undefined && readIdx >= count) {
                break;
            }
        }


        if(scvdReadList.const === true) {   // Mark variable as already initialized
            scvdReadList.mustRead = false;
        }
        console.log(`${this.line}: Executing target read: ${scvdReadList.name}, symbol: ${symbol?.name}, address: ${baseAddress}, size: ${readBytes} bytes`);
        return;
    }

}
