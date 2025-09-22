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

import { Json, ScvdBase } from './scvdBase';
import { ScvdComponent } from './scvdComponent';

export class ScvdGroup extends ScvdBase {
    private _component: ScvdComponent[] = [];

    constructor(
        parent: ScvdBase | undefined,
    ) {
        super(parent);
    }

    public readXml(xml: Json): boolean {
        if (xml === undefined ) {
            return false;
        }

        const components = xml.component;
        if(components !== undefined) {
            if(Array.isArray(components)) {
                components.forEach((component: Json) => {
                    const newComponent = this.addComponent();
                    newComponent.readXml(component);
                });
            } else {
                const newComponent = this.addComponent();
                newComponent.readXml(components);
            }
        }

        return true;
    }

    public addComponent(): ScvdComponent {
        const newComponent = new ScvdComponent(this);
        this._component.push(newComponent);
        return newComponent;
    }

    public get components(): ScvdComponent[] {
        return this._component;
    }
}
