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
import { Json, ScvdBase } from './scvdBase';
import { ScvdList } from './scvdList';
import { ScvdOut } from './scvdOut';
import { ScvdRead } from './scvdRead';
import { ScvdReadList } from './scvdReadList';
import { ScvdVar } from './scvdVar';
import { getArrayFromJson } from './scvdUtils';

export class ScvdObjects extends ScvdBase {
    private _object: ScvdObject;

    constructor(
        parent: ScvdBase | undefined,
    ) {
        super(parent);
        this._object = new ScvdObject(this);
    }

    public readXml(xml: Json): boolean {
        if (xml === undefined ) {
            return false;
        }
        const objects = xml;
        if(objects.length > 1) {
            return false;       // only one object supported
        }

        objects?.forEach( (v: Json) => {
            const object = this.addObject();
            object.readXml(v);
        });

        this._object = new ScvdObject(this);
        this._object.readXml(objects[0]);

        return super.readXml(xml);
    }

    public addObject(): ScvdObject {
        if(this._object !== undefined) {    // only one object supported
            return this._object;
        }

        const object = new ScvdObject(this);
        this._object = object;
        return object;
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
        super(parent);
    }

    public readXml(xml: Json): boolean {
        if (xml === undefined ) {
            return false;
        }

        const vars = getArrayFromJson(xml?.var);
        if(vars !== undefined) {
            vars.forEach( (v: Json) => {
                const varItem = this.addVar();
                varItem.readXml(v);
            });
        }

        const calcs = getArrayFromJson(xml?.calc);
        if(calcs !== undefined) {
            calcs.forEach( (c: Json) => {
                const calcItem = this.addCalc();
                calcItem.readXml(c);
            });
        }

        const lists = getArrayFromJson(xml?.list);
        if(lists !== undefined) {
            lists.forEach( (l: Json) => {
                const listItem = this.addList();
                listItem.readXml(l);
            });
        }

        const reads = getArrayFromJson(xml?.read);
        if(reads !== undefined) {
            reads.forEach( (r: Json) => {
                const readItem = this.addRead();
                readItem.readXml(r);
            });
        }

        const readLists = getArrayFromJson(xml?.readlist);
        if(readLists !== undefined) {
            readLists.forEach( (rl: Json) => {
                const readListItem = this.addReadList();
                readListItem.readXml(rl);
            });
        }

        const outs = getArrayFromJson(xml?.out);
        if(outs !== undefined) {
            outs.forEach( (o: Json) => {
                const outItem = this.addOut();
                outItem.readXml(o);
            });
        }

        return super.readXml(xml);
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
