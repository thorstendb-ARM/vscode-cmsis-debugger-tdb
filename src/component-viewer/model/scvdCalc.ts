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

// https://arm-software.github.io/CMSIS-View/main/elem_calc.html

import { ScvdExpression } from './scvdExpression';
import { ExplorerInfo, Json, ScvdBase } from './scvdBase';
import { ScvdCondition } from './scvdCondition';
import { getStringFromJson, getTextBodyFromJson } from './scvdUtils';

export class ScvdCalc extends ScvdBase {
    private _cond: ScvdCondition | undefined;
    private _expression: ScvdExpression[] = [];

    constructor(
        parent: ScvdBase | undefined,
    ) {
        super(parent);
    }

    public readXml(xml: Json): boolean {
        if (xml === undefined ) {
            return super.readXml(xml);
        }

        this.cond = getStringFromJson(xml.cond);

        const expressions = getTextBodyFromJson(xml);
        expressions?.forEach((v: string) => {
            const expr = this.addExpression(v);
            expr?.readXml(xml);
        });

        return super.readXml(xml);
    }

    get cond(): ScvdCondition | undefined {
        return this._cond;
    }

    set cond(value: string | undefined) {
        if (value !== undefined) {
            this._cond = new ScvdCondition(this, value);
        }
    }

    get expression(): ScvdExpression[] {
        return this._expression;
    }

    private addExpression(value: string | undefined): ScvdExpression | undefined {
        if (value !== undefined) {
            const expr = new ScvdExpression(this, value);
            this._expression.push(expr);
            return expr;
        }
        return undefined;
    }

    public getExplorerInfo(itemInfo: ExplorerInfo[] = []): ExplorerInfo[] {
        const info: ExplorerInfo[] = [];
        info.push(...itemInfo);
        return super.getExplorerInfo(info);
    }
}
