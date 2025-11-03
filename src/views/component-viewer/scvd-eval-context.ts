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
import { ScvdBase } from './model/scvd-base';
import { ScvdEvalInterface } from './model/scvd-eval-interface';
import { ScvdFormatSpecifier } from './model/scvd-format-specifier';


export type PrintfHook = {
  format: (spec: string, value: any, ctx: EvalContext) => string | undefined;
};

const formatSpecifier = new ScvdFormatSpecifier();

const printfHook: PrintfHook = {
    format(spec: string, value: any, ctx: EvalContext): string | undefined {
        return formatSpecifier.formatValue(spec, value, ctx);
    },
};

export class ScvdEvalContext {
    private _ctx: EvalContext;
    private _printf: PrintfHook = printfHook;
    private _host: ScvdEvalInterface;

    constructor(
        baseContainer: ScvdBase
    ) {
        // Create the DataHost (stateless; you can reuse a single instance)
        this._host = new ScvdEvalInterface();

        // Your model’s root ScvdBase (where symbol resolution starts)
        this._ctx = new EvalContext({
            data: this._host,              // DataHost
            container: baseContainer, // ScvdBase root for symbol resolution
            printf: {
                format: (spec, value, ctx) => this._printf.format(spec, value, ctx),
            },
            // functions: this._host.functions, // optional external callables table
        });
    }

    public get ctx(): EvalContext {
        return this._ctx;
    }
}
