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

import { EvalContext } from './evaluator';
import { MockGdbRuntime } from './mock/mock-gdb-runtime';
import { ScvdBase } from './model/scvd-base';
import { ScvdComponentViewer } from './model/scvd-comonent-viewer';
import { printfHook } from './printf-hook';
import { ScvdEvalInterface } from './scvd-eval-interface';


export class ScvdEvalContext {
    private _ctx: EvalContext;
    private _host: ScvdEvalInterface;
    private _model: ScvdComponentViewer;
    private _runtime: MockGdbRuntime;

    constructor(
        model: ScvdComponentViewer
    ) {
        this._model = model;
        this._runtime = new MockGdbRuntime({
            memSize: 1 << 20,
            defaultSymbolSpan: 512, // optional
            refToName: (ref: any) => ref.name, // or your own mapping
        });
        this._runtime.refreshSymtabFromGdb();

        // Create the DataHost (stateless; you can reuse a single instance)
        this._host = new ScvdEvalInterface(this._runtime, this._runtime, { endianness: 'little' });
        const outItem = this.getOutItem();
        if(outItem === undefined) {
            throw new Error('SCVD EvalContext: No output item defined');
        }

        // Your model’s root ScvdBase (where symbol resolution starts)
        this._ctx = new EvalContext({
            data: this._host,              // DataHost
            container: outItem, // ScvdBase root for symbol resolution
            printf: printfHook,
            // functions: this._host.functions, // optional external callables table
        });
    }

    private get model(): ScvdComponentViewer {
        return this._model;
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

    public get runtime(): MockGdbRuntime {
        return this._runtime;
    }

    public init() {
        // Initialize the EVAL context (pre-declare symbols, etc.)
        this._model.evalContext = this._ctx;
    }

    public get ctx(): EvalContext {
        return this._ctx;
    }
}
