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

// https://arm-software.github.io/CMSIS-View/main/elem_objects.html

import { ScvdCalc } from './scvdCalc';
import { ScvdBase } from './scvdBase';
import { ScvdList } from './scvdList';
import { ScvdOut } from './scvdOut';
import { ScvdRead } from './scvdRead';
import { ScvdReadList } from './scvdReadList';
import { ScvdVar } from './scvdVar';

export class ScvdObjects extends ScvdBase {
    private _object: ScvdObject;

    constructor(
        parent: ScvdBase | undefined,
    ) {
        super(parent);
        this._object = new ScvdObject(this);
    }

    public get object(): ScvdObject {
        return this._object;
    }
}

export class ScvdObject extends ScvdBase {
    private _vars: ScvdVar[] = [];
    private _calcs: ScvdCalc[] = [];
    private _list: ScvdList[] = [];
    private _read: ScvdRead[] = [];
    private _readList: ScvdReadList[] = [];
    private _out: ScvdOut[] = [];

    constructor(
        parent: ScvdBase | undefined,
    ) {
        super(parent, true);
    }

    public addVar(): ScvdVar {
        const varItem = new ScvdVar(this);
        this._vars.push(varItem);
        return varItem;
    }
    public get vars(): ScvdVar[] {
        return this._vars;
    }

    public addCalc(): ScvdCalc {
        const calcItem = new ScvdCalc(this);
        this._calcs.push(calcItem);
        return calcItem;
    }
    public get calcs(): ScvdCalc[] {
        return this._calcs;
    }

    public addList(): ScvdList {
        const listItem = new ScvdList(this);
        this._list.push(listItem);
        return listItem;
    }
    public get lists(): ScvdList[] {
        return this._list;
    }

    public addRead(): ScvdRead {
        const readItem = new ScvdRead(this);
        this._read.push(readItem);
        return readItem;
    }
    public get reads(): ScvdRead[] {
        return this._read;
    }

    public addReadList(): ScvdReadList {
        const readListItem = new ScvdReadList(this);
        this._readList.push(readListItem);
        return readListItem;
    }
    public get readLists(): ScvdReadList[] {
        return this._readList;
    }

    public addOut(): ScvdOut {
        const outItem = new ScvdOut(this);
        this._out.push(outItem);
        return outItem;
    }
    public get out(): ScvdOut[] {
        return this._out;
    }
}
