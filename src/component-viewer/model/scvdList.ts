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

import { ScvdCalc } from './scvdCalc';
import { ScvdExpression } from './scvdExpression';
import { ScvdBase } from './scvdBase';
import { ScvdRead } from './scvdRead';
import { ScvdReadList } from './scvdReadList';
import { ScvdVar } from './scvdVar';

export class ScvdList extends ScvdBase {
    private _start: ScvdExpression;
    private _limit: ScvdExpression;
    private _while: ScvdExpression;
    private _cond: ScvdExpression;

    private _lists: ScvdList[] = [];
    private _readlists: ScvdReadList[] = [];
    private _reads: ScvdRead[] = [];
    private _vars: ScvdVar[] = [];
    private _calcs: ScvdCalc[] = [];


    constructor(
        parent: ScvdBase | undefined,
    ) {
        super(parent);
        this._start = new ScvdExpression(this, '0'); // default is 0
        this._limit = new ScvdExpression(this, '0'); // default is 0
        this._while = new ScvdExpression(this, '1'); // default is 1
        this._cond = new ScvdExpression(this, '1'); // default is 1
    }

    get start(): ScvdExpression | undefined {
        return this._start;
    }

    set start(value: string) {
        this._start = new ScvdExpression(this, value);
    }

    get limit(): ScvdExpression | undefined {
        return this._limit;
    }

    set limit(value: string) {
        this._limit = new ScvdExpression(this, value);
    }

    get while(): ScvdExpression | undefined {
        return this._while;
    }

    set while(value: string) {
        this._while = new ScvdExpression(this, value);
    }

    get cond(): ScvdExpression | undefined {
        return this._cond;
    }

    set cond(value: string) {
        this._cond = new ScvdExpression(this, value);
    }

    public applyInit(): boolean {
        return true;
    }

    public addList(): ScvdList {
        const listItem = new ScvdList(this);
        this._lists.push(listItem);
        return listItem;
    }

    public get lists(): ScvdList[] {
        return this._lists;
    }

    public addReadList(): ScvdReadList {
        const readListItem = new ScvdReadList(this);
        this._readlists.push(readListItem);
        return readListItem;
    }

    public get readLists(): ScvdReadList[] {
        return this._readlists;
    }

    public addRead(): ScvdRead {
        const readItem = new ScvdRead(this);
        this._reads.push(readItem);
        return readItem;
    }
    public get reads(): ScvdRead[] {
        return this._reads;
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
}
