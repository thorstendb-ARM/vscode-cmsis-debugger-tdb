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
import { ScvdDataBase } from './scvdDataBase';


export class ScvdDataDword extends ScvdDataBase {
    private _data: NumberType | undefined;

    constructor(
        parent: ScvdBase | undefined,
    ) {
        super(parent);
    }

    public get data(): NumberType | undefined {
        return this._data;
    }
    public set data(value: NumberType | undefined) {
        this._data = value;
        this.valid = true;
    }
}
