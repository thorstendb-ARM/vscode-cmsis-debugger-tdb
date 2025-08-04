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

import { ScvdComponent } from './scvdComponent';
import { ScvdEvent } from './scvdEvent';
import { ScvdItem } from './scvdItem';
import { ScvdObjects } from './scvdObject';
import { ScvdTypedefs } from './scvdTypedef';

export class ScvdModel extends ScvdItem {
    private _component: ScvdComponent | undefined;
    private _typedefs: ScvdTypedefs | undefined;
    private _objects: ScvdObjects | undefined;
    private _events: ScvdEvent | undefined;

    constructor(
        parent: ScvdItem | undefined,
    ) {
        super(parent);
    }

    get component(): ScvdComponent | undefined {
        return this._component;
    }
    get typedefs(): ScvdTypedefs | undefined {
        return this._typedefs;
    }
    get objects(): ScvdObjects | undefined {
        return this._objects;
    }
    get events(): ScvdEvent | undefined {
        return this._events;
    }

    public configure(_typedefs: ScvdTypedefs): boolean {
        if (this._typedefs !== undefined) {
            return false;
        }

        this.objects?.map((obj) => {
            obj.configure(_typedefs);
        });
        return true;
    }

}
