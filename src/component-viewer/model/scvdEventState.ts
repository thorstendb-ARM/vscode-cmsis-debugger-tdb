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

        const plot = xml.plot;
        if(plot !== undefined && (plot === 'off' || plot === 'line' || plot === 'box')) {
            this._plot = plot;
        }

        const color = xml.color;
        if(color !== undefined && (color === 'blue' || color === 'red' || color === 'green' || color === 'black')) {
            this._color = color;
        }

        const unique = xml.unique;
        if(unique !== undefined) {
            this._unique = (unique === 'true' || unique === true);
        }

        const dormant = xml.dormant;
        if(dormant !== undefined) {
            this._dormant = (dormant === 'true' || dormant === true);
        }

        const ssel = xml.ssel;
        if(ssel !== undefined) {
            this._ssel = (ssel === 'true' || ssel === true);
        }

        return super.readXml(xml);
    }

    public get plot(): 'off' | 'line' | 'box' {
        return this._plot;
    }

    public set plot(value: 'off' | 'line' | 'box') {
        this._plot = value;
    }

    public get color(): 'blue' | 'red' | 'green' | 'black' {
        return this._color;
    }

    public set color(value: 'blue' | 'red' | 'green' | 'black') {
        this._color = value;
    }

    public get unique(): boolean {
        return this._unique;
    }

    public set unique(value: boolean) {
        this._unique = value;
    }

    public get dormant(): boolean {
        return this._dormant;
    }

    public set dormant(value: boolean) {
        this._dormant = value;
    }

    public get ssel(): boolean {
        return this._ssel;
    }

    public set ssel(value: boolean) {
        this._ssel = value;
    }
}
