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

import { NumberType } from './numberType';
import { Json, ScvdBase } from './scvdBase';
import { ScvdEventId } from './scvdEventId';
import { ScvdEventLevel } from './scvdEventLevel';
import { ScvdEventState } from './scvdEventState';
import { ScvdEventTracking } from './scvdEventTracking';
import { ScvdExpression } from './scvdExpression';
import { ScvdPrint } from './scvdPrint';
import { ScvdValueOutput } from './scvdValueOutput';

export class ScvdEvent extends ScvdBase {
    private _id: ScvdEventId | undefined;
    private _level: ScvdEventLevel | undefined;
    private _property: ScvdValueOutput | undefined;
    private _value: ScvdValueOutput | undefined;
    private _doc: string | undefined;
    private _handle: NumberType | undefined;
    private _hname: ScvdExpression | undefined;
    private _state: ScvdEventState | undefined; // reference
    private _tracking: ScvdEventTracking | undefined;
    private _print: ScvdPrint[] = [];

    constructor(
        parent: ScvdBase | undefined,
    ) {
        super(parent);
    }

    public readXml(xml: Json): boolean {
        if (xml === undefined ) {
            return false;
        }

        //this.tag = xml.tag;

        return super.readXml(xml);
    }

    public get id(): ScvdEventId | undefined {
        return this._id;
    }
    public set id(value: ScvdEventId) {
        this._id = value;
    }

    public get level(): ScvdEventLevel | undefined {
        return this._level;
    }
    public set level(value: ScvdEventLevel) {
        this._level = value;
    }

    public get property(): ScvdValueOutput | undefined {
        return this._property;
    }
    public set property(value: ScvdValueOutput) {
        this._property = value;
    }

    public get value() {
        return this._value;
    }
    public set value(value: ScvdValueOutput | undefined) {
        this._value = value;
    }

    public get doc(): string | undefined {
        return this._doc;
    }
    public set doc(value: string | undefined) {
        this._doc = value;
    }

    public get handle(): NumberType | undefined {
        return this._handle;
    }
    public set handle(value: NumberType | undefined) {
        this._handle = value;
    }

    public get hname(): ScvdExpression | undefined {
        return this._hname;
    }
    public set hname(value: ScvdExpression | undefined) {
        this._hname = value;
    }

    public get state(): ScvdEventState | undefined {
        return this._state;
    }
    public set state(value: string) {
        this._state = new ScvdEventState(value);
    }

    public get tracking(): ScvdEventTracking | undefined {
        return this._tracking;
    }
    public set tracking(value: ScvdEventTracking | undefined) {
        this._tracking = value;
    }

    public get print(): ScvdPrint[] {
        return this._print;
    }
    public set print(value: ScvdPrint[]) {
        this._print = value;
    }

    public addPrint(entry: ScvdPrint): void {
        this._print.push(entry);
    }
}
