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
import { StatementBase } from './statement-base';


export class StatementRead extends StatementBase {

    constructor(item: ScvdBase, parent: StatementBase | undefined) {
        super(item, parent);
    }

    protected onExecute(): void {
        const scvdRead = this.scvdItem.castToDerived(ScvdRead);
        if (scvdRead === undefined) {
            return;
        }

        const type = scvdRead.type;
        if(type === undefined) {
            console.error(`${this.line} Executing "read": ${scvdRead.name}, no type defined`);
            return;
        }
        const size = scvdRead.size;
        let readLength: number = 4;
        if(size !== undefined) {
            const sizeValue = size.value;
            if(typeof sizeValue === 'number') {
                readLength = sizeValue;
                console.log(`${this.line} Executing "read": ${scvdRead.name}, size expression: ${size.expression}, value: ${readLength}`);
            }
        }


        const symbol = scvdRead.symbol;
        //const offset = scvdRead.offset;
        //const endian = scvdRead.endian;



        const offsetExpr = scvdRead.offset;
        if(symbol?.name === undefined && offsetExpr === undefined) {
            console.error(`${this.line}: Executing "read": ${scvdRead.name}, no symbol or offset defined`);
            return;
        }

        console.log(`${this.line}: Executing "read": ${scvdRead.name}, symbol: ${symbol?.name}, offset: ${offsetExpr?.expression}`);
        return;
    }


}
