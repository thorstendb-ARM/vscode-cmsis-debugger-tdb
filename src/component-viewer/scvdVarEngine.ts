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


export class ScvdVarEngine {
    private _model: ScvdComonentViewer;
    constructor(
        model: ScvdComonentViewer
    ) {
        this._model = model;
    }

    private get model(): ScvdComonentViewer {
        return this._model;
    }

    public processVariables(): boolean {
        // Implementation for processing variables from the model
        if(this.model === undefined) {
            return false;
        }

        return true;
    }

}
