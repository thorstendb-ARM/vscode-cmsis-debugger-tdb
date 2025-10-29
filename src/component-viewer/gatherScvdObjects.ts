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

import { ScvdComonentViewer } from './model/scvdComonentViewer';
import { ScvdObject } from './model/scvdObject';
import { ScvdVarEngine } from './scvdVarEngine';

export class GatherScvdObjects {
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

    public gatherObjects(): boolean {
        const objectsContainer = this.model.objects;
        if(objectsContainer === undefined) {
            return false;
        }

        objectsContainer.objects.forEach( (child: ScvdObject) => {
            this.gatherObject(child);
        });

        return true;
    }

    public get varEngine(): ScvdVarEngine | undefined {
        return this._varEngine;
    }

    public gatherObject(item: ScvdObject): void {
        if(item === undefined || this.varEngine === undefined) {
            return;
        }

        const vars = item.vars;
        vars.forEach( (v) => {
            this.varEngine?.registerVar(v);
        });
    }
}
