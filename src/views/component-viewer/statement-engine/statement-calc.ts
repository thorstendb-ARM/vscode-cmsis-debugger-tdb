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
import { ScvdCalc } from '../model/scvd-calc';
import { ExecutionContext } from '../scvd-eval-context';
import { StatementBase } from './statement-base';


export class StatementCalc extends StatementBase {

    constructor(item: ScvdBase, parent: StatementBase | undefined) {
        super(item, parent);
    }

    protected onExecute(_executionContext: ExecutionContext): void {
        const calcItem = this.scvdItem.castToDerived(ScvdCalc);
        if (!calcItem) {
            throw new Error('Invalid SCVD item');
        }

        const expressions = calcItem.expression;
        expressions.forEach((expr) => {
            expr.invalidate();
            const value = expr.getValue();
            console.log(`${this.line} Executing "calc": ${expr.expression}, value: ${value}`);
        });
    }
}
