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

import { ObjectDataHost } from './dataHost';
import { EvalContext, EvalContextInit } from './evaluator';
import { ScvdComonentViewer } from './model/scvdComonentViewer';
import { ScvdComplexDataType, ScvdScalarDataType } from './model/scvdDataType';
import { ScvdFormatSpecifier } from './model/scvdFormatSpecifier';
import { ScvdVar } from './model/scvdVar';


const formatSpecifier = new ScvdFormatSpecifier();

export const contextInit: EvalContextInit = {
    printf: {
        format(spec, value, ctx) {
            return formatSpecifier.formatValue(spec, value, ctx);
        },
    },
};
const target = {
    //regs: { r0: 0x1234 },
    //os:   { thread: { priority: 24 } },
    //x: 10,
};


export class ScvdVarEngine {
    private _model: ScvdComonentViewer;
    private _ctx: EvalContext;


    constructor(
        model: ScvdComonentViewer
    ) {
        this._model = model;
        const host = new ObjectDataHost(target);
        this._ctx = new EvalContext({ ...contextInit, data: host });
    }

    public get model(): ScvdComonentViewer {
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

        const varType = item.type?.type;

        if(varType instanceof ScvdScalarDataType) {
            console.log(` - Type: ${varType.type}`);
            const typeName = varType.type;
            if(typeName === undefined) {
                console.log('ScvdVarEngine.registerVar: Variable type name is undefined');
                return;
            }
            let ctype = this.ctx.getType(typeName);
            if(ctype === undefined) {
                console.log(`ScvdVarEngine.registerVar: Registering type: ${typeName}`);
                const newType = this.ctx.convertType(typeName);
                if(newType === undefined) {
                    console.log(`ScvdVarEngine.registerVar: Failed to convert type: ${typeName}`);
                    return;
                }
                ctype = newType;
            }
            const itemValue = item.value?.value;
            let value: number = 0;
            if(itemValue !== undefined) {
                value = itemValue.value;
            }
            this.ctx.define(name, ctype, value);
        } else if(varType instanceof ScvdComplexDataType) {
            console.log(` - Type: ${varType.typeName} (complex)`);
        } else {
            console.log(' - Type: undefined');
        }


    }
}
