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

import { ExplorerInfo, ScvdBase } from './scvdBase';
import { ScvdFormatSpecifier } from './scvdFormatSpecifier';

export class ScvdValueOutput extends ScvdBase {
    private _value: string | undefined;

    constructor(
        parent: ScvdBase | undefined,
        value: string,
    ) {
        super(parent);
        this._value = value;
    }

    public get value(): string | undefined {
        return this._value;
    }
    public set value(value: string | undefined) {
        this._value = value;
    }

    public getValue(): string {
        if(!this._value) {
            return '';
        }
        const formatter = new ScvdFormatSpecifier();
        return formatter.expand(this._value) ?? '';
    }

    public getExplorerInfo(itemInfo: ExplorerInfo[] = []): ExplorerInfo[] {
        const info: ExplorerInfo[] = [];
        if (this._value !== undefined) {
            info.push({ name: 'Value', value: this._value });
        }
        info.push(...itemInfo);
        return super.getExplorerInfo(info);
    }

    public getExplorerDisplayName(): string {
        return this._value ?? super.getExplorerDisplayName();
    }
}
