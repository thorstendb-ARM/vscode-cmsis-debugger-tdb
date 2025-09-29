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

import { ScvdDataType } from './scvdDataType';
import { ScvdExpression } from './scvdExpression';
import { ExplorerInfo, Json, ScvdBase } from './scvdBase';
import { ScvdCondition } from './scvdCondition';
import { getArrayFromJson, getStringFromJson } from './scvdUtils';
import { ScvdItem } from './scvdItem';
import { ScvdList } from './scvdList';

export class ScvdOut extends ScvdBase {
    private _value: ScvdExpression | undefined; // name._value — expression that evaluates to the value of the output.
    private _type: ScvdDataType | undefined;
    private _cond: ScvdCondition;
    private _item: ScvdItem[] = [];
    private _list: ScvdList[] = [];

    constructor(
        parent: ScvdBase | undefined,
    ) {
        super(parent);
        this._cond = new ScvdCondition(this);
    }

    public readXml(xml: Json): boolean {
        if (xml === undefined ) {
            return super.readXml(xml);
        }

        this.value = getStringFromJson(xml.value);
        this.type = getStringFromJson(xml.type);
        this.cond = getStringFromJson(xml.cond);

        const item = getArrayFromJson(xml.item);
        item?.forEach((it: Json) => {
            const newItem = this.addItem();
            newItem.readXml(it);
        });

        const list = getArrayFromJson(xml.list);
        list?.forEach((it: Json) => {
            const newList = this.addList();
            newList.readXml(it);
        });

        return super.readXml(xml);
    }

    public set value(value: string | undefined) {
        if (value !== undefined) {
            if( this._value === undefined) {
                this._value = new ScvdExpression(this, value, 'value');
                return;
            }
            this._value.expression = value;
        }
    }
    public get value(): ScvdExpression | undefined {
        return this._value;
    }
    public set type(value: string | undefined) {
        if (value !== undefined) {
            if( this._type === undefined) {
                this._type = new ScvdDataType(this, value);
                return;
            }
            this._type.type = value;
        }
    }
    public get type(): ScvdDataType | undefined {
        return this._type;
    }

    public get cond(): ScvdCondition {
        return this._cond;
    }
    public set cond(value: string | undefined) {
        if (value !== undefined) {
            if( this._cond === undefined) {
                this._cond = new ScvdCondition(this, value);
                return;
            }
            this._cond.expression = value;
        }
    }

    public get item(): ScvdItem[] {
        return this._item;
    }
    public addItem(): ScvdItem {
        const newItem = new ScvdItem(this, '1');
        this._item.push(newItem);
        return newItem;
    }

    public get list(): ScvdList[] {
        return this._list;
    }
    public addList(): ScvdList {
        const list = new ScvdList(this);
        this._list.push(list);
        return list;
    }

    public getExplorerInfo(itemInfo: ExplorerInfo[] = []): ExplorerInfo[] {
        const info: ExplorerInfo[] = [];
        info.push(...itemInfo);
        return super.getExplorerInfo(info);
    }
}
