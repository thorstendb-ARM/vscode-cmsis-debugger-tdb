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

import { ScvdExpression } from './scvdExpression';
import { ScvdValueOutput } from './scvdValueOutput';
import { ScvdCondition } from './scvdCondition';
import { ExplorerInfo, Json, ScvdBase } from './scvdBase';
import { getStringFromJson } from './scvdUtils';

export class ScvdPrint extends ScvdBase {
    private _cond: ScvdCondition | undefined;
    private _property: ScvdValueOutput | undefined;
    private _value: ScvdExpression | undefined;
    private _bold: ScvdCondition = new ScvdCondition(this, '0');
    private _alert: ScvdCondition = new ScvdCondition(this, '0');

    constructor(
        parent: ScvdBase | undefined,
    ) {
        super(parent);
    }

    public readXml(xml: Json): boolean {
        if (xml === undefined ) {
            return super.readXml(xml);
        }

        this.cond = getStringFromJson(xml.cond);
        this.property = getStringFromJson(xml.property);
        this.value = getStringFromJson(xml.value);
        this.bold = getStringFromJson(xml.bold);
        this.alert = getStringFromJson(xml.alert);

        return super.readXml(xml);
    }
    get property(): ScvdValueOutput | undefined {
        return this._property;
    }
    set property(value: string | undefined) {
        if (value !== undefined) {
            this._property = new ScvdValueOutput(this, value);
        }
    }

    get value(): ScvdExpression | undefined {
        return this._value;
    }
    set value(value: string | undefined) {
        if (value !== undefined) {
            this._value = new ScvdExpression(this, value, 'value');
        }
    }

    get cond(): ScvdCondition | undefined {
        return this._cond;
    }
    set cond(value: string | undefined) {
        if (value !== undefined) {
            this._cond = new ScvdCondition(this, value);
        }
    }

    get bold(): ScvdCondition | undefined {
        return this._bold;
    }
    set bold(value: string | undefined) {
        if (value !== undefined) {
            this._bold = new ScvdCondition(this, value);
        }
    }

    get alert(): ScvdCondition | undefined {
        return this._alert;
    }
    set alert(value: string | undefined) {
        if (value !== undefined) {
            this._alert = new ScvdCondition(this, value);
        }
    }

    public getExplorerInfo(itemInfo: ExplorerInfo[] = []): ExplorerInfo[] {
        const info: ExplorerInfo[] = [];
        info.push(...itemInfo);
        return super.getExplorerInfo(info);
    }
}
