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
import { ScvdBase } from './scvdBase';


export class ScvdDataBase extends ScvdBase {
    private _valid: boolean = false;

    private _addr: NumberType | undefined = undefined;  // name[index]._addr — start address of the list item that was read from target memory.
    private _size: NumberType | undefined = undefined;  // name[index]._size — size of the list item that was read from target memory.
    private _count: NumberType | undefined = undefined; // name._count — number of list items. Used as index limit, valid index values are: (0 .. number-1).

    constructor(
        parent: ScvdBase | undefined,
    ) {
        super(parent);
    }

    get addr(): NumberType | undefined {
        return this._addr;
    }

    set addr(value: NumberType | undefined) {
        this._addr = value;
    }

    get size(): NumberType | undefined {
        return this._size;
    }

    set size(value: NumberType | undefined) {
        this._size = value;
    }

    get count(): NumberType | undefined {
        return this._count;
    }

    set count(value: NumberType | undefined) {
        this._count = value;
    }

    get valid(): boolean {
        return this._valid;
    }

    set valid(value: boolean) {
        this._valid = value;
    }

    public invalidate() {
        this._valid = false;
    }
}
