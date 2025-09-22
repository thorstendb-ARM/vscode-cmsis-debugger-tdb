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

import { NumberType } from './numberType';
import { ScvdExpression } from './scvdExpression';
import { Json, ScvdBase } from './scvdBase';
import { ScvdMember } from './scvdMember';
import { ScvdSymbol } from './scvdSymbol';
import { ScvdVar } from './scvdVar';
import { getArrayFromJson } from './scvdUtils';

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
            return false;
        }
        const typedefs = xml;
        if(typedefs.length > 1) {
            return false;       // only one object supported
        }

        typedefs.forEach( (v: Json) => {
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
}

// Typedefs
export class ScvdTypedef extends ScvdBase {
    private _size: ScvdExpression | undefined;
    private _import: ScvdSymbol | undefined;

    private _member: ScvdMember[] = [];
    private _var: ScvdVar[] = [];

    constructor(
        parent: ScvdBase | undefined,
    ) {
        super(parent);
    }

    public readXml(xml: Json): boolean {
        if (xml === undefined ) {
            return false;
        }

        this.size = xml.size;
        this.import = xml.import;

        const members = getArrayFromJson(xml?.member);
        if(members !== undefined) {
            members.forEach( (v: Json) => {
                const memberItem = this.addMember();
                memberItem.readXml(v);
            });
        }

        const vars = getArrayFromJson(xml?.var);
        if(vars !== undefined) {
            vars.forEach( (v: Json) => {
                const varItem = this.addVar();
                varItem.readXml(v);
            });
        }

        return super.readXml(xml);
    }

    get size(): NumberType | undefined {
        return this._size?.value;
    }
    set size(value: string) {
        this._size = new ScvdExpression(this, value);
    }

    set import(value: string) {
        this._import = new ScvdSymbol(this, value);
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

}
