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

import { NumberType } from './numberType';
import { Json, ScvdBase } from './scvdBase';
import { getStringFromJson } from './scvdUtils';

export class ScvdDataBase extends ScvdBase {

    /* The individual data type elements of the <readlist> are referenced using name[index].member.
     * <readlist> manages two predefined member variables with the following names:
     * https://arm-software.github.io/CMSIS-View/main/elem_readlist.html
     */
    private _addr: NumberType | undefined = undefined;  // name[index]._addr — start address of the list item that was read from target memory.
    private _size: NumberType | undefined = undefined;  // name[index]._size — size of the list item that was read from target memory.
    private _count: NumberType | undefined = undefined; // name._count — number of list items. Used as index limit, valid index values are: (0 .. number-1).

    constructor(
        parent: ScvdBase | undefined,
    ) {
        super(parent);
    }

    public readXml(xml: Json): boolean {
        if (xml === undefined ) {
            return false;
        }

        this.addr = getStringFromJson(xml.addr);
        this.size = getStringFromJson(xml.size);
        this.count = getStringFromJson(xml.count);

        return super.readXml(xml);
    }

    get addr(): NumberType | undefined {
        return this._addr;
    }

    set addr(value: string | undefined) {
        if( value !== undefined) {
            this._addr = new NumberType(value);
        }
    }

    get size(): NumberType | undefined {
        return this._size;
    }

    set size(value: string | undefined) {
        if( value !== undefined) {
            this._size = new NumberType(value);
        }
    }

    get count(): NumberType | undefined {
        return this._count;
    }

    set count(value: string | undefined) {
        if( value !== undefined) {
            this._count = new NumberType(value);
        }
    }
}
