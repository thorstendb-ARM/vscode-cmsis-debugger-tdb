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
import { ScvdList } from '../model/scvd-list';
import { ExecutionContext } from '../scvd-eval-context';
import { StatementBase } from './statement-base';


export class StatementList extends StatementBase {

    constructor(item: ScvdBase, parent: StatementBase | undefined) {
        super(item, parent);
    }

    public executeStatement(executionContext: ExecutionContext): void {
        const conditionResult = this.scvdItem.getConditionResult();
        if (conditionResult === false) {
            console.log(`  Skipping ${this.scvdItem.getExplorerDisplayName()} for condition result: ${conditionResult}`);
            return;
        }

        this.onExecute(executionContext);
        /*for (const child of this.children) {  // executed in list
            child.executeStatement(executionContext);
        }*/
    }

    protected onExecute(executionContext: ExecutionContext): void {
        const scvdList = this.scvdItem.castToDerived(ScvdList);
        if (scvdList === undefined) {
            return;
        }

        const name = scvdList.name;
        if(name === undefined) {
            console.error(`${this.line}: Executing "list": no name defined`);
            return;
        }

        const startExpr = scvdList.start;
        if(startExpr === undefined) {
            console.error(`${this.line}: Executing "list": ${scvdList.name}, no start expression defined`);
            return;
        }
        const startValue = startExpr.getValue();
        if (startValue === undefined) {
            console.error(`${this.line}: Executing "list": ${scvdList.name}, could not evaluate start expression`);
            return;
        }

        const modelBase = executionContext.evalContext.container.base;
        if(modelBase === undefined) {
            console.error(`${this.line}: Executing "list": ${scvdList.name}, no base container defined`);
            return;
        }

        const varItem = modelBase.getSymbol(name);
        if(varItem === undefined) {
            console.error(`${this.line}: Executing "list": ${scvdList.name}, could not find variable in base container: ${modelBase.name}`);
            return;
        }
        const varTargetSize = varItem.getTargetSize();
        if(varTargetSize === undefined) {
            console.error(`${this.line}: Executing "list": ${scvdList.name}, variable: ${varItem.name}, could not determine target size`);
            return;
        }

        let limitValue = 0;
        const limitExpr = scvdList.limit;
        if(limitExpr !== undefined) {
            const limitVal = limitExpr.getValue();
            limitValue = limitVal ?? 0; // do not enter loop if undefined
        }

        const whileExpr = scvdList.while;
        if(whileExpr !== undefined && limitExpr !== undefined) {
            console.error(`${this.line}: Executing "list": ${scvdList.name}, cannot define both limit and while expressions`);
            return;
        }

        let loopValue = startValue;
        let maximumCount = 100000;   // prevent infinite loops
        while (maximumCount-- > 0) {
            executionContext.memoryHost.writeNumber(name, 0, loopValue, varTargetSize);    // update loop variable in memory

            // while-loop
            if(whileExpr !== undefined) {
                whileExpr.invalidate();
                const whileValue = whileExpr.getValue();
                if(whileValue !== undefined) {
                    loopValue = whileValue;
                }
                if(loopValue === 0 || whileValue === undefined) {   // break on read error too
                    break;
                }
            }
            // for-loop: test condition, exit if met
            if(limitExpr !== undefined) {
                if(loopValue >= limitValue) {
                    break;
                }
                loopValue++;
            }

            for (const child of this.children) {  // executed in list
                child.executeStatement(executionContext);
            }
        }
        executionContext.memoryHost.writeNumber(name, 0, loopValue, varTargetSize);    // update last loop variable in memory

        console.log(`${this.line}: Executing list: ${scvdList.name}`);
    }
}
