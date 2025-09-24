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

import { Json, ScvdBase } from './scvdBase';
import { getStringFromJson } from './scvdUtils';

// https://arm-software.github.io/CMSIS-View/main/elem_component_viewer.html

export class ScvdEventState extends ScvdBase {
    private _plot: 'off' | 'line' | 'box' = 'off';
    private _color: 'blue' | 'red' | 'green' | 'black' = 'blue';
    private _unique: boolean = false;
    private _dormant: boolean = false;
    private _ssel: boolean = false;

    constructor(
        parent: ScvdBase | undefined,
    ) {
        super(parent);
    }

    public readXml(xml: Json): boolean {
        if (xml === undefined ) {
            return false;
        }

        this.plot = getStringFromJson(xml.plot);
        this.color = getStringFromJson(xml.color);
        this.unique = getStringFromJson(xml.unique);
        this.dormant = getStringFromJson(xml.dormant);
        this.ssel = getStringFromJson(xml.ssel);

        return super.readXml(xml);
    }

    public get plot(): 'off' | 'line' | 'box' {
        return this._plot;
    }

    public set plot(value: string | undefined) {
        if (value !== undefined && (value === 'off' || value === 'line' || value === 'box')) {
            this._plot = value;
        }
    }

    public get color(): 'blue' | 'red' | 'green' | 'black' {
        return this._color;
    }

    public set color(value: string | undefined) {
        if (value !== undefined && (value === 'blue' || value === 'red' || value === 'green' || value === 'black')) {
            this._color = value;
        }
    }

    public get unique(): boolean {
        return this._unique;
    }

    public set unique(value: string | boolean | undefined) {
        if(value !== undefined) {
            this._unique = (value === 'true' || value === true);
        }
    }

    public get dormant(): boolean {
        return this._dormant;
    }

    public set dormant(value: string | boolean | undefined) {
        if(value !== undefined) {
            this._dormant = (value === 'true' || value === true);
        }
    }

    public get ssel(): boolean {
        return this._ssel;
    }

    public set ssel(value: string | boolean | undefined) {
        if(value !== undefined) {
            this._ssel = (value === 'true' || value === true);
        }
    }
}
