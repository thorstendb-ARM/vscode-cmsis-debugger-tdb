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
import { ResolveSymbolCb, ResolveType } from '../resolver';
import { ScvdMember } from './scvd-member';


// readlist defines a list of variables or arrays. The first instance of <readlist name="var"> will define 'var',
// the following use of <readlist name="var"> will use the definition.

export class ScvdReadList extends ScvdRead {
    private _count: ScvdExpression | undefined; // default is 1
    private _next: string | undefined;  // member name for the .next pointer
    private _init: number = 0; // When init="1" previous read items in the list are discarded. Default value is 0.
    private _based: number = 0; // When based="1" the attribute symbol and attribute offset specifies a pointer (or pointer array). Default value is 0.

    private _nextObj: ScvdTypedef | undefined;

    static readonly READ_SIZE_MIN = 1;
    static readonly READ_SIZE_MAX = 1024;

    constructor(
        parent: ScvdBase | undefined,
    ) {
        super(parent);
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
            this._count = new ScvdExpression(this, value, 'count');
            this._count.setMinMax(ScvdReadList.READ_SIZE_MIN, ScvdReadList.READ_SIZE_MAX);
        }
    }
    get count(): ScvdExpression | undefined {
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
            this._init = new NumberType(value).value;
        }
    }
    get init(): number {
        return this._init;
    }

    set based(value: NumberTypeInput | undefined) {
        if(value !== undefined) {
            this._based = new NumberType(value).value;
        }
    }
    get based(): number {
        return this._based;
    }

    public set nextObj(next: ScvdTypedef | undefined) {
        this._nextObj = next;
    }
    public get nextObj(): ScvdTypedef | undefined {
        return this._nextObj;
    }

    public resolveAndLink(resolveFunc: ResolveSymbolCb): boolean {
        if (this._next !== undefined) {
            const resolvedTypedef = resolveFunc(this._next, ResolveType.localType);
            if (resolvedTypedef && resolvedTypedef instanceof ScvdTypedef) {
                const typedef: ScvdTypedef = resolvedTypedef as ScvdTypedef;
                const resolvedMember = resolveFunc(this._next, ResolveType.localMember, typedef);
                if (resolvedMember && resolvedMember instanceof ScvdMember) {     // found a typedef member
                    const member: ScvdMember = resolvedMember as ScvdMember;
                    console.log(`  ReadList '${this.name}' .next linked to member '${member.name}' in typedef '${typedef.name}'`);
                    //this.nextObj = member;
                }

            }
        }
        return super.resolveAndLink(resolveFunc);
    }

    public applyInit(): boolean {
        if(this.init === 1) {
            // Discard previous read objects
            return true;
        }

        return true;
    }

    public getCount(): number {
        if(this._count !== undefined) {
            return this._count.getValue() ?? 1;
        }
        return 1;
    }

    public getNext(): string | undefined {
        return this._next;
    }

    public getInit(): number {
        return this._init;
    }
    public getBased(): boolean {
        return this._based === 1;
    }

    public getSize(): number | undefined {
        return this.getElementStride();   // TODO!
    }

    public getElementStride(): number | undefined {
        const typeSize = this.type?.getSize();
        if(typeSize !== undefined) {
            return typeSize;
        }
        return undefined;
    }

    public getExplorerInfo(itemInfo: ExplorerInfo[] = []): ExplorerInfo[] {
        const info: ExplorerInfo[] = [];
        if (this._next) {
            info.push({ name: 'Next', value: this._next });
        }
        if (this._init) {
            info.push({ name: 'Init', value: this._init.toString() });
        }
        if (this._based) {
            info.push({ name: 'Based', value: this._based.toString() });
        }
        if (this._nextObj) {
            info.push({ name: 'NextObj', value: this._nextObj.name ?? '' });
        }
        info.push(...itemInfo);
        return super.getExplorerInfo(info);
    }
}
