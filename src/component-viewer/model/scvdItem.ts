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


export class ScvdItem {
    private _parent: ScvdItem | undefined;
    private _children: ScvdItem[] = [];

    private _name: string | undefined;
    private _info: string | undefined;

    constructor(
        parent: ScvdItem | undefined,
    ) {
        if (parent instanceof ScvdItem) {
            this._parent = parent;
            parent.addChild(this);
        }
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
}
