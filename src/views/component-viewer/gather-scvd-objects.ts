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

import { ScvdComponentViewer } from './model/scvd-comonent-viewer';
import { ScvdObject } from './model/scvd-object';
import { ScvdEvalContext } from './scvd-eval-context';

export class GatherScvdObjects {
    private _model: ScvdComponentViewer;
    private _varEngine: ScvdEvalContext | undefined;

    constructor(
        model: ScvdComponentViewer
    ) {
        this._model = model;
        const varEngine = new ScvdEvalContext(model);
        this._varEngine = varEngine;
        this.model.evalContext = varEngine.ctx;
    }

    private get model(): ScvdComponentViewer {
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

    public get varEngine(): ScvdEvalContext | undefined {
        return this._varEngine;
    }

    public gatherObject(item: ScvdObject): void {
        if(item === undefined || this.varEngine === undefined) {
            return;
        }

        //item.evalContext = this.varEngine.ctx;
    }
}
