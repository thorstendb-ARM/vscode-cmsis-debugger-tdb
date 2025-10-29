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

import { EvalContext } from '../evaluator';
import { resolveType } from '../resolver';
import { NumberType } from './numberType';
import { ScvdEvalInterface } from './scvdEvalInterface';
import { getLineNumberFromJson, getStringFromJson } from './scvdUtils';

// add linter exception for Json
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Json = Record<string, any>;

let g_idNext: number = 1;

export type ExplorerInfo = {
    name: string;
    value: string;
    icon?: string;
};

export class ScvdBase extends ScvdEvalInterface {
    private _parent: ScvdBase | undefined;
    private _children: ScvdBase[] = [];
    private _nodeId: number = 0;

    private _tag: string | undefined;
    private _lineNo: string | undefined;

    private _name: string | undefined;
    private _info: string | undefined;

    private _isModified: boolean = false;
    private _valid: boolean = false;

    static #_evalContext?: EvalContext | undefined;


    constructor(
        parent: ScvdBase | undefined,
    ) {
        super();
        g_idNext += 1;
        this._nodeId = g_idNext;

        if (parent instanceof ScvdBase) {
            this._parent = parent;
        }
        this._parent?._children.push(this);
    }

    public readXml(xml: Json): boolean {
        if (xml === undefined ) {
            this.tag = 'XML undefined';
            return false;
        }
        this.lineNo = getLineNumberFromJson(xml);
        const tag = getStringFromJson(xml['#Name'] ?? xml['#name']);
        if(tag === undefined) {
            if(Array.isArray(xml)) {
                const subTag = getStringFromJson(xml[0]?.['#Name'] ?? xml[0]?.['#name'] ?? xml[0]?.tag);
                if(subTag !== undefined) {
                    this.tag = subTag + '[]';
                } else {
                    this.tag = 'Array[]';
                }
            } else {
                if(this.tag === undefined ) {
                    this.tag = 'unknown-tag';
                }
            }
        } else {
            this.tag = tag;
        }
        this.name = getStringFromJson(xml.name);
        this.info = getStringFromJson(xml.info);

        return true;
    }

    /** Set once for the entire process / class hierarchy. */
    static initEvalContext(ctx: EvalContext) {
        ScvdBase.#_evalContext = ctx;
    }

    /** Static accessor in case you need it from static contexts. */
    static getEvalContext(): EvalContext | undefined{
        return ScvdBase.#_evalContext;
    }

    /** Instance-level convenience that reads the shared static. */
    get evalContext(): EvalContext | undefined {
        return ScvdBase.getEvalContext();
    }

    set evalContext(_ctx: EvalContext) {
        ScvdBase.initEvalContext(_ctx);
    }


    public set tag(value: string | undefined) {
        this._tag = value;
    }
    public get tag(): string | undefined {
        if(this._tag === undefined) {
            return 'Internal Object';
        }

        return this._tag;
    }

    public get lineNo(): string | undefined {
        return this._lineNo;
    }
    public set lineNo(value: string | undefined) {
        if(value !== undefined) {
            this._lineNo = value;
        }
    }


    public get children(): ScvdBase[] {
        return this._children;
    }

    get nodeId(): string {
        return this.constructor.name + '_' + this._nodeId.toString();
    }

    public set valid(value: boolean) {
        this._valid = value;
    }

    public get valid(): boolean {
        return this._valid;
    }

    public invalidate() {
        this._valid = false;
    }

    /**
     * Applies the provided callback function to each child and returns an array of results.
     * @param callbackfn Function that produces an element of the new array, taking a child and its index.
     * @returns Array of mapped results.
     */
    public map<T>(_callbackfn: (child: ScvdBase, index: number, array: ScvdBase[]) => T): T[] {
        return this._children.map(_callbackfn);
    }

