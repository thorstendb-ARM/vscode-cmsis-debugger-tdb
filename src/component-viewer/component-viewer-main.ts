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
import { parser } from './parser';
import { ScvdComonentViewer } from './model/scvdComonentViewer';
import { Json } from './model/scvdBase';


const scvdFiles: string[] = [
    '/Users/thode01/work/ComponentViewer/Files/BaseExample.scvd',
    '/Users/thode01/work/ComponentViewer/Files/RTX5.scvd',
];

enum scvdExamples {
    BaseExample = 0,
    RTX5 = 1,
}

const scvdFile = scvdFiles[scvdExamples.RTX5];


const xmlOpts: ParserOptions = {
    explicitArray: false,
    mergeAttrs: true,
    explicitRoot: true,
    trim: true
};

export class ComponentViewer {
    protected scvdReader: parser;
    private model: ScvdComonentViewer | undefined;

    public constructor(
    ) {
        this.initScvdReader(URI.file(scvdFile));
        this.scvdReader = new parser();
    }

    protected async initScvdReader(filename: URI) {
        // This is where you would initialize the SCVD reader
        // For example, you might want to read the file and parse it
        console.log(`Initializing SCVD reader with file: ${filename}`);
        const buf = (await this.readFileToBuffer(filename)).toString('utf-8');
        const xml: Json = await this.parseXml(buf);
        this.model = new ScvdComonentViewer(undefined);
        this.model.readXml(xml);


        console.log('Model: ', this.model);
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
            console.log(JSON.stringify(json, null, 2));
            return json;
        } catch (err) {
            console.error('Error parsing XML:', err);
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
    }
}
