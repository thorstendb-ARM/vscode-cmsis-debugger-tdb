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
import { ExplorerInfo, ScvdBase } from './scvdBase';
import { ScvdExpression } from './scvdExpression';

export class ScvdEventId extends ScvdBase {
    private _id: ScvdExpression;
    private _messageNumber: NumberType;
    private _componentNumber: NumberType;
    private _level: NumberType;

    constructor(
        parent: ScvdBase | undefined,
        id: string,
    ) {
        super(parent);
        this._id = new ScvdExpression(this, id);
        const value = this._id.value.value;
        this._messageNumber = new NumberType(value & 0xFF);
        this._componentNumber = new NumberType((value >> 8) & 0xFF);
        this._level = new NumberType((value >> 16) & 0x3);
    }

    get id(): ScvdExpression {
        return this._id;
    }

    get messageNumber(): NumberType {
        return this._messageNumber;
    }

    get componentNumber(): NumberType {
        return this._componentNumber;
    }

    get level(): NumberType {
        return this._level;
    }

    public getExplorerInfo(itemInfo: ExplorerInfo[] = []): ExplorerInfo[] {
        const info: ExplorerInfo[] = [];
        info.push({ name: 'ID', value: this._id.expression ?? '' });
        info.push({ name: 'MessageNumber', value: this._messageNumber.getDisplayText() });
        info.push({ name: 'ComponentNumber', value: this._componentNumber.getDisplayText() });
        info.push({ name: 'Level', value: this._level.getDisplayText() });
        info.push(...itemInfo);
        return super.getExplorerInfo(info);
    }
}
