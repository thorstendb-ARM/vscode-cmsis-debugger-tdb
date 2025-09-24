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

import { NumberType } from './numberType';
import { Json, ScvdBase } from './scvdBase';
import { ScvdEndian } from './scvdEndian';
import { ScvdExpression } from './scvdExpression';
import { ScvdCondition } from './scvdCondition';
import { ScvdSymbol } from './scvdSymbol';
import { ScvdTypedef } from './scvdTypedef';
import { ScvdDataType } from './scvdDataType';
import { getStringFromJson } from './scvdUtils';

export class ScvdRead extends ScvdBase {
    private _type: ScvdDataType | undefined;
    private _symbol: string | undefined;
    private _offset: ScvdExpression = new ScvdExpression(this, '0'); // default is 0
    private _const: NumberType = new NumberType(0); // default is 0
    private _cond: ScvdCondition = new ScvdCondition(this);
    private _size: ScvdExpression;
    private _endian: ScvdEndian | undefined;

    private _typeObj: ScvdTypedef | undefined;
    private _symbolObj: ScvdSymbol | undefined;

    constructor(
        parent: ScvdBase | undefined,
    ) {
        super(parent);
        this._size = new ScvdExpression(this, '1'); // default is 1
        this._size.setMinMax(1, 512); // Array size must be between 1 and 512
    }

    public readXml(xml: Json): boolean {
        if (xml === undefined ) {
            return false;
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
        this._symbol = name;
    }
    get symbol(): string | undefined {
        return this._symbol;
    }

    set offset(value: string | undefined) {
        if(value !== undefined) {
            this._offset = new ScvdExpression(this, value);
        }
    }

    get offset(): ScvdExpression {
        return this._offset;
    }

    set const(value: string | undefined) {
        if(value !== undefined) {
            this._const = new NumberType(value);
        }
    }

    get const(): NumberType {
        return this._const;
    }

    set cond(value: string | undefined) {
        if(value !== undefined) {
            this._cond = new ScvdCondition(this, value);
        }
    }

    get cond(): ScvdCondition {
        return this._cond;
    }

    get size(): ScvdExpression | undefined {
        return this._size;
    }
    set size(value: string | undefined) {
        if(value !== undefined) {
            this._size = new ScvdExpression(this, value);
        }
    }

    get endian(): ScvdEndian | undefined {
        return this._endian;
    }
    set endian(value: string | undefined) {
        if(value !== undefined) {
            this._endian = new ScvdEndian(this, value);
        }
    }


    // ----- Object links -----
    public set typeObj(type: ScvdTypedef | undefined) {
        this._typeObj = type;
    }
    public get typeObj(): ScvdTypedef | undefined {
        return this._typeObj;
    }

    public set symbolObj(symbol: ScvdSymbol | undefined) {
        this._symbolObj = symbol;
    }
    public get symbolObj(): ScvdSymbol | undefined {
        return this._symbolObj;
    }


    public resolveAndLink(): boolean {
        if (this._type !== undefined) {
            const foundType = undefined; //this.findTypeByName(this._typeName);
            if (foundType) {
                this._type = foundType;
            }
        }
        if (this._symbol !== undefined) {
            const foundSymbol = undefined; //this.findSymbolByName(this._symbol);
            if (foundSymbol) {
                this._symbolObj = foundSymbol;
            }
        }

        return true;
    }

}
