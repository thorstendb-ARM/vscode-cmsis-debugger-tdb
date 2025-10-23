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

// https://arm-software.github.io/CMSIS-View/main/elem_component_viewer.html

import { ExplorerInfo, ScvdBase } from './scvdBase';
import { ScvdPrintExpression } from './scvdPrintExpression';

export class ScvdValueOutput extends ScvdBase {
    private _expression: ScvdPrintExpression | undefined;

    constructor(
        parent: ScvdBase | undefined,
        expression: string,
    ) {
        super(parent);
        this._expression = new ScvdPrintExpression(this, expression, 'printExpression');
    }

    public get expression(): ScvdPrintExpression | undefined {
        return this._expression;
    }

    public set expression(value: string) {
        if( this._expression === undefined) {
            this._expression = new ScvdPrintExpression(this, value, 'printExpression');
            return;
        }
        this._expression.expression = value;
    }


    public getValue(): string | undefined {
        if(!this.expression) {
            return undefined;
        }
        return this.expression.resultText;
    }

    public getExplorerInfo(itemInfo: ExplorerInfo[] = []): ExplorerInfo[] {
        const info: ExplorerInfo[] = [];
        const value = this.getValue();
        if (value !== undefined) {
            info.push({ name: 'Value', value });
        }
        info.push(...itemInfo);
        return super.getExplorerInfo(info);
    }

    public getExplorerDisplayName(): string {
        return this.getValue() ?? super.getExplorerDisplayName();
    }
}
