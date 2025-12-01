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
import { ScvdRead } from '../model/scvd-read';
import { ExecutionContext } from '../scvd-eval-context';
import { StatementBase } from './statement-base';


export class StatementRead extends StatementBase {

    constructor(item: ScvdBase, parent: StatementBase | undefined) {
        super(item, parent);
    }

    protected onExecute(executionContext: ExecutionContext): void {
        const mustRead = this.scvdItem.mustRead;
        if(mustRead === false) {
            console.log(`${this.line} Skipping "read" as already initialized: ${this.scvdItem.name}`);
            return;
        }

        const scvdRead = this.scvdItem.castToDerived(ScvdRead);
        if (scvdRead === undefined) {
            return;
        }

        const type = scvdRead.type;
        if(type === undefined) {
            console.error(`${this.line} Executing "read": ${scvdRead.name}, no type defined`);
            return;
        }

        const typeSize = type.getElementReadSize(); // use size specified in SCVD
        if(typeSize === undefined) {
            console.error(`${this.line} Executing "read": ${scvdRead.name}, type: ${type.getExplorerDisplayName()}, could not determine type size`);
            return;
        }
        const actualSize = type.getSize() ?? typeSize;

        const readBytes = (scvdRead.size?.getValue() ?? 1) * typeSize; // Is an Expressions representing the array size or the number of values to read from target. The maximum array size is limited to 512. Default value is 1.
        const name = scvdRead.name;
        if(name === undefined) {
            console.error(`${this.line}: Executing "read": no name defined`);
            return;
        }

        let baseAddress: number | undefined = undefined;

        // Check if symbol address is defined
        const symbol = scvdRead.symbol;
        if(symbol?.symbol !== undefined) {
            const symAddr = executionContext.debugTarget.findSymbolAddress(symbol.symbol);
            if(symAddr === undefined) {
                console.error(`${this.line}: Executing "read": ${scvdRead.name}, symbol: ${symbol?.name}, could not find symbol address for symbol: ${symbol?.symbol}`);
                return;
            }
            baseAddress = symAddr;
        }

        const offset = scvdRead.offset?.getValue();
        if(offset !== undefined) {
            baseAddress = baseAddress
                ? baseAddress + offset
                : offset;
        }

        if(baseAddress === undefined) {
            console.error(`${this.line}: Executing "read": ${scvdRead.name}, symbol: ${symbol?.name}, could not find symbol address for symbol: ${symbol?.symbol}`);
            return;
        }

        const readData = executionContext.debugTarget.readMemory(baseAddress, readBytes);
        if(readData === undefined) {
            console.error(`${this.line}: Executing "read": ${scvdRead.name}, symbol: ${symbol?.name}, address: ${baseAddress}, size: ${readBytes} bytes, readMemory failed`);
            return;
        }

        executionContext.memoryHost.setVariable(name, readBytes, readData, baseAddress, actualSize);

        if(scvdRead.const === true) {   // Mark variable as already initialized
            scvdRead.mustRead = false;
        }
        console.log(`${this.line}: Executing target read: ${scvdRead.name}, symbol: ${symbol?.name}, address: ${baseAddress}, size: ${readBytes} bytes`);
        return;
    }
}
