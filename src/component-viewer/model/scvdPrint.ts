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
import { ScvdProperty } from './scvdProperty';
import { ScvdCondition } from './scvdScvdCondition';

export class ScvdPrint extends ScvdBase {
    private _cond: ScvdCondition;
    private _property: ScvdProperty;
    private _value: ScvdExpression;
    private _bold: ScvdCondition;
    private _alert: ScvdCondition;


    constructor(
        parent: ScvdBase | undefined,
    ) {
        super(parent);
        this._cond = new ScvdCondition(this); // default is 1
        this._property = new ScvdProperty(this);
        this._value = new ScvdExpression(this, '0'); // default is 0
        this._bold = new ScvdCondition(this, '0'); // default is 0
        this._alert = new ScvdCondition(this, '0'); // default is 0
    }

    set property(value: string) {
        this._property.text = value;
        this.isModified = true;
    }

    get property(): ScvdProperty {
        return this._property;
    }

    set value(value: string) {
        this._value = new ScvdExpression(this, value);
        this.isModified = true;
    }

    get value(): ScvdExpression {
        return this._value;
    }

    get cond(): ScvdCondition {
        return this._cond;
    }

    set cond(value: string) {
        this._cond = new ScvdCondition(this, value);
    }

    get bold(): ScvdCondition {
        return this._bold;
    }

    set bold(value: string) {
        this._bold = new ScvdCondition(this, value);
    }

    get alert(): ScvdCondition {
        return this._alert;
    }

    set alert(value: string) {
        this._alert = new ScvdCondition(this, value);
    }
}
