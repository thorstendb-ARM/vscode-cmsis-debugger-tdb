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
import { ScvdExpression } from './scvdExpression';

export class ScvdCondition extends ScvdBase {
    private _expression: ScvdExpression | undefined;

    constructor(
        parent: ScvdBase | undefined,
        expression: string = '1' // default condition is true
    ) {
        super(parent);
        this._expression = new ScvdExpression(this, expression, 'expression');
    }

    public get expression(): ScvdExpression | undefined {
        return this._expression;
    }

    public set expression(value: string) {
        if( this._expression === undefined) {
            this._expression = new ScvdExpression(this, value, 'expression');
            return;
        }
        this._expression.expression = value;
    }

    public get result(): boolean {
        return this._expression
            ? this._expression.value ? true : false
            : true;
    }

    public getExplorerInfo(itemInfo: ExplorerInfo[] = []): ExplorerInfo[] {
        const info: ExplorerInfo[] = [];
        if (this._expression !== undefined) {
            info.push({ name: 'Expression', value: this._expression.expression ?? '' });
            info.push({ name: 'Result', value: this.result ? 'true' : 'false' });
        }
        info.push(...itemInfo);
        return super.getExplorerInfo(info);
    }

    public getExplorerDisplayName(): string {
        const displayName = this._expression?.getExplorerDisplayName() ?? 'condition';
        return displayName ?? super.getExplorerDisplayName();
    }
}
