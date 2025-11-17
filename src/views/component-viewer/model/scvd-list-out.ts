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

import { ExplorerInfo, Json, ScvdBase } from './scvd-base';
import { ScvdItem } from './scvd-item';
import { ScvdList } from './scvd-list';
import { getArrayFromJson, getStringFromJson } from './scvd-utils';

export class ScvdListOut extends ScvdList {
    private _item: ScvdItem[] = [];

    constructor(
        parent: ScvdBase | undefined,
    ) {
        super(parent);
    }

    // class is derived from ScvdList, but we do not want all properties of ScvdList to be settable from XML
    public readXml(xml: Json): boolean {
        if (xml === undefined ) {
            return super.readXml(xml);
        }

        this.start = getStringFromJson(xml.start);
        this.limit = getStringFromJson(xml.limit);
        this.while = getStringFromJson(xml.while);
        this.cond = getStringFromJson(xml.cond);


        const items = getArrayFromJson(xml.item);
        items?.forEach(item => {
            const itemObj = this.addItem();
            itemObj.readXml(item);
        });

        const lists = getArrayFromJson(xml.list);
        lists?.forEach(list => {
            const listItem = this.addList();
            listItem.readXml(list);
        });

        return super.readXml(xml);
    }

    public verify(): boolean {
        return super.verify();
    }

    public get item(): ScvdItem[] {
        return this._item;
    }

    public addItem(): ScvdItem {
        const item = new ScvdItem(this);
        this._item.push(item);
        return item;
    }

    public getGuiChildren(): ScvdBase[] | undefined {
        const combined: ScvdBase[] = [...this.item, ...this.list].sort((a, b) => this.sortByLine(a, b));

        return combined.length > 0 ? combined : undefined;
    }

    public getExplorerInfo(itemInfo: ExplorerInfo[] = []): ExplorerInfo[] {
        const info: ExplorerInfo[] = [];

        info.push(...itemInfo);
        return super.getExplorerInfo(info);
    }
}
