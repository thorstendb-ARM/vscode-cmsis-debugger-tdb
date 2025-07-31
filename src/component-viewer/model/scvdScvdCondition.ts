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

import { ScvdExpression } from './scvdExpression';
import { ScvdItem } from './scvdItem';

export class ScvdCondition extends ScvdItem {
    private _expression: ScvdExpression | undefined;

    constructor(
        parent: ScvdItem | undefined,
    ) {
        super(parent);
    }

    public get expression(): ScvdExpression | undefined {
        return this._expression;
    }

    public set expression(value: string) {
        const expression = new ScvdExpression(this);
        expression.expression = value;
        this._expression = expression;
    }

    public get result(): boolean {
        return this._expression
            ? this._expression.result ? true : false
            : true;
    }
}
