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

import { EvalContextInit } from '../evaluator';
import { ExplorerInfo, ScvdBase } from './scvdBase';
import { ScvdExpression } from './scvdExpression';

// https://arm-software.github.io/CMSIS-View/main/scvd_expression.html


export const printfHook: EvalContextInit = {
    printf: {
        format(spec, value, _ctx) {
            switch (spec) {
                // IPv4 — accepts a uint32 (network order) or a 4-byte array
                case 'I': {
                    if (typeof value === 'number' && Number.isFinite(value)) {
                        const n = value >>> 0;
                        return `${(n >>> 24) & 255}.${(n >>> 16) & 255}.${(n >>> 8) & 255}.${n & 255}`;
                    }
                    if (Array.isArray(value) && value.length === 4) {
                        const oct = value.map(x => (Number(x) & 255));
                        return `${oct[0]}.${oct[1]}.${oct[2]}.${oct[3]}`;
                    }
                    return undefined;
                }

                // MAC — accepts BigInt/number (low 48 bits) or a 6-byte array
                case 'M': {
                    const toHex2 = (x: number) => (x & 255).toString(16).padStart(2, '0').toUpperCase();

                    if (Array.isArray(value) && value.length === 6) {
                        const b = value.map(x => Number(x) & 255);
                        return `${b[0]|0}-${b[1]|0}-${b[2]|0}-${b[3]|0}-${b[4]|0}-${b[5]|0}`
                            .replace(/(?<=^|-)\\d+(?=-|$)/g, m => toHex2(+m)); // ensure hex formatting
                    }

                    if (typeof value === 'bigint') {
                        const bytes = Array.from({ length: 6 }, (_, i) =>
                            Number((value >> BigInt((5 - i) * 8)) & 0xFFn)
                        );
                        return bytes.map(toHex2).join('-');
                    }

                    if (typeof value === 'number' && Number.isFinite(value)) {
                        const n = Math.trunc(value);
                        const bytes = Array.from({ length: 6 }, (_, i) => (n >>> ((5 - i) * 8)) & 0xFF);
                        return bytes.map(toHex2).join('-');
                    }

                    return undefined;
                }

                // Extend: case 'C': case 'E': case 'J': case 'N': case 'S': case 'T': case 'U': ...

                default:
                    return undefined; // fall back to evaluator's default
            }
        },
    },
};

export class ScvdPrintExpression extends ScvdExpression {

    constructor(
        parent: ScvdBase | undefined,
        expression: string | undefined,
        scvdVarName: string,
    ) {
        super(parent, expression, scvdVarName, printfHook);
        this.expression = expression;
    }

    public configure(): boolean {
        return super.configure();
    }

    public validate(prevResult: boolean): boolean {
        return super.validate(prevResult && true);
    }

    public debug(): boolean {
        return super.debug();
    }




    public getExplorerInfo(itemInfo: ExplorerInfo[] = []): ExplorerInfo[] {
        const info: ExplorerInfo[] = [];
        info.push(...itemInfo);
        return super.getExplorerInfo(info);
    }

    public getExplorerDisplayName(): string {
        return super.getExplorerDisplayName();
    }

}
