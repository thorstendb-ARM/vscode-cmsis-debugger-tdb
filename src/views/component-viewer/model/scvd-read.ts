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

import { NumberType } from './number-type';
import { ExplorerInfo, Json, ScvdBase } from './scvd-base';
import { ScvdEndian } from './scvd-endian';
import { ScvdExpression } from './scvd-expression';
import { ScvdCondition } from './scvd-condition';
import { ScvdSymbol } from './scvd-symbol';
import { ScvdDataType } from './scvd-data-type';
import { getStringFromJson } from './scvd-utils';

export class ScvdRead extends ScvdBase {
    private _type: ScvdDataType | undefined;
    private _symbol: ScvdSymbol | undefined;
    private _offset: ScvdExpression | undefined;
    private _const: NumberType = new NumberType(0); // default is 0
    private _cond: ScvdCondition | undefined;
    private _size: ScvdExpression | undefined;
    private _endian: ScvdEndian | undefined;
    static readonly ARRAY_SIZE_MIN = 1;
    static readonly ARRAY_SIZE_MAX = 512;


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
        this.symbol = getStringFromJson(xml.symbol);
        this.offset = getStringFromJson(xml.offset);
        this.const = getStringFromJson(xml.const);
        this.cond = getStringFromJson(xml.cond);
        this.size = getStringFromJson(xml.size);
        this.endian = getStringFromJson(xml.endian);

        return super.readXml(xml);
    }

    public get type(): ScvdDataType | undefined {
        return this._type;
    }
    public set type(value: string | undefined) {
        if (value !== undefined) {
            this._type = new ScvdDataType(this, value);
        }
    }

    set symbol(name: string | undefined) {
        if(this._symbol === undefined && name !== undefined) {
            this._symbol = new ScvdSymbol(this, name);
            return;
        }
    }

    get symbol(): ScvdSymbol | undefined {
        return this._symbol;
    }

    set offset(value: string | undefined) {
        if(value !== undefined) {
            this._offset = new ScvdExpression(this, value, 'offset');
            return;
        }
    }

    get offset(): ScvdExpression | undefined {
        return this._offset;
    }

    set const(value: string | undefined) {
        if(value !== undefined) {
            if( this._const === undefined) {
                this._const = new NumberType(value);
                return;
            }
            this._const.value = value;
        }
    }

    get const(): NumberType {
        return this._const;
    }

    set cond(value: string | undefined) {
        if(value !== undefined) {
            this._cond = new ScvdCondition(this, value);
            return;
        }
    }

    get cond(): ScvdCondition | undefined {
        return this._cond;
    }

    get size(): ScvdExpression | undefined {
        return this._size;
    }

    get minMaxSize(): { min: number; max: number } {
        const { min, max } = this._size?.getMinMax() ?? {};
        return { min: min ?? ScvdRead.ARRAY_SIZE_MIN, max: max ?? ScvdRead.ARRAY_SIZE_MAX };
    }

    set size(value: string | undefined) {
        if(value !== undefined) {
            this._size = new ScvdExpression(this, value, 'size');
            return;
        }
    }

    get endian(): ScvdEndian | undefined {
        return this._endian;
    }
    set endian(value: string | undefined) {
        if(value !== undefined) {
            if( this._endian === undefined) {
                this._endian = new ScvdEndian(this, value);
                return;
            }
            this._endian.endian = value;
        }
    }

    public getMember(property: string): ScvdBase | undefined {
        return this._type?.getMember(property);
    }

    public getExplorerInfo(itemInfo: ExplorerInfo[] = []): ExplorerInfo[] {
        const info: ExplorerInfo[] = [];
        if (this.symbol) {
            info.push({ name: 'Symbol', value: this.symbol.getExplorerDisplayName() });
        }
        if (this.const) {
            info.push({ name: 'Const', value: this.const.getDisplayText() });
        }
        info.push(...itemInfo);
        return super.getExplorerInfo(info);
    }
}
