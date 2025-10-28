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

import { CacheCbFunc, ScvdCacheBase, ScvdValueRecord } from './ScvdCacheBase';

// https://arm-software.github.io/CMSIS-View/main/elem_var.html


function registerReadMock(name: string): number | undefined {
    // mock function for register read
    // in real implementation this should read the register from the target

    switch (name) {
        case 'R0':
            return 10000000;
        case 'R1':
            return 10000000 + 1;
        case 'R2':
            return 10000000 + 2;
        case 'R3':
            return 10000000 + 3;
        case 'R4':
            return 10000000 + 4;
        case 'R5':
            return 10000000 + 5;
        case 'R6':
            return 10000000 + 6;
        case 'R7':
            return 10000000 + 7;
        case 'R8':
            return 10000000 + 8;
        case 'R9':
            return 10000000 + 9;
        case 'R10':
            return 10000000 + 10;
        case 'R11':
            return 10000000 + 11;
        case 'R12':
            return 10000000 + 12;
        case 'R13':
        case 'SP':
            return 10000000 + 13;
        case 'R14':
        case 'LR':
            return 10000000 + 14;
        case 'R15':
        case 'PC':
            return 10000000 + 15;
        case 'MSP_NS':
            return 10000000 + 16;
        case 'PSP_NS':
            return 10000000 + 17;
        case 'PSP_S':
            return 10000000 + 18;
        case 'MSPLIM_S':
            return 10000000 + 19;
        case 'PSPLIM_S':
            return 10000000 + 20;
        case 'MSPLIM_NS':
            return 10000000 + 21;
        case 'PSPLIM_NS':
            return 10000000 + 22;
        case 'SYSREGS_S':
            return 10000000 + 23;
        case 'SYSREGS_NS':
            return 10000000 + 24;
        case 'SECURITY':
            return 10000000 + 25;
        default:
            return undefined;
    }
}


export class ScvdCacheRegister extends ScvdCacheBase<string> {

    constructor(
    ) {
        super();
    }

    private cbFunc: CacheCbFunc<string> = (key: string): ScvdValueRecord => {
        const value = registerReadMock(key);
        if (value !== undefined) {
            return {
                value: value,
                accCnt: this.DEFAULT_ACC_CNT,
                valid: true
            };
        } else {
            return {
                value: 0,
                accCnt: 0,
                valid: false,
                toBeRemoved: true
            };
        }
    };

    public readRegister(name: string): number | undefined {
        const record = this.readAddValue(name, this.cbFunc);
        return record?.valid ? record.value : undefined;
    }

    public writeRegister(name: string, value: number): void {
        this.writeAddValue(name, value);
    }

}

export const registerCache = new ScvdCacheRegister();

