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
import { ScvdComponentViewer } from './model/scvdComonentViewer';
import { ScvdFormatSpecifier } from './model/scvdFormatSpecifier';
import { ScvdVar } from './model/scvdVar';


export type PrintfHook = {
  format: (spec: string, value: any, ctx: EvalContext) => string | undefined;
};

const formatSpecifier = new ScvdFormatSpecifier();

const printfHook: PrintfHook = {
    format(spec: string, value: any, ctx: EvalContext): string | undefined {
        return formatSpecifier.formatValue(spec, value, ctx);
    },
};

export class ScvdVarEngine {
    private _model: ScvdComponentViewer;
    private _ctx: EvalContext;
    private _printf: PrintfHook = printfHook;

    constructor(
        model: ScvdComponentViewer
    ) {
        this._model = model;
        this._ctx = new EvalContext({
            data: this.model,
            printf: {
                format: (spec, value, ctx) => this._printf.format(spec, value, ctx),
            },
            // functions: this.model.functions,          // optional: if your model exposes callables
        });
    }

    public get model(): ScvdComponentViewer {
        return this._model;
    }

    public get ctx(): EvalContext {
        return this._ctx;
    }

    public registerVar(item: ScvdVar): void {
        console.log(`Registering SCVD variable: ${item.name}`);

        // Register the variable in the engine
        const name = item.name;
        if(name === undefined || name.length === 0) {
            console.log('ScvdVarEngine.registerVar: Variable name is undefined or empty');
            return;
        }
    }
}
