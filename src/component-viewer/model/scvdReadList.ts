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

// https://arm-software.github.io/CMSIS-View/main/elem_readlist.html

import { NumberType, NumberTypeInput } from './numberType';
import { ScvdExpression } from './scvdExpression';
import { ScvdItem } from './scvdItem';
import { ScvdCondition } from './scvdScvdCondition';
import { ScvdSymbol } from './scvdSymbol';
import { ScvdTypedef } from './scvdTypedef';

export class ScvdReadList extends ScvdItem {
    private _type: string | undefined;
    private _count: ScvdExpression = new ScvdExpression(this, '1'); // default is 1
    private _next: string | undefined;
    private _symbol: string | undefined;
    private _offset: ScvdExpression = new ScvdExpression(this, '0'); // default is 0
    private _const: NumberType = new NumberType(0); // default is 0
    private _cond: ScvdCondition = new ScvdCondition(this);
    private _init: NumberType = new NumberType(0); // discard prev. read objects? default is 0
    private _based: NumberType = new NumberType(0); // is attribute+offset a pointer? default is 0

    private _nextObj: ScvdTypedef | undefined;
    private _typeObj: ScvdTypedef | undefined;
    private _symbolObj: ScvdSymbol | undefined;

    private readonly countMin = 1;
    private readonly countMax = 1024;

    constructor(
        parent: ScvdItem | undefined,
    ) {
        super(parent);
        this._count.setMinMax(this.countMin, this.countMax);
    }

    public set type(name: string | undefined) {
        this._type = name;
    }
    public get type(): string | undefined {
        return this._type;
    }

    set count(value: string ) {
        this._count = new ScvdExpression(this, value);
    }
    get count(): ScvdExpression {
        return this._count;
    }

    set next(name: string | undefined) {
        this._next = name;
    }
    get next(): string | undefined {
        return this._next;
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

    set init(value: NumberTypeInput) {
        this._init = new NumberType(value);
    }
    get init(): NumberType {
        return this._init;
    }

    set based(value: NumberTypeInput) {
        this._based = new NumberType(value);
    }
    get based(): NumberType {
        return this._based;
    }



    public set nextObj(next: ScvdTypedef | undefined) {
        this._nextObj = next;
    }
    public get nextObj(): ScvdTypedef | undefined {
        return this._nextObj;
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


    public resolveAndLink(): boolean {
        if (this._next !== undefined) {
            const foundNext = undefined; //this.findTypedefByName(this._next);
            if (foundNext) {
                this._nextObj = foundNext;
            }
        }
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

    public applyInit(): boolean {
        if(this.init.value === 1) {
            // Discard previous read objects
            return true;
        }

        return true;
    }

}
