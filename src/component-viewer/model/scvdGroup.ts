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

// /component_viewer/events
// https://arm-software.github.io/CMSIS-View/main/elem_events.html

import { NumberType } from './numberType';
import { Json, ScvdBase } from './scvdBase';
import { ScvdEventState } from './scvdEventState';

export class ScvdGroup extends ScvdBase {
    private _brief: string | undefined;
    private _no: NumberType | undefined;
    private _prefix: string | undefined; // hyperlink
    private _state: ScvdEventState[] = [];

    constructor(
        parent: ScvdBase | undefined,
    ) {
        super(parent);
    }

    public readXml(xml: Json): boolean {
        if (xml === undefined ) {
            return false;
        }

        this._brief = xml.brief;
        this._no = new NumberType(xml.no);
        this._prefix = xml.prefix;

        return super.readXml(xml);
    }


    public get brief(): string | undefined {
        return this._brief;
    }

    public get no(): NumberType | undefined {
        return this._no;
    }

    public get prefix(): string | undefined {
        return this._prefix;
    }

    public get state(): ScvdEventState[] {
        return this._state;
    }
    public addState(value: ScvdEventState) {
        this._state.push(value);
    }
}
