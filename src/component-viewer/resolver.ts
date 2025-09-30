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

import { ScvdBase } from './model/scvdBase';

// https://arm-software.github.io/CMSIS-View/main/elem_component_viewer.html


export class Resolver {
    private _model: ScvdBase | undefined;

    constructor(
        model: ScvdBase,
    ) {
        this.model = model;
    }

    protected getModel(): ScvdBase | undefined {
        return this._model;
    }
    private set model(value: ScvdBase | undefined) {
        this._model = value;
    }

    public resolve(): boolean {
        const model = this.getModel();
        if( model === undefined) {
            return false;
        }

        model.map( (child, _index) => {
            child.resolveAndLink();
        });

        return true;
    }

}
