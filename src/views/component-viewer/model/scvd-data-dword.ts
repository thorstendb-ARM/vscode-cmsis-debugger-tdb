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

import { NumberType } from './number-type';
import { ExplorerInfo, ScvdBase } from './scvd-base';
import { ScvdDataBase } from './scvd-data-base';


export class ScvdDataDword extends ScvdDataBase {
    private _data: number | undefined;

    constructor(
        parent: ScvdBase | undefined,
    ) {
        super(parent);
    }

    public get data(): number | undefined {
        return this._data;
    }
    public set data(value: string | undefined) {
        if( value !== undefined) {
            this._data = new NumberType(value).value;
        }
    }

    public getExplorerInfo(itemInfo: ExplorerInfo[] = []): ExplorerInfo[] {
        const info: ExplorerInfo[] = [];
        if (this._data !== undefined) {
            info.push({ name: 'Data', value: this._data.toString() });
        }
        info.push(...itemInfo);
        return super.getExplorerInfo(info);
    }
}
