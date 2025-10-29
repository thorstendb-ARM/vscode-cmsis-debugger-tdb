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

// https://arm-software.github.io/CMSIS-View/main/scvd_expression.html


import { parseExpression, ParseResult } from '../parser';
import {  evaluateParseResult, EvaluateResult } from '../evaluator';

import { NumberType } from './numberType';
import { ExplorerInfo, ScvdBase } from './scvdBase';


export class ScvdExpression extends ScvdBase {
    private _expression: string | undefined;
    private _result: NumberType | undefined;
    private _resultText: string | undefined;
    private _scvdVarName: string | undefined;
    private _expressionAst: ParseResult | undefined;
    private _isPrintExpression: boolean = false;

    constructor(
        parent: ScvdBase | undefined,
        expression: string | undefined,
        scvdVarName: string,
        isPrintExpression?: boolean,
    ) {
        super(parent);
        this.expression = expression;
        this.scvdVarName = scvdVarName;
        this.tag = scvdVarName;
        this._isPrintExpression = isPrintExpression ?? false;
    }

    public get expressionAst(): ParseResult | undefined {
        return this._expressionAst;
    }
    public set expressionAst(ast: ParseResult | undefined) {
        this._expressionAst = ast;
    }

    public get isPrintExpression(): boolean {
        return this._isPrintExpression;
    }

    public get expression(): string | undefined {
        return this._expression;
    }
    public set expression(expression: string | undefined) {
        if (expression == undefined) {
            return;
        }

        this._expression = expression;
    }

    public evaluateExpression(): EvaluateResult {
        if(this.expressionAst === undefined || this.evalContext === undefined) {
            return undefined;
        }
        return evaluateParseResult(this.expressionAst, this.evalContext);
    }

    public get result(): NumberType | undefined {
        return this._result;
    }

    public get resultText(): string | undefined {
        return this._resultText;
    }

    public get value(): NumberType | undefined {
        if( this._result === undefined) {
            this.evaluate();
        }
        return this._result;
    }

    public get scvdVarName(): string | undefined {
        return this._scvdVarName;
    }
    public set scvdVarName(value: string | undefined) {
        this._scvdVarName = value;
    }

    public setMinMax(min: number | undefined, max: number | undefined) {
        if (this._result !== undefined) {
            this._result.setMinMax(min, max);
        }
    }

    public getResultBoolean(): boolean {
        return this.value !== undefined && this.value.value > 0;
    }

    public evaluate() {
        if(this.expressionAst !== undefined) {
            if(this.expressionAst.constValue === undefined) {
                const result = this.evaluateExpression();
                if(result !== undefined) {
                    if(typeof result === 'number') {
                        this._result = new NumberType(result);
                    } else {
                        this._resultText = String(result);
                    }
                }
            } else {
                this._result = new NumberType(this.expressionAst.constValue);
            }
        }
    }

    public configure(): boolean {
        const expression = this.expression;
        if (expression === undefined) {
            return false;
        }

        if(this.expressionAst === undefined) {  // if already parsed by dependency, skip parsing
            const expressionAst = parseExpression(expression, this.isPrintExpression);
            if(expressionAst !== undefined && expressionAst.diagnostics.length === 0) {
                this.expressionAst = expressionAst;
            }
        }

        return super.configure();
    }

    public validate(prevResult: boolean): boolean {
        const expression = this.expression;
        if (expression === undefined) {
            console.error(this.getLineInfoStr(), 'Expression is empty.');
            return super.validate(false);
        }

        const expressionAst = this.expressionAst;
        if(expressionAst === undefined) {
            console.error(this.getLineInfoStr(), 'Expression AST is undefined for expression: ', expression);
            return super.validate(false);
        }
        if(expressionAst.diagnostics.length > 0) {
            console.error(this.getLineInfoStr(), 'Expression AST has diagnostics for expression: ', expression, '\nDiagnostics: ', expressionAst.diagnostics);
            return super.validate(false);
        }

        return super.validate(prevResult && true);
    }

    public debug(): boolean {
        this.evaluate();
        console.log(this.getLineInfoStr(), 'Expr:', this.expression, '\nResult:', this.result?.getDisplayText() ?? this._resultText);

        return super.debug();
    }




    public getExplorerInfo(itemInfo: ExplorerInfo[] = []): ExplorerInfo[] {
        const info: ExplorerInfo[] = [];
        if(this.scvdVarName) {
            info.push({ name: 'Var', value: this.scvdVarName });
        }
        if (this.expression) {
            info.push({ name: 'Expression', value: this.expression });
        }
        if(this.result) {
            info.push({ name: 'Result', value: this.result.getDisplayText() });
        }
        if(this.resultText) {
            info.push({ name: 'Result Text', value: this.resultText });
        }
        if (this.value) {
            info.push({ name: 'Value', value: this.value.getDisplayText() });
        }
        info.push(...itemInfo);
        return super.getExplorerInfo(info);
    }

    public getExplorerDisplayName(): string {
        const scvdVarName = this.scvdVarName ?? '';
        const expression = this.expression ?? '';
        const firstIdx = [expression.indexOf('='), expression.indexOf('(')]
            .filter(i => i !== -1)
            .reduce((min, i) => (min === -1 || i < min ? i : min), -1);
        if (firstIdx !== -1) {
            const exprStr = expression.substring(0, firstIdx).trim();
            if (exprStr) {
                return scvdVarName + ': ' + exprStr;
            }
        }
        return scvdVarName + ': ' + expression;
    }

}
