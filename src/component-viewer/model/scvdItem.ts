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

import { ExplorerInfo, Json, ScvdBase } from './scvdBase';
import { ScvdExpression } from './scvdExpression';
import { ScvdList } from './scvdList';
import { ScvdPrint } from './scvdPrint';
import { ScvdValueOutput } from './scvdValueOutput';
import { ScvdCondition } from './scvdCondition';
import { getArrayFromJson, getStringFromJson } from './scvdUtils';

export class ScvdItem extends ScvdBase {
    private _property: ScvdValueOutput | undefined;
    private _value: ScvdExpression | undefined;
    private _cond: ScvdCondition | undefined;
    private _bold: ScvdCondition | undefined;
    private _alert: ScvdCondition | undefined;
    private _item: ScvdItem[] = []; // Array of child items
    private _list: ScvdList[] = []; // Array of child lists
    private _print: ScvdPrint[] = []; // Array of child prints


    constructor(
        parent: ScvdBase | undefined,
        cond: string = '1',
        bold: string = '0',
        alert: string = '0',
    ) {
        super(parent);
        this._cond = new ScvdCondition(this, cond);
        this._bold = new ScvdCondition(this, bold);
        this._alert = new ScvdCondition(this, alert);
    }

    public readXml(xml: Json): boolean {
        if (xml === undefined ) {
            return super.readXml(xml);
        }

        this.property = getStringFromJson(xml.property);
        this.value = getStringFromJson(xml.value);
        this.cond = getStringFromJson(xml.cond);
        this.bold = getStringFromJson(xml.bold);
        this.alert = getStringFromJson(xml.alert);

        const item = getArrayFromJson(xml.item);
        item?.forEach( (v: Json) => {
            const newItem = this.addItem();
            newItem.readXml(v);
        });

        const list = getArrayFromJson(xml.list);
        list?.forEach( (v: Json) => {
            const newList = new ScvdList(this);
            newList.readXml(v);
            this.addList(newList);
        });

        const print = getArrayFromJson(xml.print);
        print?.forEach( (v: Json) => {
            const printItem = this.addPrint();
            printItem.readXml(v);
        });

        return super.readXml(xml);
    }

    public set property(value: string | undefined) {
        if (value !== undefined) {
            this._property = new ScvdValueOutput(this, value);
        }
    }
    public get property(): ScvdValueOutput | undefined {
        return this._property;
    }

    public get value(): ScvdExpression | undefined {
        return this._value;
    }
    public set value(value: string | undefined) {
        if (value !== undefined) {
            this._value = new ScvdExpression(this, value);
        }
    }

    get cond(): ScvdCondition | undefined {
        return this._cond;
    }

    set cond(value: string | undefined) {
        if (value !== undefined) {
            this._cond = new ScvdCondition(this, value);
        }
    }

    get bold(): ScvdCondition | undefined {
        return this._bold;
    }

    set bold(value: string | undefined) {
        if (value !== undefined) {
            this._bold = new ScvdCondition(this, value);
        }
    }

    get alert(): ScvdCondition | undefined {
        return this._alert;
    }

    set alert(value: string | undefined) {
        if (value !== undefined) {
            this._alert = new ScvdCondition(this, value);
        }
    }

    public get list(): ScvdList[] {
        return this._list;
    }
    public addList(list: ScvdList) {
        this._list.push(list);
    }

    public get item(): ScvdItem[] {
        return this._item;
    }

    public addItem(): ScvdItem {
        const newItem = new ScvdItem(this, '1');
        this._item.push(newItem);
        return newItem;
    }

    public get print(): ScvdPrint[] {
        return this._print;
    }
    public addPrint(): ScvdPrint {
        const item = new ScvdPrint(this);
        this._print.push(item);
        return item;
    }

    public getExplorerInfo(itemInfo: ExplorerInfo[] = []): ExplorerInfo[] {
        const info: ExplorerInfo[] = [];
        info.push(...itemInfo);
        return super.getExplorerInfo(info);
    }
}
