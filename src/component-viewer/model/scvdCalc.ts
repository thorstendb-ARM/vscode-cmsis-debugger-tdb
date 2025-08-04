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
import { ScvdItem } from './scvdItem';
import { ScvdCondition } from './scvdScvdCondition';

export class ScvdCalc extends ScvdItem {
    private _cond: ScvdCondition;
    private _expressions: ScvdExpression[] = [];

    constructor(
        parent: ScvdItem | undefined,
    ) {
        super(parent);
        this._cond = new ScvdCondition(this);
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

    get expressions(): ScvdExpression[] {
        return this._expressions;
    }

    addExpression(value: string): void {
        const expr = new ScvdExpression(this, value);
        this._expressions.push(expr);
    }

}
