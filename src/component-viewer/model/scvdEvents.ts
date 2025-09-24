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

//

import { Json, ScvdBase } from './scvdBase';
import { ScvdEvent } from './scvdEvent';
import { ScvdGroup } from './scvdGroup';
import { getArrayFromJson } from './scvdUtils';

export class ScvdEvents extends ScvdBase {
    private _event: ScvdEvent[] = [];
    private _group: ScvdGroup[] = [];

    constructor(
        parent: ScvdBase | undefined,
    ) {
        super(parent);
    }

    public readXml(xml: Json): boolean {
        if (xml === undefined ) {
            return false;
        }

        const events = getArrayFromJson(xml);
        events?.forEach( (v: Json) => {
            const event = getArrayFromJson(v.event);
            event?.forEach( (v: Json) => {
                const item = this.addEvent();
                item.readXml(v);
            });

            const groups = getArrayFromJson(v.group);
            groups?.forEach( (v: Json) => {
                const item = this.addGroup();
                item.readXml(v);
            });
        });

        return super.readXml(xml);
    }

    get event(): ScvdEvent[] {
        return this._event;
    }

    public addEvent(): ScvdEvent {
        const event = new ScvdEvent(this);
        this._event.push(event);
        return event;
    }

    get group(): ScvdGroup[] {
        return this._group;
    }
    public addGroup(): ScvdGroup {
        const group = new ScvdGroup(this);
        this._group.push(group);
        return group;
    }
}
