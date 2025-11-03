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

import { resolveType } from '../resolver';
import { ExplorerInfo, ScvdBase } from './scvdBase';
import { ScvdDebugTarget } from './scvdDebugTarget';

export class ScvdSymbol extends ScvdBase {
    private _symbol: string | undefined;
    private _debugTarget: ScvdDebugTarget | undefined;

    constructor(
        parent: ScvdBase | undefined,
        value: string,
    ) {
        super(parent);
        this.symbol = value;
    }

    public get symbol(): string | undefined {
        return this._symbol;
    }
    public set symbol(value: string | undefined) {
        this._symbol = value;
    }

    public get debugTarget(): ScvdDebugTarget | undefined {
        return this._debugTarget;
    }
    public set debugTarget(value: ScvdDebugTarget | undefined) {
        this._debugTarget = value;
    }

    public resolveAndLink(resolveFunc: (name: string, type: resolveType) => ScvdBase | undefined): boolean {
        if(this.symbol === undefined) {
            return false;
        }

        const item = resolveFunc(this.symbol, resolveType.target);
        if(item === undefined ) {
            return false;
        }
        return true;
    }

    public getExplorerInfo(itemInfo: ExplorerInfo[] = []): ExplorerInfo[] {
        const info: ExplorerInfo[] = [];
        if (this._symbol !== undefined) {
            info.push({ name: 'Symbol', value: this._symbol });
        }
        info.push(...itemInfo);
        return super.getExplorerInfo(info);
    }

    public getExplorerDisplayName(): string {
        let name = 'Symbol';
        if (this._symbol !== undefined) {
            name += `: ${this._symbol}`;
        }
        return name;
    }
}
