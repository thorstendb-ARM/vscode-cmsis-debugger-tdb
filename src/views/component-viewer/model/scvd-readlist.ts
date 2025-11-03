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

import { NumberType, NumberTypeInput } from './number-type';
import { ScvdExpression } from './scvd-expression';
import { ExplorerInfo, Json, ScvdBase } from './scvd-base';
import { ScvdTypedef } from './scvd-typedef';
import { ScvdRead } from './scvd-read';
import { getStringFromJson } from './scvd-utils';
import { resolveType } from '../resolver';


// readlist defines a list of variables or arrays. The first instance of <readlist name="var"> will define 'var',
// the following use of <readlist name="var"> will use the definition.

export class ScvdReadList extends ScvdRead {
    private _count: ScvdExpression = new ScvdExpression(this, '1', 'count'); // default is 1
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
            return super.readXml(xml);
        }

        this.count = getStringFromJson(xml.count);
        this.next = getStringFromJson(xml.next);
        this.init = getStringFromJson(xml.init);
        this.based = getStringFromJson(xml.based);

        return super.readXml(xml);
    }


    set count(value: string | undefined) {
        if(value !== undefined) {
            this._count.expression = value;
        }
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

    set init(value: NumberTypeInput | undefined) {
        if(value !== undefined) {
            if( this._init === undefined) {
                this._init = new NumberType(value);
                return;
            }
            this._init.value = value;
        }
    }
    get init(): NumberType {
        return this._init;
    }

    set based(value: NumberTypeInput | undefined) {
        if(value !== undefined) {
            if( this._based === undefined) {
                this._based = new NumberType(value);
                return;
            }
            this._based.value = value;
        }
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

    public resolveAndLink(resolveFunc: (name: string, type: resolveType) => ScvdBase | undefined): boolean {
        if (this._next !== undefined) {
            const foundNext = resolveFunc(this._next, resolveType.target);
            if (foundNext) {
                ; //this.nextObj = foundNext;
            }
        }
        return super.resolveAndLink(resolveFunc);
    }

    public applyInit(): boolean {
        if(this.init.value === 1) {
            // Discard previous read objects
            return true;
        }

        return true;
    }

    public getExplorerInfo(itemInfo: ExplorerInfo[] = []): ExplorerInfo[] {
        const info: ExplorerInfo[] = [];
        if (this._next) {
            info.push({ name: 'Next', value: this._next });
        }
        if (this._init) {
            info.push({ name: 'Init', value: this._init.getDisplayText() });
        }
        if (this._based) {
            info.push({ name: 'Based', value: this._based.getDisplayText() });
        }
        if (this._nextObj) {
            info.push({ name: 'NextObj', value: this._nextObj.name ?? '' });
        }
        info.push(...itemInfo);
        return super.getExplorerInfo(info);
    }
}
