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

import { ScvdBase } from './scvdBase';

// https://arm-software.github.io/CMSIS-View/main/elem_component_viewer.html

export enum EventLevel {
    EventLevelError = 0,   // Run-time error
    EventLevelAPI = 1,     // API function call
    EventLevelOp = 2,      // Internal operation
    EventLevelDetail = 3,  // Additional detailed information of operations
}

export class ScvdEventLevel extends ScvdBase {
    private _level: EventLevel | undefined;

    constructor(
        parent: ScvdBase | undefined,
        level: string,
    ) {
        super(parent);
        this._level = EventLevel[level as keyof typeof EventLevel];
    }

    get level(): EventLevel | undefined {
        return this._level;
    }

    set level(value: EventLevel | undefined) {
        this._level = value;
    }

    public filter(level: EventLevel): boolean {
        return this._level !== undefined ? this._level <= level : true;
    }
}
