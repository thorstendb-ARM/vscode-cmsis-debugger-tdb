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

// https://arm-software.github.io/CMSIS-View/main/elem_member.html#elem_enum

import { ScvdExpression } from './scvdExpression';
import { ExplorerInfo, Json, ScvdBase } from './scvdBase';
import { getStringFromJson } from './scvdUtils';

export class ScvdEnum extends ScvdBase {
    private _value: ScvdExpression;

    constructor(
        parent: ScvdBase | undefined,
        lastEnum: ScvdEnum | undefined,
    ) {
        super(parent);
        const lastValue = lastEnum?.value;
        const valStr = lastValue ? `(${lastValue.expression}) + 1` : '0';
        this._value = new ScvdExpression(this, valStr, 'value');
    }

    public readXml(xml: Json): boolean {
        if (xml === undefined ) {
            return super.readXml(xml);
        }

        this.value = getStringFromJson(xml.value);
        this.value.readXml(xml.value);

        return super.readXml(xml);
    }

    public get value(): ScvdExpression {
        return this._value;
    }
    public set value(value: string | undefined) {
        if (value !== undefined) {
            if( this._value === undefined) {
                this._value = new ScvdExpression(this, value, 'value');
                return;
            }
            this._value.expression = value;
        }
    }

    public getExplorerInfo(itemInfo: ExplorerInfo[] = []): ExplorerInfo[] {
        const info: ExplorerInfo[] = [];
        if (this._value !== undefined) {
            info.push({ name: 'Value', value: this._value.expression ?? '' });
            info.push({ name: 'Result', value: this._value.value.getDisplayText() });
        }
        info.push(...itemInfo);
        return super.getExplorerInfo(info);
    }

}
