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
import { Json, ScvdBase } from './scvdBase';
import { ScvdRead } from './scvdRead';
import { ScvdReadList } from './scvdReadList';
import { ScvdVar } from './scvdVar';
import { getArrayFromJson, getStringFromJson } from './scvdUtils';

export class ScvdList extends ScvdBase {
    private _start: ScvdExpression | undefined = undefined;
    private _limit: ScvdExpression | undefined = undefined;
    private _while: ScvdExpression | undefined = undefined;
    private _cond: ScvdExpression | undefined = undefined;

    private _list: ScvdList[] = [];
    private _readlist: ScvdReadList[] = [];
    private _read: ScvdRead[] = [];
    private _var: ScvdVar[] = [];
    private _calc: ScvdCalc[] = [];


    constructor(
        parent: ScvdBase | undefined,
    ) {
        super(parent);
    }

    public readXml(xml: Json): boolean {
        if (xml === undefined ) {
            return super.readXml(xml);
        }

        this.start = getStringFromJson(xml.start);
        this.limit = getStringFromJson(xml.limit);
        this.while = getStringFromJson(xml.while);
        this.cond = getStringFromJson(xml.cond);

        const lists = getArrayFromJson(xml.list);
        lists?.forEach(list => {
            const listItem = this.addList();
            listItem.readXml(list);
        });

        const readLists = getArrayFromJson(xml.readlist);
        readLists?.forEach(readList => {
            const readListItem = this.addReadList();
            readListItem.readXml(readList);
        });

        const reads = getArrayFromJson(xml.read);
        reads?.forEach(read => {
            const readItem = this.addRead();
            readItem.readXml(read);
        });

        const vars = getArrayFromJson(xml.var);
        vars?.forEach(v => {
            const varItem = this.addVar();
            varItem.readXml(v);
        });

        const calcs = getArrayFromJson(xml.calc);
        calcs?.forEach(c => {
            const calcItem = this.addCalc();
            calcItem.readXml(c);
        });

        return super.readXml(xml);
    }

    public verify(): boolean {
        if(this._limit && this._while) {
            console.error('List cannot have both limit and while attributes');
            return false;
        }
        return true;
    }

    get start(): ScvdExpression | undefined {
        return this._start;
    }

    set start(value: string | undefined) {
        if(value !== undefined) {
            this._start = new ScvdExpression(this, value);
        }
    }

    get limit(): ScvdExpression | undefined {
        return this._limit;
    }

    set limit(value: string | undefined) {
        if(value !== undefined) {
            this._limit = new ScvdExpression(this, value);
        }
    }

    get while(): ScvdExpression | undefined {
        return this._while;
    }

    set while(value: string | undefined) {
        if(value !== undefined) {
            this._while = new ScvdExpression(this, value);
        }
    }

    get cond(): ScvdExpression | undefined {
        return this._cond;
    }

    set cond(value: string | undefined) {
        if(value !== undefined) {
            this._cond = new ScvdExpression(this, value);
        }
    }

    public applyInit(): boolean {
        return true;
    }

    public addList(): ScvdList {
        const listItem = new ScvdList(this);
        this._list.push(listItem);
        return listItem;
    }

    public get lists(): ScvdList[] {
        return this._list;
    }

    public addReadList(): ScvdReadList {
        const readListItem = new ScvdReadList(this);
        this._readlist.push(readListItem);
        return readListItem;
    }

    public get readLists(): ScvdReadList[] {
        return this._readlist;
    }

    public addRead(): ScvdRead {
        const readItem = new ScvdRead(this);
        this._read.push(readItem);
        return readItem;
    }
    public get read(): ScvdRead[] {
        return this._read;
    }
    public addVar(): ScvdVar {
        const varItem = new ScvdVar(this);
        this._var.push(varItem);
        return varItem;
    }
    public get var(): ScvdVar[] {
        return this._var;
    }
    public addCalc(): ScvdCalc {
        const calcItem = new ScvdCalc(this);
        this._calc.push(calcItem);
        return calcItem;
    }
    public get calc(): ScvdCalc[] {
        return this._calc;
    }
}
