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

export class ScvdEventId {
    private _id: NumberType;
    private _messageNumber: NumberType;
    private _componentNumber: NumberType;
    private _level: NumberType;

    constructor(
        id: string,
    ) {
        this._id = new NumberType(id);
        this._messageNumber = new NumberType(this._id.value & 0xFF);
        this._componentNumber = new NumberType((this._id.value >> 8) & 0xFF);
        this._level = new NumberType((this._id.value >> 16) & 0x3);
    }

    get id(): NumberType {
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
}
