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

import { ScvdComponentIdentifier } from './scvdComponentIdentifier';
import { ScvdEvents } from './scvdEvents';
import { ScvdBase } from './scvdBase';
import { ScvdObjects } from './scvdObject';
import { ScvdTypedefs } from './scvdTypedef';

export class ScvdComonentViewer extends ScvdBase {
    private _component: ScvdComponentIdentifier | undefined;
    private _typedefs: ScvdTypedefs | undefined;
    private _objects: ScvdObjects | undefined;
    private _events: ScvdEvents | undefined;

    constructor(
        parent: ScvdBase | undefined,
    ) {
        super(parent);
    }

    // public readXml(xml: any): boolean {
    //     if (xml.component_viewer) {
    //         this._component = new ScvdComponent(this);
    //         this._component.readXml(xml.component_viewer.component[0]);
    //         this._typedefs = new ScvdTypedefs(this);
    //         this._typedefs.readXml(xml.component_viewer.typedefs[0]);
    //         this._objects = new ScvdObjects(this);
    //         this._objects.readXml(xml.component_viewer.objects[0]);
    //         this._events = new ScvdEvent(this);
    //         this._events.readXml(xml.component_viewer.events[0]);
    //         return true;
    //     }
    //     return false;
    // }

    get component(): ScvdComponentIdentifier | undefined {
        return this._component;
    }
    get typedefs(): ScvdTypedefs | undefined {
        return this._typedefs;
    }
    get objects(): ScvdObjects | undefined {
        return this._objects;
    }
    get events(): ScvdEvents | undefined {
        return this._events;
    }
}
