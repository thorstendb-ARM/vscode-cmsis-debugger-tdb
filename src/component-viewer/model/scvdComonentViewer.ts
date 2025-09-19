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
import { Json, ScvdBase } from './scvdBase';
import { ScvdObjects } from './scvdObject';
import { ScvdTypedefs } from './scvdTypedef';
import { getArrayFromJson } from './scvdUtils';

export class ScvdComonentViewer extends ScvdBase {
    private _componentIdentifier: ScvdComponentIdentifier | undefined;
    private _typedefs: ScvdTypedefs | undefined;
    private _objects: ScvdObjects | undefined;
    private _events: ScvdEvents | undefined;

    constructor(
        parent: ScvdBase | undefined,
    ) {
        super(parent);
    }

    /* template for readXml
    public readXml(xml: Json): boolean {
        if (xml === undefined ) {
            return false;
        }

        //this.tag = xml.tag;

        return super.readXml(xml);
    }
    */

    public readXml(xml: Json): boolean {
        if (xml === undefined ) {
            return false;
        }

        const componentViewer = xml.component_viewer;
        if( componentViewer === undefined) {
            return false;
        }

        const componentIdentifier = componentViewer?.component;
        if(componentIdentifier !== undefined) {
            this._componentIdentifier = new ScvdComponentIdentifier(this);
            this._componentIdentifier.readXml(componentIdentifier);
        }

        const objectsContainer = componentViewer?.objects;
        const objects = getArrayFromJson(objectsContainer?.object);
        if(objects !== undefined) {
            this._objects = new ScvdObjects(this);
            this._objects.readXml(objects);
        }

        const typedefsContainer = componentViewer?.typedefs;
        const typedefs = getArrayFromJson(typedefsContainer?.typedef);
        if(typedefs !== undefined) {
            this._typedefs = new ScvdTypedefs(this);
            this._typedefs.readXml(typedefs);
        }

        const events = componentViewer?.events;
        if(events !== undefined) {
            this._events = new ScvdEvents(this);
            this._events.readXml(events);
        }

        return true;
    }

    get component(): ScvdComponentIdentifier | undefined {
        return this._componentIdentifier;
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
