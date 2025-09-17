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
import { ScvdBase } from './scvdBase';
import { ScvdEndian } from './scvdEndian';
import { ScvdExpression } from './scvdExpression';
import { ScvdCondition } from './scvdCondition';
import { ScvdSymbol } from './scvdSymbol';
import { ScvdTypedef } from './scvdTypedef';

export class ScvdRead extends ScvdBase {
    private _type: string | undefined;
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

    public set type(name: string | undefined) {
        this._type = name;
    }
    public get type(): string | undefined {
        return this._type;
    }

    set symbol(name: string | undefined) {
        this._symbol = name;
    }
    get symbol(): string | undefined {
        return this._symbol;
    }

    set offset(value: string) {
        this._offset = new ScvdExpression(this, value);
    }
    get offset(): ScvdExpression {
        return this._offset;
    }

    set const(value: number) {
        this._const = new NumberType(value);
    }
    get const(): NumberType {
        return this._const;
    }

    set cond(value: ScvdCondition) {
        this._cond = value;
    }
    get cond(): ScvdCondition {
        return this._cond;
    }

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

    get size(): NumberType | undefined {
        return this._size?.value;
    }
    set size(value: string) {
        this._size = new ScvdExpression(this, value);
    }

    get endian(): ScvdEndian | undefined {
        return this._endian;
    }
    set endian(value: string) {
        this._endian = new ScvdEndian(this, value);
        this.isModified = true;
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
