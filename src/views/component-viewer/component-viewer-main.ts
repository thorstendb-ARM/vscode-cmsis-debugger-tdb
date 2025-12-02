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
// Erase later, for Thorsten's debugging purposes
import { SidebarDebugView } from './sidebar-debug-view';
// End of erase later
import { ComponentViewerTreeDataProvider } from './component-viewer-tree-view';
import { GDBTargetDebugTracker, GDBTargetDebugSession, SessionStackItem} from '../../debug-session';
import { CbuildRunReader } from '../../cbuild-run';


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
 // cherry pick 3 files for testing
const scvdFile2 = scvdFiles.filter((_, index) => 
    index === scvdExamples.BaseExample ||
    index === scvdExamples.RTX5 ||
    index === scvdExamples.GetRegVal_Test
);

export class ComponentViewer {
    //private instances: ComponentViewerInstance[] = [];
    private treeDataProvider: SidebarDebugView | undefined;
    private componentViewerTreeDataProvider: ComponentViewerTreeDataProvider | undefined;
    private activeSession: GDBTargetDebugSession | undefined;
    private instances: ComponentViewerInstance[] = [];

    public constructor(
    ) {
    }

    protected async readScvdFiles(): Promise<void> {
        const cbuildRunReader = new CbuildRunReader();
        const scvdFilesPaths: string [] = cbuildRunReader.getScvdFilePaths();
        if (scvdFilesPaths.length === 0) {
            return undefined;
        }
        const cbuildRunInstances: ComponentViewerInstance[] = [];
        for (const scvdFilePath of scvdFilesPaths) {
            const instance = new ComponentViewerInstance();
            await instance.readModel(URI.file(scvdFilePath));
            cbuildRunInstances.push(instance);
        }
        this.instances = cbuildRunInstances;
    }

    protected async buildMockInstancesArray(context: vscode.ExtensionContext): Promise<void> {
        const mockedInstances: ComponentViewerInstance[] = [];
        for (const scvdFile of scvdFile2) {
            const instance = new ComponentViewerInstance();
            await instance.readModel(URI.file(path.join(context.extensionPath, scvdFile)));
            mockedInstances.push(instance);
        }
        this.instances = mockedInstances;
    }

    protected async createInstance(context: vscode.ExtensionContext) {
        // Try to read SCVD files from cbuild-run file first
        await this.readScvdFiles();
        // If no SCVD files found in cbuild-run, use mock files
        if (this.instances.length > 0) {
            // Add all models from cbuild-run to the tree view
            for (const instance of this.instances) {
                this.componentViewerTreeDataProvider?.addModel(instance.model);
            }
            return;
        }
        await this.buildMockInstancesArray(context);
        // Add all mock models to the tree view
        for (const instance of this.instances) {
            this.componentViewerTreeDataProvider?.addModel(instance.model);
        }
        /* These lines are for Thorsten's debugging purposes */
        const instance = new ComponentViewerInstance();
        await instance.readModel(URI.file(path.join(context.extensionPath, scvdFile1)));
        this.treeDataProvider?.setModel(instance.model);
        /** End of lines for Thorsten's debugging purposes */
    }

    public async activate(context: vscode.ExtensionContext, tracker: GDBTargetDebugTracker): Promise<void> {
        // Shall be removed later, only for Thorsten's debugging purposes
        this.treeDataProvider = new SidebarDebugView();
        const providerDisposable = vscode.window.registerTreeDataProvider('cmsis-scvd-explorer', this.treeDataProvider);
        // End of shall be removed later
        this.componentViewerTreeDataProvider = new ComponentViewerTreeDataProvider();
        const treeProviderDisposable = vscode.window.registerTreeDataProvider('cmsis-debugger.componentViewer', this.componentViewerTreeDataProvider);
        await this.createInstance(context);
        // Subscribe to debug tracker events to update active session
        this.subscribetoDebugTrackerEvents(context, tracker);
        
        await this.componentViewerTreeDataProvider.activate();
        context.subscriptions.push(
            providerDisposable, // Shall be removed later
            treeProviderDisposable);
    }

    private subscribetoDebugTrackerEvents(context: vscode.ExtensionContext, tracker: GDBTargetDebugTracker): void {
        const onWillStopSessionDisposable = tracker.onWillStopSession(async (session) => {
            await this.handleOnWillStopSession(session);
        });
        const onWillStartSessionDisposable = tracker.onWillStartSession(async (session) => {
            await this.handleOnWillStartSession(session);
        });
        const onDidChangeActiveStackItemDisposable = tracker.onDidChangeActiveStackItem(async (stackTraceItem) => {
            await this.handleOnDidChangeActiveStackItem(stackTraceItem);
        });
        const onDidChangeActiveDebugSessionDisposable = tracker.onDidChangeActiveDebugSession(async (session) => {
            await this.handleOnDidChangeActiveDebugSession(session);
        });
        // clear all disposables on extension deactivation
        context.subscriptions.push(
            onWillStopSessionDisposable,
            onWillStartSessionDisposable,
            onDidChangeActiveStackItemDisposable,
            onDidChangeActiveDebugSessionDisposable
        );
    }

    private async handleOnWillStopSession(session: GDBTargetDebugSession): Promise<void> {
        // Clear active session if it is the one being stopped
        if (this.activeSession?.session.id === session.session.id) {
            this.activeSession = undefined;
        }
        // Update component viewer instance(s)
        this.updateInstances();
    }
    
    private async handleOnWillStartSession(session: GDBTargetDebugSession): Promise<void> {
        session.refreshTimer.onRefresh(async (refreshSession) => {
            if (this.activeSession?.session.id === refreshSession.session.id) {
                // Update component viewer instance(s)
                this.updateInstances();
            }
        });
    }
    
    private async handleOnDidChangeActiveStackItem(stackTraceItem: SessionStackItem): Promise<void> {
        if ((stackTraceItem.item as vscode.DebugStackFrame).frameId !== undefined) {
            // Update instance(s) with new stack frame info
            this.updateInstances();
        }
    }
    
    private async handleOnDidChangeActiveDebugSession(session: GDBTargetDebugSession | undefined): Promise<void> {
        // Update debug session
        this.activeSession = session;
        // Update component viewer instance(s)
        this.updateInstances();
    }

    private async updateInstances(): Promise<void> {
        if (!this.activeSession) {
            return;
        }
        for (const instance of this.instances) {
            instance.updateModel(this.activeSession);
        }
    }
}
