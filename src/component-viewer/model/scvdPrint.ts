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

// https://arm-software.github.io/CMSIS-View/main/elem_component_viewer.html

import { ScvdBase } from './scvdBase';
import { ScvdExpression } from './scvdExpression';
import { ScvdValueOutput } from './scvdValueOutput';
import { ScvdCondition } from './scvdCondition';

export class ScvdPrint extends ScvdBase {
    private _cond: ScvdCondition;
    private _property: ScvdValueOutput;
    private _value: ScvdExpression;
    private _bold: ScvdCondition;
    private _alert: ScvdCondition;

    constructor(
        parent: ScvdBase | undefined,
        cond: string,
        property: string,
        value: string,
        bold: string = '0',
        alert: string = '0',
    ) {
        super(parent);
        this._cond = new ScvdCondition(this, cond);
        this._property = new ScvdValueOutput(property);
        this._value = new ScvdExpression(this, value);
        this._bold = new ScvdCondition(this, bold);
        this._alert = new ScvdCondition(this, alert);
    }

    get property(): ScvdValueOutput {
        return this._property;
    }

    get value(): ScvdExpression {
        return this._value;
    }

    get cond(): ScvdCondition {
        return this._cond;
    }

    get bold(): ScvdCondition {
        return this._bold;
    }

    get alert(): ScvdCondition {
        return this._alert;
    }

}
