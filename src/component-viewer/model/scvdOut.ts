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

import { ScvdDataType } from './scvdDataType';
import { ScvdExpression } from './scvdExpression';
import { ScvdItem } from './scvdItem';
import { ScvdCondition } from './scvdScvdCondition';

export class ScvdOut extends ScvdItem {
    private _value: ScvdExpression | undefined; // name._value — expression that evaluates to the value of the output.
    private _type: ScvdDataType | undefined;
    private _cond: ScvdCondition;

    constructor(
        parent: ScvdItem | undefined,
    ) {
        super(parent);
        this._cond = new ScvdCondition(this);
    }

    public set value(value: string) {
        this._value = new ScvdExpression(this, value);
    }
    public get value(): ScvdExpression | undefined {
        return this._value;
    }
    public set type(value: string) {
        this._type = new ScvdDataType(this, value);
    }
    public get type(): ScvdDataType | undefined {
        return this._type;
    }
}
