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
import { ExecutionContext } from '../scvd-eval-context';
import { ScvdGuiInterface } from '../model/scvd-gui-interface';


export interface LoopVariable {
    name: string;
    currentValue: number;
    size: number;
    offset: number;
    executionContext: ExecutionContext;
}

/**
 * Base statement node using an **array** for children.
 * - Children are appended as added.
 * - `sortChildren()` sorts by line number (ascending) and is **stable** so
 *   statements on the same line keep the order they were added.
 * - `executeStatement()` walks the tree depth-first in current order.
 */
export class StatementBase implements ScvdGuiInterface {
    private _parent: StatementBase | undefined;
    private _children: StatementBase[] = [];
    private _scvdItem: ScvdBase;
    private _loopVar: LoopVariable | undefined;

    constructor(
        item: ScvdBase, parent: StatementBase | undefined
    ) {
        this._scvdItem = item;
        this._parent = parent;
        parent?.addChild(this);
    }

    public get parent(): StatementBase | undefined {
        return this._parent;
    }

    public get children(): StatementBase[] {
        return this._children;
    }

    public get scvdItem(): ScvdBase {
        return this._scvdItem;
    }

    /** Append a child and return it. */
    public addChild(child: StatementBase): StatementBase | undefined {
        if(child !== undefined) {
            this._children.push(child);
        }
        return child;
    }

    /** Numeric line for this node, derived from underlying item. */
    public get line(): number {
        const lineNo = Number(this.scvdItem.lineNo);
        return isNaN(lineNo) ? 0 : lineNo;
    }

    public get loopVar(): LoopVariable | undefined {
        return this._loopVar;
    }
    public set loopVar(loopVar: LoopVariable | undefined) {
        this._loopVar = loopVar;
    }

    /**
    * Stable sort by `line`, then recurse into children.
    * Uses index tiebreak to guarantee same-line insertion order.
    */
    public sortChildren(): void {
        if (this._children.length > 1) {
            this._children = this._children
                .map((child, originalIndex) => ({ child, originalIndex }))
                .sort((left, right) => (left.child.line - right.child.line) || (left.originalIndex - right.originalIndex))
                .map(wrapper => wrapper.child);
        }

        for (const child of this._children) {
            child.sortChildren();
        }
    }

    public executeStatement(executionContext: ExecutionContext): void {
        const conditionResult = this.scvdItem.getConditionResult();
        if (conditionResult === false) {
            console.log(`  Skipping ${this.scvdItem.getExplorerDisplayName()} for condition result: ${conditionResult}`);
            return;
        }

        this.onExecute(executionContext);

        for (const child of this.children) {
            child.executeStatement(executionContext);
        }
    }

    private restoreLoopVariable(): void {
        const loopVar = this.loopVar;
        const executionContext = loopVar?.executionContext;
        if(executionContext !== undefined && loopVar !== undefined) {
            executionContext.memoryHost.setVariable(loopVar.name, loopVar.size, loopVar.currentValue, loopVar.offset);
        }
    }

    /** Override in subclasses to perform work for this node. */
    protected onExecute(_executionContext: ExecutionContext): void {
        // no-op in base
        //console.log(`${this.line}: Executing "${this.scvdItem.constructor.name}", ${this.scvdItem.getExplorerDisplayName()}`);
        console.log(`${this.line}: ${this.scvdItem.constructor.name}`);
        return;
    }

    // ------------  GUI Interface Begin ------------
    public getGuiEntry(): { name: string | undefined, value: string | undefined } {
        return { name: this.scvdItem.getGuiName(), value: this.scvdItem.getGuiValue() };
    }

    public getGuiChildren(): ScvdGuiInterface[] {
        return this.children;
    }

    public hasGuiChildren(): boolean {
        return this.children.length > 0;
    }

    public getGuiName(): string | undefined {
        return this.scvdItem.getGuiName();
    }

    public getGuiValue(): string | undefined {
        this.restoreLoopVariable();
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
