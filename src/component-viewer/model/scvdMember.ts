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
import { ExplorerInfo, Json, ScvdBase } from './scvdBase';
import { getArrayFromJson, getStringFromJson } from './scvdUtils';

export class ScvdMember extends ScvdBase {
    private _type: ScvdDataType | undefined;
    private _offset: ScvdExpression | undefined;
    private _size: NumberType | undefined;
    private _enum: ScvdEnum[] = [];

    constructor(
        parent: ScvdBase | undefined,
    ) {
        super(parent);
    }

    public readXml(xml: Json): boolean {
        if (xml === undefined ) {
            return super.readXml(xml);
        }

        this.type = getStringFromJson(xml.type);
        this.offset = getStringFromJson(xml.offset);
        this.size = getStringFromJson(xml.size);

        const enums = getArrayFromJson(xml.enum);
        enums?.forEach(enumItem => {
            const newEnum = this.addEnum();
            newEnum.readXml(enumItem);
        });

        return super.readXml(xml);
    }

    get type(): ScvdDataType | undefined {
        return this._type;
    }

    set type(value: string | undefined) {
        if (value !== undefined) {
            this._type = new ScvdDataType(this, value);
        }
    }

    get offset(): ScvdExpression | undefined {
        return this._offset;
    }

    set offset(value: string | undefined) {
        if(value !== undefined) {
            this._offset = new ScvdExpression(this, value, 'offset');
        }
    }

    get size(): NumberType | undefined {
        return this._size;
    }

    set size(value: NumberTypeInput | undefined) {
        if(value !== undefined) {
            this._size = new NumberType(value);
        }
    }

    public addEnum(): ScvdEnum {
        const lastEnum = this._enum[this._enum.length - 1];
        const enumItem = new ScvdEnum(this, lastEnum);
        this._enum.push(enumItem);
        return enumItem;
    }
    public get enum(): ScvdEnum[] {
        return this._enum;
    }

    public getEnum(index: NumberType): ScvdEnum | undefined {
        const enumItem = this._enum.find((item) => item.value?.value?.value === index.value);
        return enumItem;
    }

    public getExplorerInfo(itemInfo: ExplorerInfo[] = []): ExplorerInfo[] {
        const info: ExplorerInfo[] = [];
        if (this._size) {
            info.push({ name: 'Size', value: this._size.getDisplayText() });
        }
        info.push(...itemInfo);
        return super.getExplorerInfo(info);
    }
}
