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
import { ExplorerInfo, Json, ScvdBase } from './scvdBase';
import { ScvdObjects } from './scvdObject';
import { ScvdTypedefs } from './scvdTypedef';
import { getArrayFromJson, getObjectFromJson } from './scvdUtils';

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
            return super.readXml(xml);
        }

        //this.tag = xml.tag;

        return super.readXml(xml);
    }
    */

    public readXml(xml: Json): boolean {
        if (xml === undefined ) {
            return super.readXml(xml);
        }

        const componentViewer: Json = getObjectFromJson(xml.component_viewer);
        if( componentViewer === undefined) {
            return false;
        }

        const componentIdentifier: Json = getObjectFromJson(componentViewer.component);
        if(componentIdentifier !== undefined) {
            this._componentIdentifier = new ScvdComponentIdentifier(this);
            this._componentIdentifier.readXml(componentIdentifier);
        }

        const objectsContainer: Json = getObjectFromJson(componentViewer.objects);
        if(objectsContainer !== undefined) {
            this._objects = new ScvdObjects(this);
            this._objects.readXml(objectsContainer);
        }

        const typedefsContainer: Json = getObjectFromJson(componentViewer.typedefs);
        if(typedefsContainer !== undefined) {
            this._typedefs = new ScvdTypedefs(this);
            this._typedefs.readXml(typedefsContainer);
        }

        const events = getArrayFromJson(componentViewer?.events);
        if(events !== undefined) {
            this._events = new ScvdEvents(this);
            this._events.readXml(events);
        }

        return super.readXml(xml);
    }

    public get component(): ScvdComponentIdentifier | undefined {
        return this._componentIdentifier;
    }
    public get typedefs(): ScvdTypedefs | undefined {
        return this._typedefs;
    }
    public get objects(): ScvdObjects | undefined {
        return this._objects;
    }
    public get events(): ScvdEvents | undefined {
        return this._events;
    }

    public getExplorerInfo(itemInfo: ExplorerInfo[] = []): ExplorerInfo[] {
        const info: ExplorerInfo[] = [];
        info.push(...itemInfo);
        return super.getExplorerInfo(info);
    }

}
