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

// https://arm-software.github.io/CMSIS-View/main/elem_member.html

import { NumberType, NumberTypeInput } from './numberType';
import { ScvdDataType } from './scvdDataType';
import { ScvdEnum } from './scvdEnum';
import { ScvdExpression } from './scvdExpression';
import { ScvdItem } from './scvdItem';

export class ScvdMember extends ScvdItem {
    private _type: ScvdDataType | undefined;
    private _offset: ScvdExpression | undefined;
    private _size: NumberType | undefined;
    private _enums: ScvdEnum[] = [];

    constructor(
        parent: ScvdItem | undefined,
    ) {
        super(parent);
    }

    get type(): ScvdDataType | undefined {
        return this._type;
    }

    set type(value: string) {
        this._type = new ScvdDataType(this, value);
    }

    get offset(): ScvdExpression | undefined {
        return this._offset;
    }

    set offset(value: string) {
        this._offset = new ScvdExpression(this, value);
    }

    get size(): NumberType | undefined {
        return this._size;
    }

    set size(value: NumberTypeInput) {
        this._size = new NumberType(value);
    }

    public addEnum(): ScvdEnum {
        const lastEnum = this._enums[this._enums.length - 1];
        const enumItem = new ScvdEnum(this, lastEnum);
        this._enums.push(enumItem);
        return enumItem;
    }
    public get enums(): ScvdEnum[] {
        return this._enums;
    }

    public getEnum(index: NumberType): ScvdEnum | undefined {
        const enumItem = this._enums.find((item) => item.value?.value?.value === index.value);
        return enumItem;
    }
}
