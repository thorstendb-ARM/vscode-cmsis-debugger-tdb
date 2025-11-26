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
import path from 'path';
import { ComponentViewerInstance } from './component-viewer-instance';
import { SidebarDebugView } from './sidebar-debug-view';
import { ComponentViewerTreeDataProvider } from './component-viewer-tree-view';


const scvdFiles: string[] = [
    'test-data/BaseExample.scvd',
    'test-data/RTX5.scvd',
    'test-data/Network.scvd',
    'test-data/USB.scvd',
    'test-data/FileSystem.scvd',
    'test-data/EventRecorder.scvd',
    'test-data/GetRegVal_Test.scvd',
    'test-data/MyTest.scvd',
];

enum scvdExamples {
    BaseExample = 0,
    RTX5 = 1,
    Network = 2,
    USB = 3,
    FileSystem = 4,
    EventRecorder = 5,
    GetRegVal_Test = 6,
    MyTest = 7,
}

const scvdFile1 = scvdFiles[scvdExamples.RTX5];

export class ComponentViewer {
    private instance: ComponentViewerInstance | undefined;
    private instance_0: ComponentViewerInstance | undefined;
    private treeDataProvider: SidebarDebugView | undefined;
    private componentViewerTreeDataProvider: ComponentViewerTreeDataProvider | undefined;

    public constructor(
    ) {
    }

    protected async createInstance(_ctx: vscode.ExtensionContext, filename: URI) {
        const startTime = Date.now();
        this.instance = new ComponentViewerInstance();
        this.instance_0 = new ComponentViewerInstance();
        await this.instance.readModel(filename);
        await this.instance_0.readModel(URI.file(path.join(_ctx.extensionPath, scvdFiles[scvdExamples.GetRegVal_Test])));
        this.componentViewerTreeDataProvider?.setModel(this.instance.model);
        this.componentViewerTreeDataProvider?.setModel(this.instance_0.model);
        this.treeDataProvider?.setModel(this.instance.model);
        const endTime = Date.now();
        console.log(`SCVD instance created in ${endTime - startTime} ms for file: ${filename}`);
    }

    public async activate(_ctx: vscode.ExtensionContext) {
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
        this.treeDataProvider = new SidebarDebugView();
        this.componentViewerTreeDataProvider = new ComponentViewerTreeDataProvider();
        const providerDisposable = vscode.window.registerTreeDataProvider('cmsis-scvd-explorer', this.treeDataProvider);
        const cmdDisposable = vscode.commands.registerCommand('cmsis-scvd-explorer.refreshEntry', () => this.treeDataProvider?.refresh());
        const treeProviderDisposable = vscode.window.registerTreeDataProvider('cmsis-debugger.componentViewer', this.componentViewerTreeDataProvider);
        await this.createInstance(_ctx, URI.file(path.join(_ctx.extensionPath, scvdFile1)));
        await this.componentViewerTreeDataProvider.activate();
        _ctx.subscriptions.push(providerDisposable, cmdDisposable, treeProviderDisposable);
    }
}
