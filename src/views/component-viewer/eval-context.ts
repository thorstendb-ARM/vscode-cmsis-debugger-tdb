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
import { ScvdEvalContext } from './scvd-eval-context';

export class EvalContext {
    private _model: ScvdComponentViewer;
    private _evalContext: ScvdEvalContext | undefined;

    constructor(
        model: ScvdComponentViewer
    ) {
        this._model = model;
    }

    private get model(): ScvdComponentViewer {
        return this._model;
    }

    public get evalContext(): ScvdEvalContext | undefined {
        return this._evalContext;
    }

    public init(): boolean {
        const objects = this.model.objects;
        if(objects === undefined) {
            return false;
        }
        if(objects.objects.length > 0) {
            const object = objects.objects[0];
            const evalContext = new ScvdEvalContext(object);
            this._evalContext = evalContext;
            this.model.evalContext = evalContext.ctx;
        }

        return true;
    }

}
