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
import { ScvdGuiInterface } from '../model/scvd-gui-interface';
import { ScvdList } from '../model/scvd-list';
import { ExecutionContext } from '../scvd-eval-context';
import { LoopVariable, StatementBase } from './statement-base';
import { StatementCalc } from './statement-calc';
import { StatementItem } from './statement-item';
import { StatementList } from './statement-list';
import { StatementObject } from './statement-object';
import { StatementOut } from './statement-out';
import { StatementRead } from './statement-read';
import { StatementReadList } from './statement-readList';
import { StatementVar } from './statement-var';


export class StatementListOut extends StatementBase {
    private _iteratedChildren: StatementBase[] = [];

    constructor(item: ScvdBase, parent: StatementBase | undefined) {
        super(item, parent);
    }

    private buildStatement(item: ScvdBase, parent: StatementBase | undefined) : StatementBase | undefined {
        const ctorName = item.constructor?.name;

        switch (ctorName) {
            case 'ScvdObject':
                // Object-specific logic
                return new StatementObject(item, parent);
            case 'ScvdVar':
                // Variable-specific logic.
                return new StatementVar(item, parent);
            case 'ScvdCalc':
                // Calculation-specific logic.
                return new StatementCalc(item, parent);
            case 'ScvdReadList':
                // ReadList-specific logic.
                return new StatementReadList(item, parent);
            case 'ScvdRead':
                // Read-specific logic.
                return new StatementRead(item, parent);
            case 'ScvdList':
                // List-specific logic.
                return new StatementList(item, parent);
            case 'ScvdListOut':
                // List-specific logic.
                return new StatementListOut(item, parent);
            case 'ScvdOut':
                // Output-specific logic.
                return new StatementOut(item, parent);
            case 'ScvdItem':
                // Item-specific logic.
                return new StatementItem(item, parent);
            default:
                // Generic logic for other item types.
                return undefined;
        }
    }


    private addIteratedChild(child: StatementBase, loopVar: LoopVariable): StatementBase | undefined {
        if(child !== undefined) {
            if(this._iteratedChildren === undefined) {
                this._iteratedChildren = [];
            }
            const newChild = this.buildStatement(child.scvdItem, undefined);
            if(newChild === undefined) {
                return undefined;
            }
            newChild.loopVar = loopVar;
            this._iteratedChildren.push(newChild);
        }
        return child;
    }

    get iteratedChildren(): StatementBase[] | undefined {
        return this._iteratedChildren;
    }

    public clearIteratedChildren(): void {
        this._iteratedChildren = [];
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

    private addIteratedChildren(child: StatementBase, loopVar: LoopVariable): void {
        this.addIteratedChild(child, loopVar);
        child.executeStatement(loopVar.executionContext);
    }

    protected onExecute(executionContext: ExecutionContext): void {
        this.clearIteratedChildren();
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

            if(whileExpr !== undefined) {
                whileExpr.invalidate();
                const whileValue = whileExpr.getValue();
                if(loopValue === 0 || whileValue === undefined) {   // break on read error too
                    break;
                }
            }
            if(limitExpr !== undefined) {
                if(loopValue >= limitValue) {
                    break;
                }
            }

            for (const child of this.children) {  // executed in list
                const loopVar: LoopVariable = { name: name, currentValue: loopValue, size: varTargetSize, offset: 0, executionContext: executionContext };
                this.addIteratedChildren(child, loopVar);
            }

            if(whileExpr !== undefined) {
                const whileValue = whileExpr.getValue();
                if(whileValue !== undefined) {
                    loopValue = whileValue;
                }
            }
            if(limitExpr !== undefined) {
                loopValue++;
            }
        }
        executionContext.memoryHost.writeNumber(name, 0, loopValue, varTargetSize);    // update last loop variable in memory

        console.log(`${this.line}: Executing list: ${scvdList.name}`);
    }


    // ------------  GUI Interface Begin ------------
    public getGuiEntry(): { name: string | undefined, value: string | undefined } {
        return { name: this.scvdItem.getGuiName(), value: this.scvdItem.getGuiValue() };
    }

    public getGuiChildren(): ScvdGuiInterface[] {
        return this._iteratedChildren;
    }

    public hasGuiChildren(): boolean {
        return this._iteratedChildren.length > 0;
    }

    public getGuiName(): string | undefined {
        return this.scvdItem.getGuiName();
    }

    public getGuiValue(): string | undefined {
        return this.scvdItem.getGuiValue();
    }

    public getGuiConditionResult(): boolean {
        return true;    // use getConditionResult() later
    }

    public getGuiLineInfo(): string {
        return this.scvdItem.getLineInfoStr();
    }

    // ------------  GUI Interface End ------------

}
