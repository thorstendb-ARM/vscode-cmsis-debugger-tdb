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

import { ScvdBase } from './scvdBase';
import { ScvdExpression } from './scvdExpression';
import { ScvdList } from './scvdList';
import { ScvdPrint } from './scvdPrint';
import { ScvdValueOutput } from './scvdValueOutput';
import { ScvdCondition } from './scvdCondition';

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
        cond: string,
        bold: string = '0',
        alert: string = '0',
    ) {
        super(parent);
        this._cond = new ScvdCondition(this, cond);
        this._bold = new ScvdCondition(this, bold);
        this._alert = new ScvdCondition(this, alert);
    }

    public get property(): ScvdValueOutput | undefined {
        return this._property;
    }

    public get value(): ScvdExpression | undefined {
        return this._value;
    }
    public set value(value: string) {
        if (value !== undefined) {
            this._value = new ScvdExpression(this, value);
        }
        this.isModified = true;
    }

    get cond(): ScvdCondition | undefined {
        return this._cond;
    }

    set cond(value: string) {
        this._cond = new ScvdCondition(this, value);
    }

    get bold(): ScvdCondition | undefined {
        return this._bold;
    }

    set bold(value: string) {
        this._bold = new ScvdCondition(this, value);
    }

    get alert(): ScvdCondition | undefined {
        return this._alert;
    }

    set alert(value: string) {
        this._alert = new ScvdCondition(this, value);
    }

    public get item(): ScvdItem[] {
        return this._item;
    }
    public addItem(item: ScvdItem) {
        this._item.push(item);
    }
    public get list(): ScvdList[] {
        return this._list;
    }
    public addList(list: ScvdList) {
        this._list.push(list);
    }
    public get print(): ScvdPrint[] {
        return this._print;
    }
    public addPrint(print: ScvdPrint) {
        this._print.push(print);
    }
}
