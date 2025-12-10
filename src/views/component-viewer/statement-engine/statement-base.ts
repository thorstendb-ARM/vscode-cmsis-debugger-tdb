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
import { ScvdGuiTree } from '../scvd-gui-tree';


export interface LoopVariable {
    name: string;
    value: number;
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
export class StatementBase {
    private _parent: StatementBase | undefined;
    private _children: StatementBase[] = [];
    private _scvdItem: ScvdBase;
    private _loopVar: LoopVariable | undefined;
    private _origLoopVar: LoopVariable | undefined;

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

    private get currentLoopVar(): LoopVariable | undefined {
        return this._origLoopVar;
    }
    private set currentLoopVar(loopVar: LoopVariable | undefined) {
        this._origLoopVar = loopVar;
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

    public async executeStatement(executionContext: ExecutionContext, guiTree: ScvdGuiTree): Promise<void> {
        const conditionResult = await this.scvdItem.getConditionResult();
        if (conditionResult === false) {
            console.log(`  Skipping ${this.scvdItem.getExplorerDisplayName()} for condition result: ${conditionResult}`);
            return;
        }

        await this.onExecute(executionContext, guiTree);

        for (const child of this.children) {
            await child.executeStatement(executionContext, guiTree);
        }
    }

    protected restoreLoopVariable(restoreCurrent: boolean = false): void {
        if(this.loopVar?.executionContext === undefined) {
            return;
        }
        const val = this.loopVar.executionContext.memoryHost.getVariable(this.loopVar.name, this.loopVar.size, this.loopVar.offset);
        if(!restoreCurrent) {
            if(val !== undefined) {
                this.currentLoopVar = {
                    ...this.loopVar,
                    value: val,
                };
            }
        }

        const loopVar = restoreCurrent ? this.currentLoopVar : this.loopVar;    // restore original if undefined
        if(val === loopVar?.value) {
            return; // no change
        }
        const executionContext = loopVar?.executionContext;
        if(executionContext !== undefined && loopVar !== undefined) {
            executionContext.memoryHost.setVariable(loopVar.name, loopVar.size, loopVar.value, loopVar.offset);
        }
    }

    /** Override in subclasses to perform work for this node. */
    protected async onExecute(_executionContext: ExecutionContext, _guiTree: ScvdGuiTree): Promise<void> {
        console.log(`${this.line}: ${this.scvdItem.constructor.name}`);
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
        return '<name> from StatementBase';
        this.restoreLoopVariable();
        const value = this.scvdItem.getGuiName();
        this.restoreLoopVariable(true);
        return value;
    }

    public getGuiValue(): string | undefined {
        this.restoreLoopVariable();
        const value = this.scvdItem.getGuiValue();
        this.restoreLoopVariable(true);
        return value;
    }

    public getGuiConditionResult(): boolean {
        return true;    // use getConditionResult() later
    }

    public getGuiLineInfo(): string {
        return this.scvdItem.getLineInfoStr();
    }

    // ------------  GUI Interface End ------------

}
