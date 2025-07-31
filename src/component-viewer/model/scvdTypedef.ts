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
import { ScvdItem } from './scvdItem';
import { ScvdMember } from './scvdMember';
import { ScvdSymbol } from './scvdSymbol';
import { ScvdVar } from './scvdVar';

// Container
export class ScvdTypedefs extends ScvdItem {

    constructor(
        parent: ScvdItem | undefined,
    ) {
        super(parent);
    }
}

// Typedefs
export class ScvdTypedef extends ScvdItem {
    private _size: ScvdExpression | undefined;
    private _import: ScvdSymbol | undefined;
    private _members: ScvdMember[] = [];
    private _vars: ScvdVar[] = [];

    constructor(
        parent: ScvdItem | undefined,
    ) {
        super(parent);
    }

    get size(): NumberType | undefined {
        return this._size?.result;
    }
    set size(value: string | undefined) {
        if (this._size === undefined) {
            this._size = new ScvdExpression(this);
        }
        this._size.expression = value;
    }

    set import(value: string) {
        if( this._import === undefined) {
            this._import = new ScvdSymbol(this);
        }
        this._import.name = value;
    }

    public addMember(): ScvdMember {
        const memberItem = new ScvdMember(this);
        this._members.push(memberItem);
        return memberItem;
    }
    public get members(): ScvdMember[] {
        return this._members;
    }

    public addVar(): ScvdVar {
        const varItem = new ScvdVar(this);
        this._vars.push(varItem);
        return varItem;
    }
    public get vars(): ScvdVar[] {
        return this._vars;
    }

}
