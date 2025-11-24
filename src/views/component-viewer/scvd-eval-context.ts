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

import { CachedMemoryHost } from './cache/cache';
import { Cm81MRegisterCache } from './cache/register-cache';
import { EvalContext } from './evaluator';
import { createMockCm81MRegisterReader } from './mock/cm81m-registers';
import { ScvdBase } from './model/scvd-base';
import { ScvdComponentViewer } from './model/scvd-comonent-viewer';
import { printfHook } from './printf-hook';
import { ScvdEvalInterface } from './scvd-eval-interface';

export interface ExecutionContext {
    memoryHost: CachedMemoryHost;
    registerHost: Cm81MRegisterCache;
    evalContext: EvalContext;
}


export class ScvdEvalContext {
    private _ctx: EvalContext;
    private _evalHost: ScvdEvalInterface;
    private _memoryHost: CachedMemoryHost;
    private _registerHost: Cm81MRegisterCache;
    private _model: ScvdComponentViewer;

    constructor(
        model: ScvdComponentViewer
    ) {
        this._model = model;

        this._memoryHost = new CachedMemoryHost({ endianness: 'little' });
        this._registerHost = new Cm81MRegisterCache(createMockCm81MRegisterReader());
        this._evalHost = new ScvdEvalInterface(this._memoryHost, this._registerHost);
        const outItem = this.getOutItem();
        if(outItem === undefined) {
            throw new Error('SCVD EvalContext: No output item defined');
        }

        this._ctx = new EvalContext({
            data: this._evalHost,               // DataHost
            container: outItem,                 // ScvdBase root for symbol resolution
            printf: printfHook,
        });
    }

    private get model(): ScvdComponentViewer {
        return this._model;
    }

    private get memoryHost(): CachedMemoryHost {
        return this._memoryHost;
    }

    private get registerHost(): Cm81MRegisterCache {
        return this._registerHost;
    }

    private get ctx(): EvalContext {
        return this._ctx;
    }

    public getExecutionContext(): ExecutionContext {
        return {
            memoryHost: this.memoryHost,
            registerHost: this.registerHost,
            evalContext: this.ctx
        };
    }

    public getOutItem(): ScvdBase | undefined {
        const objects = this.model.objects;
        if(objects === undefined) {
            return undefined;
        }
        if(objects.objects.length > 0) {
            const object = objects.objects[0];
            return object;
        }
        return undefined;
    }

    public init() {
    }
}
