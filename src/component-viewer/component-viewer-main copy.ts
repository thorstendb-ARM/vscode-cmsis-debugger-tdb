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
import { ParserOptions, Parser } from 'xml2js';
import { parser } from './parser';
import { ScvdComonentViewer } from './model/scvdComonentViewer';
import { SidebarDebugView } from './sidebarDebugView';


const scvdFiles: string[] = [
    '/Users/thode01/work/ComponentViewer/Files/BaseExample.scvd',
    '/Users/thode01/work/ComponentViewer/Files/RTX5.scvd',
];

enum scvdExamples {
    BaseExample = 0,
    RTX5 = 1,
}

const scvdFile = scvdFiles[scvdExamples.RTX5];

class ParserWithLines extends Parser {
    constructor(opts?: ParserOptions) {
        super(opts);
    }

    async parseStringPromise(xml: string): Promise<unknown> {
        const withLines = this.injectLineNumbers(xml);
        return super.parseStringPromise(withLines);
    }

    private injectLineNumbers(xml: string): string {
        const lines = xml.split(/\r?\n/);
        for (let i = 0; i < lines.length; i++) {
            lines[i] = lines[i].replace(
                /<((?!\/|!|\?)([A-Za-z_][A-Za-z0-9._:-]*))/g,
                `<$1 __line="${i + 1}"`
            );
        }
        return lines.join('\n');
    }
}
const xmlOpts: ParserOptions = {
    explicitArray: false,
    mergeAttrs: true,
    explicitRoot: true,
    trim: true,
    // Add child objects that carry their original tag name via '#name'
    explicitChildren: true,
    preserveChildrenOrder: true
};

export class ComponentViewer {
    protected scvdReader: parser;
    private model: ScvdComonentViewer | undefined;
    private treeDataProvider: SidebarDebugView | undefined;

    public constructor(
    ) {
        this.initScvdReader(URI.file(scvdFile));
        this.scvdReader = new parser();
    }

    protected async initScvdReader(filename: URI) {
        const startTime = Date.now();
        console.log(`Reading SCVD file: ${filename}`);
        const buf = (await this.readFileToBuffer(filename)).toString('utf-8');
        const xml = await this.parseXml(buf);

        const parseTime = Date.now();
        this.model = new ScvdComonentViewer(undefined);
        this.model.readXml(xml);
        const modelTime = Date.now();

        this.model.map( (child, _index) => {
            child.resolveAndLink();
        });
        const resolveAndLinkTime = Date.now();

        console.log(`SCVD file read in ${Date.now() - startTime} ms (parse: ${parseTime - startTime} ms, model: ${modelTime - parseTime} ms, resolveAndLink: ${resolveAndLinkTime - modelTime} ms)`);
        console.log('Model: ', this.model);

        this.treeDataProvider?.setModel(this.model);
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
            //const json = await parseStringPromise(text, xmlOpts);
            const json = await new ParserWithLines(xmlOpts).parseStringPromise(text);
            //console.log(JSON.stringify(json, null, 2));
            return json;
        } catch (err) {
            console.error('Error parsing XML:', err);
            throw err;
        }
    }

    public activate(_ctx: vscode.ExtensionContext) {
        interface CmsisConfig {
            componentViewer?: unknown;
            [key: string]: unknown;
        }
        interface DebugConfiguration {
            name?: string;
            cmsis?: CmsisConfig;
            [key: string]: unknown;
        }

        const config = vscode.workspace.getConfiguration('launch');
        const configurations = config.get<unknown[]>('configurations') || [];

        vscode.debug.registerDebugAdapterTrackerFactory('*', {
            createDebugAdapterTracker(session) {
                console.log('Tracker created for session', session.id);
                return {
                    onWillReceiveMessage(_message) {
                        // messages sent from vscode to debug adapter
                    },
                    onDidSendMessage(message) {
                        if (message.event !== undefined) {
                            console.log('Received message:', message.event, message.body);
                        }

                        if (message.event === 'stopped') {
                            console.log('Debugger paused:', message);
                        }

                        // Wait for the 'initialized' event, which occurs when the debug session is ready and activeDebugSession is available
                        // This does not run! activeDebugSession is not set
                        if (message.event === 'initialized') {
                            console.log('Debug session initialized:', session.id);
                            const activeSession = vscode.debug.activeDebugSession;
                            let componentViewerArgs: unknown = undefined;

                            if (activeSession) {
                                const sessionName = activeSession.name;
                                const sessionConfig = (configurations as DebugConfiguration[]).find(cfg => cfg.name === sessionName);
                                if (sessionConfig && sessionConfig.cmsis && sessionConfig.cmsis.componentViewer) {
                                    componentViewerArgs = sessionConfig.cmsis.componentViewer;
                                    console.log('cmsis:componentViewer arguments:', componentViewerArgs);
                                }
                            }
                        }
                    }
                };
            }
        });

        // debug side view
        this.treeDataProvider = new SidebarDebugView(this.model);
        const providerDisposable = vscode.window.registerTreeDataProvider('cmsis-scvd-explorer', this.treeDataProvider);
        const cmdDisposable = vscode.commands.registerCommand('cmsis-scvd-explorer.refreshEntry', () => this.treeDataProvider?.refresh());
        _ctx.subscriptions.push(providerDisposable, cmdDisposable);
    }
}
