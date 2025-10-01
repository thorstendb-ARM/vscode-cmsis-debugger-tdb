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

import { resolveType } from '../resolver';
import { NumberType } from './numberType';
import { ExplorerInfo, Json, ScvdBase } from './scvdBase';
import { ScvdEventId } from './scvdEventId';
import { ScvdEventLevel } from './scvdEventLevel';
import { ScvdEventState } from './scvdEventState';
import { ScvdEventTracking } from './scvdEventTracking';
import { ScvdExpression } from './scvdExpression';
import { ScvdPrint } from './scvdPrint';
import { getArrayFromJson, getStringFromJson } from './scvdUtils';
import { ScvdValueOutput } from './scvdValueOutput';

export class ScvdEvent extends ScvdBase {
    private _id: ScvdEventId | undefined;
    private _level: ScvdEventLevel | undefined;
    private _property: ScvdValueOutput | undefined;
    private _value: ScvdValueOutput | undefined;
    private _doc: string | undefined;
    private _handle: NumberType | undefined;
    private _hname: ScvdExpression | undefined;
    private _stateName : string | undefined; // name of referenced state
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
            return super.readXml(xml);
        }

        this.id = getStringFromJson(xml.id);
        this.level = getStringFromJson(xml.level);
        this.property = getStringFromJson(xml.property);
        this.value = getStringFromJson(xml.value);
        this.doc = getStringFromJson(xml.doc);
        this.handle = getStringFromJson(xml.handle);
        this.hname = getStringFromJson(xml.hname);
        this.stateName = getStringFromJson(xml.state);
        this.tracking = getStringFromJson(xml.tracking);

        const print = getArrayFromJson(xml.print);
        print?.forEach( (v: Json) => {
            const printItem = this.addPrint();
            printItem.readXml(v);
        });

        return super.readXml(xml);
    }

    public resolveAndLink(_resolveFunc: (name: string, type: resolveType) => ScvdBase | undefined): boolean {
        // TODO: this._state = this.findReference(ScvdEventState, this._state?.name);
        return false;
    }

    public get id(): ScvdEventId | undefined {
        return this._id;
    }
    public set id(value: string | undefined) {
        if( value !== undefined ) {
            this._id = new ScvdEventId(this, value);
        }
    }

    public get level(): ScvdEventLevel | undefined {
        return this._level;
    }
    public set level(value: string | undefined) {
        if( value !== undefined ) {
            if( this._level === undefined ) {
                this._level = new ScvdEventLevel(this, value);
                return;
            }
            this._level.level = value;
        }
    }

    public get property(): ScvdValueOutput | undefined {
        return this._property;
    }
    public set property(value: string | undefined) {
        if( value !== undefined ) {
            if( this._property === undefined ) {
                this._property = new ScvdValueOutput(this, value);
                return;
            }
            this._property.value = value;
        }
    }

    public get value(): ScvdValueOutput | undefined {
        return this._value;
    }
    public set value(value: string | undefined) {
        if( value !== undefined ) {
            this._value = new ScvdValueOutput(this, value);
        }
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
    public set handle(value: string | undefined) {
        if( value !== undefined ) {
            if( this._handle === undefined ) {
                this._handle = new NumberType(value);
                return;
            }
            this._handle.value = value;
        }
    }

    public get hname(): ScvdExpression | undefined {
        return this._hname;
    }
    public set hname(value: string | undefined) {
        if( value !== undefined ) {
            if( this._hname === undefined ) {
                this._hname = new ScvdExpression(this, value, 'hname');
                return;
            }
            this._hname.expression = value;
        }
    }

    public get state(): ScvdEventState | undefined {
        return this._state;
    }

    // TODO, resolve and link
    public set state(value: ScvdEventState | undefined) {
        this._state = value;
    }

    public get tracking(): ScvdEventTracking | undefined {
        return this._tracking;
    }
    public set tracking(value: string | undefined) {
        if( value !== undefined ) {
            if( this._tracking === undefined ) {
                this._tracking = new ScvdEventTracking(this, value);
                return;
            }
            this._tracking.mode = value;
        }
    }

    public get print(): ScvdPrint[] {
        return this._print;
    }

    public addPrint(): ScvdPrint {
        const item = new ScvdPrint(this);
        this._print.push(item);
        return item;
    }

    public get stateName(): string | undefined {
        return this._stateName;
    }
    public set stateName(value: string | undefined) {
        this._stateName = value;
    }

    public getExplorerInfo(itemInfo: ExplorerInfo[] = []): ExplorerInfo[] {
        const info: ExplorerInfo[] = [];
        if (this.doc) {
            info.push({ name: 'Doc', value: this.doc });
        }
        if (this.handle) {
            info.push({ name: 'Handle', value: this.handle.getDisplayText() });
        }
        if (this.stateName) {
            info.push({ name: 'State', value: this.stateName });
        }
        info.push(...itemInfo);
        return super.getExplorerInfo(info);
    }

    public getExplorerDisplayName(): string {
        return this.id?.id.getExplorerDisplayName() ?? super.getExplorerDisplayName();
    }

}
