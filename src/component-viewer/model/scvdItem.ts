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

import { NumberType } from './numberType';
import { ScvdTypedefs } from './scvdTypedef';


export class ScvdItem {
    private _parent: ScvdItem | undefined;
    private _children: ScvdItem[] = [];
    private _isModified: boolean = false;
    private _name: string | undefined;
    private _info: string | undefined;

    constructor(
        parent: ScvdItem | undefined,
        addChild: boolean = false,
    ) {
        if (parent instanceof ScvdItem) {
            this._parent = parent;

            if (addChild) {
                parent.addChild(this);
            }
        }
    }

    /**
     * Applies the provided callback function to each child and returns an array of results.
     * @param callbackfn Function that produces an element of the new array, taking a child and its index.
     * @returns Array of mapped results.
     */
    public map<T>(_callbackfn: (child: ScvdItem, index: number, array: ScvdItem[]) => T): T[] {
        return this._children.map(_callbackfn);
    }

    // Member function available to all ScvdItems and derived classes
    public resolveAndLink(): boolean {
        // Default implementation does nothing, can be overridden by subclasses
        return true;
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



    public get parent(): ScvdItem | undefined {
        return this._parent;
    }
    public get children(): ScvdItem[] {
        return this._children;
    }
    protected addChild(child: ScvdItem) {
        this._children.push(child);
    }


    public set name(name: string) {
        this._name = name;
    }
    public get name(): string | undefined {
        return this._name;
    }

    public set info(text: string) {
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
    public configure(_typedefs: ScvdTypedefs): boolean {
        return true;
    }
    public reset(): boolean {
        return true;
    }
}
