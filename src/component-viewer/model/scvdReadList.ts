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
import { Json, ScvdBase } from './scvdBase';
import { ScvdTypedef } from './scvdTypedef';
import { ScvdRead } from './scvdRead';

export class ScvdReadList extends ScvdRead {
    private _count: ScvdExpression = new ScvdExpression(this, '1'); // default is 1
    private _next: string | undefined;  // member name for the .next pointer
    private _init: NumberType = new NumberType(0); // discard prev. read objects? default is 0
    private _based: NumberType = new NumberType(0); // is attribute+offset a pointer? default is 0

    private _nextObj: ScvdTypedef | undefined;

    private readonly countMin = 1;
    private readonly countMax = 1024;

    constructor(
        parent: ScvdBase | undefined,
    ) {
        super(parent);
        this._count.setMinMax(this.countMin, this.countMax);
    }

    public readXml(xml: Json): boolean {
        if (xml === undefined ) {
            return false;
        }

        const count = xml.count;
        if(count !== undefined) {
            this._count = new ScvdExpression(this, count);
        }

        const next = xml.next;
        if(next !== undefined) {
            this._next = next;
        }

        const init = xml.init;
        if(init !== undefined) {
            this._init = new NumberType(init);
        }

        const based = xml.based;
        if(based !== undefined) {
            this._based = new NumberType(based);
        }

        return super.readXml(xml);
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

    public resolveAndLink(): boolean {
        if (this._next !== undefined) {
            const foundNext = undefined; //this.findTypedefByName(this._next);
            if (foundNext) {
                this._nextObj = foundNext;
            }
        }
        super.resolveAndLink();
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
