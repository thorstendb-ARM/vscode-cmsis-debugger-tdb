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

// https://arm-software.github.io/CMSIS-View/main/scvd_expression.html

import { NumberType } from './numberType';
import { ExplorerInfo, ScvdBase } from './scvdBase';

export class ScvdExpression extends ScvdBase {
    private _expression: string | undefined;
    private _result: NumberType | undefined;

    constructor(
        parent: ScvdBase | undefined,
        expression: string | undefined
    ) {
        super(parent);
        this.expression = expression;
    }

    public get expression(): string | undefined {
        return this._expression;
    }
    public set expression(value: string | undefined) {
        this._expression = value;
    }

    public get result(): NumberType | undefined {
        return this._result;
    }

    public get value(): NumberType {
        if( this._result === undefined) {
            this._result = this.evaluate();
        }
        return this._result ?? new NumberType(1);
    }

    public setMinMax(min: number | undefined, max: number | undefined) {
        if (this._result) {
            this._result.setMinMax(min, max);
        }
    }

    public getResultBoolean(): boolean {
        return this.value !== undefined && this.value.value > 0;
    }

    // Method to evaluate the expression, returns size in bytes
    public evaluate(): NumberType | undefined {
        if (this._expression === undefined) {
            return undefined;
        }

        try {
            // Simple evaluation logic, can be extended for complex expressions
            this._result = new NumberType(42); //eval(this._expression);
            return this._result;
        } catch (error) {
            console.error('Error evaluating expression:', error);
            return undefined;
        }
    }

    public getExplorerInfo(itemInfo: ExplorerInfo[] = []): ExplorerInfo[] {
        const info: ExplorerInfo[] = [];
        if (this.expression) {
            info.push({ name: 'Expression', value: this.expression });
        }
        if(this.result) {
            info.push({ name: 'Result', value: this.result.getDisplayText() });
        }
        if (this.value) {
            info.push({ name: 'Value', value: this.value.getDisplayText() });
        }
        info.push(...itemInfo);
        return super.getExplorerInfo(info);
    }

    public getExplorerDisplayName(): string {
        const expression = this.expression ?? '';
        const firstIdx = [expression.indexOf('='), expression.indexOf('(')]
            .filter(i => i !== -1)
            .reduce((min, i) => (min === -1 || i < min ? i : min), -1);
        if (firstIdx !== -1) {
            const exprStr = expression.substring(0, firstIdx + 1).trim();
            if (exprStr) {
                return exprStr;
            }
        }
        return expression;
    }

}
