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

// https://arm-software.github.io/CMSIS-View/main/elem_typedefs.html

import { ScvdExpression } from './scvd-expression';
import { ExplorerInfo, Json, ScvdBase } from './scvd-base';
import { ScvdMember } from './scvd-member';
import { ScvdSymbol } from './scvd-symbol';
import { ScvdVar } from './scvd-var';
import { getArrayFromJson, getStringFromJson } from './scvd-utils';

// Container
export class ScvdTypedefs extends ScvdBase {
    private _typedef: ScvdTypedef[] = [];

    constructor(
        parent: ScvdBase | undefined,
    ) {
        super(parent);
    }

    public readXml(xml: Json): boolean {
        if (xml === undefined ) {
            return super.readXml(xml);
        }
        const typedefs = getArrayFromJson(xml.typedef);
        typedefs?.forEach( (v: Json) => {
            const varItem = this.addTypedef();
            varItem.readXml(v);
        });

        return super.readXml(xml);
    }

    get typedef(): ScvdTypedef[] {
        return this._typedef;
    }

    public addTypedef(): ScvdTypedef {
        const typedefItem = new ScvdTypedef(this);
        this._typedef.push(typedefItem);
        return typedefItem;
    }

    public getExplorerInfo(itemInfo: ExplorerInfo[] = []): ExplorerInfo[] {
        const info: ExplorerInfo[] = [];

        info.push(...itemInfo);
        return super.getExplorerInfo(info);
    }
}

// Typedefs
export class ScvdTypedef extends ScvdBase {
    private _size: ScvdExpression | undefined;
    private _import: ScvdSymbol | undefined;
    private _member: ScvdMember[] = [];     // target system variable
    private _var: ScvdVar[] = [];       // local SCVD variable

    constructor(
        parent: ScvdBase | undefined,
    ) {
        super(parent);
    }

    public readXml(xml: Json): boolean {
        if (xml === undefined ) {
            return super.readXml(xml);
        }

        this.size = getStringFromJson(xml.size);
        this.import = getStringFromJson(xml.import);

        const members = getArrayFromJson(xml.member);
        members?.forEach( (v: Json) => {
            const memberItem = this.addMember();
            memberItem.readXml(v);
        });

        const vars = getArrayFromJson(xml.var);
        vars?.forEach( (v: Json) => {
            const varItem = this.addVar();
            varItem.readXml(v);
        });

        return super.readXml(xml);
    }

    get size(): number | undefined {
        return this._size?.getValue();
    }
    set size(value: string | undefined) {
        if(value !== undefined) {
            if( this._size === undefined) {
                this._size = new ScvdExpression(this, value, 'size');
                return;
            }
            this._size.expression = value;
        }
    }

    set import(value: string | undefined) {
        if(value !== undefined) {
            if( this._import === undefined) {
                this._import = new ScvdSymbol(this, value);
                return;
            }
            this._import.name = value;
        }
    }
    get import(): ScvdSymbol | undefined {
        return this._import;
    }

    public addMember(): ScvdMember {
        const memberItem = new ScvdMember(this);
        this._member.push(memberItem);
        return memberItem;
    }
    public get member(): ScvdMember[] {
        return this._member;
    }

    public addVar(): ScvdVar {
        const varItem = new ScvdVar(this);
        this._var.push(varItem);
        return varItem;
    }
    public get var(): ScvdVar[] {
        return this._var;
    }

    public getMember(property: string): ScvdBase | undefined {
        return this.symbolsCache(
            property,
            this.member.find(s => s.name === property) ??
            this.var.find(s => s.name === property)
        );
    }

    public getExplorerInfo(itemInfo: ExplorerInfo[] = []): ExplorerInfo[] {
        const info: ExplorerInfo[] = [];
        if (this._size !== undefined) {
            info.push({ name: 'Size', value: this._size.expression ?? '' });
            if (this._size.value !== undefined) {
                info.push({ name: 'Size Value', value: this._size.getGuiValue() ?? 'undefined' });
            }
        }
        if (this._import !== undefined) {
            info.push({ name: 'Import', value: this._import.name ?? '' });
        }
        if (this._member.length > 0) {
            info.push({ name: 'Members', value: this._member.length.toString() });
        }
        if (this._var.length > 0) {
            info.push({ name: 'Vars', value: this._var.length.toString() });
        }
        info.push(...itemInfo);
        return super.getExplorerInfo(info);
    }

    public getExplorerDisplayName(): string {
        return this.getExplorerDisplayEntry() ?? super.getExplorerDisplayName();
    }
}
