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
import { Json, ScvdBase } from './scvdBase';

export class ScvdVar extends ScvdBase {
    private _value: ScvdExpression | undefined;
    private _type: ScvdDataType | undefined;

    constructor(
        parent: ScvdBase | undefined,
    ) {
        super(parent);
    }

    public readXml(xml: Json): boolean {
        if (xml === undefined ) {
            return false;
        }

        this.value = xml.value;
        this.type = xml.type;

        return super.readXml(xml);
    }

    public get value(): ScvdExpression | undefined {
        return this._value;
    }
    public set value(value: string) {
        this._value = new ScvdExpression(this, value);
    }

    get type(): ScvdDataType | undefined {
        return this._type;
    }
    set type(value: string) {
        this._type = new ScvdDataType(this, value);
    }

}
