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

// https://arm-software.github.io/CMSIS-View/main/elem_calc.html

import { ScvdExpression } from './scvdExpression';
import { Json, ScvdBase } from './scvdBase';
import { ScvdCondition } from './scvdCondition';

export class ScvdCalc extends ScvdBase {
    private _cond: ScvdCondition | undefined;
    private _expression: ScvdExpression[] = [];

    constructor(
        parent: ScvdBase | undefined,
    ) {
        super(parent);
    }

    public readXml(xml: Json): boolean {
        if (xml === undefined ) {
            return false;
        }

        const cond = xml.cond;
        if( cond !== undefined) {
            this._cond = new ScvdCondition(cond);
        }

        // Extract raw text body (multiline) from the XML JSON object.
        // Depending on the XML-to-JSON converter, text may reside in '#text', '_', or 'text'.
        let expressions: string[] = [];
        const text: string | undefined = typeof xml === 'string'
            ? xml
            : (xml?.['#text'] ?? xml?._ ?? xml?.text);
        if (typeof text === 'string') {
            expressions = text
                .split(/\r?\n/)
                .map(l => l.trim())
                .filter(l => l.length > 0);

            if (expressions.length > 0) {
                expressions.forEach( (v: string) => {
                    this.addExpression(v);
                });
            }
        }

        return super.readXml(xml);
    }

    get cond(): ScvdCondition | undefined {
        return this._cond;
    }

    set cond(value: string | undefined) {
        if (value) {
            this._cond = new ScvdCondition(this);
            this._cond.expression = value;
        }
    }

    get expression(): ScvdExpression[] {
        return this._expression;
    }

    addExpression(value: string): void {
        const expr = new ScvdExpression(this, value);
        this._expression.push(expr);
    }

}
