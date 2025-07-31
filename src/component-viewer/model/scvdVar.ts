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

// https://arm-software.github.io/CMSIS-View/main/elem_var.html

import { ScvdDataType } from './scvdDataType';
import { ScvdExpression } from './scvdExpression';
import { ScvdItem } from './scvdItem';

export class ScvdVar extends ScvdItem {
    private _value: ScvdExpression | undefined;
    private _type: ScvdDataType | undefined;

    constructor(
        parent: ScvdItem | undefined,
    ) {
        super(parent);
    }

    public get value(): ScvdExpression | undefined {
        return this._value;
    }
    public set value(value: string | undefined) {
        this._value = new ScvdExpression(this);
        this._value.expression = value;
    }

    get type(): ScvdDataType | undefined {
        return this._type;
    }
    set type(value: ScvdDataType) {
        if (!this._type) {
            this._type = new ScvdDataType(this);
        }
        this._type = value;
    }

}
