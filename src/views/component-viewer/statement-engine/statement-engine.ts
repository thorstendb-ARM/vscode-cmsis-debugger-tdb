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

import { ScvdBase } from '../model/scvd-base';
import { StatementBase } from './statement-item';


export class StatementEngine {
    private _model: ScvdBase;
    private _statementTree: StatementBase | undefined;

    constructor(model: ScvdBase) {
        this._model = model;
    }

    get model(): ScvdBase {
        return this._model;
    }

    get statementTree(): StatementBase | undefined {
        return this._statementTree;
    }

}