    /**
     * Executes a provided function once for each child.
     * @param callbackfn Function to execute for each child.
     */
    public forEach(callbackfn: (child: ScvdBase, index: number, array: ScvdBase[]) => void): void {
        this._children.forEach(callbackfn);
    }

    /**
     * Returns a new array with all children that pass the test implemented by the provided function.
     * @param predicate Function to test each child. Return true to keep the child, false otherwise.
     */
    public filter(predicate: (child: ScvdBase, index: number, array: ScvdBase[]) => boolean): ScvdBase[] {
        return this._children.filter(predicate);
    }

    public hasChildren(): boolean {
        return this._children.length > 0;
    }

    // Member function available to all ScvdItems and derived classes
    public resolveAndLink(_resolveFunc: (name: string, type: resolveType) => ScvdBase | undefined): boolean {
        // Default implementation does nothing, can be overridden by subclasses
        return false;
    }

    public applyInit(): boolean {
        // Default implementation does nothing, can be overridden by subclasses
        return true;
    }

    public funcRunning(): NumberType | undefined {
        // Default implementation returns undefined, can be overridden by subclasses
        return undefined;
    }

    public funcCount(): NumberType | undefined {
        // Default implementation returns undefined, can be overridden by subclasses
        return undefined;
    }

    public funcAddr(): NumberType | undefined {
        // Default implementation returns undefined, can be overridden by subclasses
        return undefined;
    }



    public get parent(): ScvdBase | undefined {
        return this._parent;
    }

    public set name(name: string | undefined) {
        this._name = name;
    }
    public get name(): string | undefined {
        return this._name;
    }

    public set info(text: string | undefined) {
        this._info = text;
    }
    public get info(): string | undefined {
        return this._info;
    }

    public get isModified(): boolean {
        return this._isModified;
    }
    public set isModified(value: boolean) {
        this._isModified = value;
    }

    // Workers
    public configure(): boolean {
        return true;
    }
    public validate(prevResult: boolean): boolean {
        this.valid = prevResult;
        return prevResult;
    }
    public debug(): boolean {
        return true;
    }


    public reset(): boolean {
        return true;
    }

    // expanded values
    public getValue(): string | number | undefined {
        return undefined;
    }

    public setValue(_val: number): number | undefined {
        return undefined;
    }


    private getLineNoInfo(item: ScvdBase | undefined): string | undefined {
        if(item === undefined) {
            return undefined;
        }
        const lineNo = item.lineNo;
        if(lineNo === undefined) {
            return this.getLineNoInfo(item.parent);
        }
        return lineNo;
    }

    public getLineInfoStr(): string {
        let lineInfo = '[';
        const lineNo = this.getLineNoInfo(this);
        if(lineNo !== undefined) {
            lineInfo += `Line: ${lineNo} `;
        }
        if(this.tag !== undefined) {
            lineInfo += `Tag: ${this.tag} `;
        }
        lineInfo += ']';
        return lineInfo;
    }

    public getLineNoStr(): string {
        const lineNo = this.getLineNoInfo(this);
        return lineNo !== undefined ? lineNo : '';
    }

    // ---------- Explorer Info ------------
    public getExplorerInfo(itemInfo: ExplorerInfo[] = []): ExplorerInfo[] {
        const info: ExplorerInfo[] = [];
        if (this.tag) {
            info.push({ name: 'Tag', value: this.tag });
        }
        info.push({ name: 'Line Number', value: this.getLineNoStr() });
        if (this.name) {
            info.push({ name: 'Name', value: this.name });
        }
        if (this.info) {
            info.push({ name: 'Info', value: this.info });
        }
        info.push(...itemInfo);
        return info;
    }

    public getExplorerDisplayName(): string {
        const displayName = this.name ?? this.info ?? '';
        if(displayName.length > 0) {
            return displayName;
        }
        return `Line: ${this.getLineNoStr()}`;
    }

    public getExplorerDescription(): string {
        return `(${this.constructor?.name ?? ''})`;
    }

}
