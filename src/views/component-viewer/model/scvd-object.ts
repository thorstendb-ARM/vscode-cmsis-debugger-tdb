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

import { ScvdCalc } from './scvd-calc';
import { ExplorerInfo, Json, ScvdBase } from './scvd-base';
import { ScvdList } from './scvd-list';
import { ScvdOut } from './scvd-out';
import { ScvdRead } from './scvd-read';
import { ScvdReadList } from './scvd-readlist';
import { ScvdVar } from './scvd-var';
import { getArrayFromJson } from './scvd-utils';

export class ScvdObjects extends ScvdBase {
    private _objects: ScvdObject[] = [];

    constructor(
        parent: ScvdBase | undefined,
    ) {
        super(parent);
    }

    public readXml(xml: Json): boolean {
        if (xml === undefined ) {
            return super.readXml(xml);
        }
        const objects = getArrayFromJson(xml.object);
        objects?.forEach( (v: Json) => {
            const object = this.addObject();
            object.readXml(v);
        });

        return super.readXml(xml);
    }

    public addObject(): ScvdObject {
        const object = new ScvdObject(this);
        this._objects.push(object);
        return object;
    }

    public get objects(): ScvdObject[] {
        return this._objects;
    }

    // fallback for global model symbol resolution
    public getSymbol(name: string): ScvdBase | undefined {
        for(const obj of this._objects) {
            const sym = obj.getSymbol(name);
            if(sym !== undefined) {
                return sym;
            }
        }
        return undefined;
    }

    public getExplorerInfo(itemInfo: ExplorerInfo[] = []): ExplorerInfo[] {
        const info: ExplorerInfo[] = [];
        info.push(...itemInfo);
        return super.getExplorerInfo(info);
    }
}

export class ScvdObject extends ScvdBase {
    private _vars: ScvdVar[] = [];
    private _calcs: ScvdCalc[] = [];
    private _list: ScvdList[] = [];
    private _read: ScvdRead[] = [];
    private _readList: ScvdReadList[] = [];
    private _out: ScvdOut[] = [];
    private _symbolsCache = new Map<string, ScvdBase>();

    constructor(
        parent: ScvdBase | undefined,
    ) {
        super(parent);
    }

    public readXml(xml: Json): boolean {
        if (xml === undefined ) {
            return super.readXml(xml);
        }

        const vars = getArrayFromJson(xml?.var);
        vars?.forEach( (v: Json) => {
            const varItem = this.addVar();
            varItem.readXml(v);
        });

        const calcs = getArrayFromJson(xml?.calc);
        calcs?.forEach( (c: Json) => {
            const calcItem = this.addCalc();
            calcItem.readXml(c);
        });

        const lists = getArrayFromJson(xml?.list);
        lists?.forEach( (l: Json) => {
            const listItem = this.addList();
            listItem.readXml(l);
        });

        const reads = getArrayFromJson(xml?.read);
        reads?.forEach( (r: Json) => {
            const readItem = this.addRead();
            readItem.readXml(r);
        });

        const readLists = getArrayFromJson(xml?.readlist);
        readLists?.forEach( (rl: Json) => {
            const readListItem = this.addReadList();
            readListItem.readXml(rl);
        });

        const outs = getArrayFromJson(xml?.out);
        outs?.forEach( (o: Json) => {
            const outItem = this.addOut();
            outItem.readXml(o);
        });

        return super.readXml(xml);
    }

    public get list(): ScvdList[] {
        return this._list;
    }

    public get read(): ScvdRead[] {
        return this._read;
    }

    public get readList(): ScvdReadList[] {
        return this._readList;
    }

    private get symbolsCache(): Map<string, ScvdBase> {
        return this._symbolsCache;
    }
    private addToSymbolsCache(name: string, item: ScvdBase): void {
        this.symbolsCache.set(name, item);
    }
    private getFromSymbolsCache(name: string): ScvdBase | undefined {
        return this.symbolsCache.get(name);
    }

    public getSymbol(name: string): ScvdBase | undefined {
        // look in cache (vars, reads, ...)
        const cachedSymbol = this.getFromSymbolsCache(name);
        if(cachedSymbol !== undefined) {
            return cachedSymbol;
        }

        const varSymbol = this.vars.find( v => v.name === name);
        if(varSymbol !== undefined) {
            this.addToSymbolsCache(name, varSymbol);
            return varSymbol;
        }

        const readSymbol = this.reads.find( r => r.name === name);
        if(readSymbol !== undefined) {
            this.addToSymbolsCache(name, readSymbol);
            return readSymbol;
        }

        return undefined;
    }


    public getVar(name: string): ScvdVar | undefined {
        for(const v of this._vars) {
            if(v.name === name) {
                return v;
            }
        }

        return undefined;
    }

    public getRead(name: string): ScvdRead | undefined {
        for(const r of this._read) {
            if(r.name === name) {
                return r;
            }
        }

        return undefined;
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

    public getExplorerInfo(itemInfo: ExplorerInfo[] = []): ExplorerInfo[] {
        const info: ExplorerInfo[] = [];
        info.push(...itemInfo);
        return super.getExplorerInfo(info);
    }
}
