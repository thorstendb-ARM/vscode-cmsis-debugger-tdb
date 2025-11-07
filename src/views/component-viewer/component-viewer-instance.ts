/*********************************************************************
 * Copyright (c) 2025 Arm Ltd. and others
 *
 * This program and the accompanying materials are made
 * available under the terms of the Eclipse Public License 2.0
 * which is available at https://www.eclipse.org/legal/epl-2.0/
 *
 * SPDX-License-Identifier: EPL-2.0
 *********************************************************************/
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import { parseStringPromise, ParserOptions } from 'xml2js';
import { Json } from './model/scvd-base';
import { Resolver } from './resolver';
import { ScvdComponentViewer } from './model/scvd-comonent-viewer';
import { EvalContext } from './eval-context';
import { StatementEngine } from './statement-engine/statement-engine';



const xmlOpts: ParserOptions = {
    explicitArray: false,
    mergeAttrs: true,
    explicitRoot: true,
    trim: true,
    // Add child objects that carry their original tag name via '#name'
    explicitChildren: true,
    preserveChildrenOrder: true
};

export class ComponentViewerInstance {
    private _model: ScvdComponentViewer | undefined;

    public constructor(
    ) {
    }

    private injectLineNumbers(xml: string): string {
        const lines = xml.split(/\r?\n/);
        const result: string[] = [];
        for (let i = 0; i < lines.length; i++) {
            result.push(lines[i].replace(
                /<((?!\/|!|\?)([A-Za-z_][A-Za-z0-9._:-]*))/g,
                `<$1 __line="${i + 1}"`
            ));
        }
        return result.join('\n');
    }

    public async readModel(filename: URI) {
        const startTime = Date.now();
        console.log(`Reading SCVD file: ${filename}`);
        const buf = (await this.readFileToBuffer(filename)).toString('utf-8');
        const readTime = Date.now();
        const bufLineNo = this.injectLineNumbers(buf);
        const injectTime = Date.now();
        const xml: Json = await this.parseXml(bufLineNo);
        const parseTime = Date.now();

        this.model = new ScvdComponentViewer(undefined);
        if(!this.model) {
            console.error('Failed to create SCVD model');
            return;
        }

        this.model.readXml(xml);
        const modelTime = Date.now();
        this.model.configureAll();
        const modelConfiguredTime = Date.now();
        this.model.validateAll(true);
        const modelValidatedTime = Date.now();

        const resolver = new Resolver(this.model);
        resolver.resolve();
        const resolveAndLinkTime = Date.now();

        const gatherObjects = new EvalContext(this.model);
        gatherObjects.init();
        const modelGatherObjectsTime = Date.now();

        const statementEngine = new StatementEngine(this.model);
        statementEngine.initialize();
        const statementEngineInitializedTime = Date.now();
        statementEngine.executeAll();
        const statementEngineExecuteAllTime = Date.now();

        //this.model.debugAll();
        const modelDebuggedTime = Date.now();

        console.log(`SCVD file read in ${resolveAndLinkTime - startTime} ms:`,
            `\n  read: ${readTime - startTime} ms,`,
            `\n  inject: ${injectTime - readTime} ms,`,
            `\n  parse: ${parseTime - injectTime} ms,`,
            `\n  model: ${modelTime - parseTime} ms,`,
            `\n  configure: ${modelConfiguredTime - modelTime} ms,`,
            `\n  validate: ${modelValidatedTime - modelConfiguredTime} ms,`,
            `\n  gatherObjects: ${modelGatherObjectsTime - modelValidatedTime} ms,`,
            `\n  statementEngineInitialize: ${statementEngineInitializedTime - modelGatherObjectsTime} ms,`,
            `\n  statementEngineExecuteAll: ${statementEngineExecuteAllTime - statementEngineInitializedTime} ms,`,
            `\n  debug: ${modelDebuggedTime - statementEngineExecuteAllTime} ms,`,
            `\n  resolveAndLink: ${resolveAndLinkTime - modelDebuggedTime} ms`);
    }

    private async readFileToBuffer(filePath: URI): Promise<Buffer> {
        try {
            const buffer = await vscode.workspace.fs.readFile(filePath);
            return Buffer.from(buffer);
        } catch (error) {
            console.error('Error reading file:', error);
            throw error;
        }
    }
    private async parseXml(text: string) {
        try {
            const json = await parseStringPromise(text, xmlOpts);
            //console.log(JSON.stringify(json, null, 2));
            return json;
        } catch (err) {
            console.error('Error parsing XML:', err);
        }
    }

    public get model(): ScvdComponentViewer | undefined {
        return this._model;
    }
    private set model(value: ScvdComponentViewer | undefined) {
        this._model = value;
    }
}
