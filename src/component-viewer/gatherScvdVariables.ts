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
import { ScvdComonentViewer } from './model/scvdComonentViewer';
import { ScvdVarEngine } from './scvdVarEngine';

export class GatherScvdVariables {
    private _model: ScvdComonentViewer;
    private _varEngine: ScvdVarEngine | undefined;

    constructor(
        model: ScvdComonentViewer
    ) {
        this._model = model;
        this._varEngine = new ScvdVarEngine(model);
    }

    private get model(): ScvdComonentViewer {
        return this._model;
    }

    public get varEngine(): ScvdVarEngine | undefined {
        return this._varEngine;
    }

    public gatherVariables(): boolean {
        // Implementation for gathering variables from the model
        this.gatherTypedefs();
        this.gatherObjects();
        return true;
    }

    private gatherTypedefsRecursive(item: ScvdBase): void {
        item.children.forEach( (child: ScvdBase) => {
            this.gatherTypedefsRecursive(child);
        });
    }
    public gatherTypedefs(): void {
        const typedefs = this.model.typedefs;
        if(typedefs !== undefined) {
            this.gatherTypedefsRecursive(typedefs);
        }
    }

    private gatherObjectsRecursive(item: ScvdBase): void {
        item.children.forEach( (child: ScvdBase) => {
            this.gatherObjectsRecursive(child);
        });
    }
    public gatherObjects(): void {
        const objects = this.model.objects;
        if(objects !== undefined) {
            this.gatherObjectsRecursive(objects);
        }
    }
}
