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

export class ScvdExpression {
    private _expression: string | undefined;
    private _result: NumberType | undefined;

    constructor(
        expression: string | undefined
    ) {
        this._expression = expression;
    }

    public get expression(): string | undefined {
        return this._expression;
    }
    public set expression(value: string | undefined) {
        this._expression = value;
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
}
