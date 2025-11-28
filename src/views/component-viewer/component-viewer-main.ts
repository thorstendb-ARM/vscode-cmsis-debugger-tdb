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

export class ComponentViewer {
    //private instances: ComponentViewerInstance[] = [];
    private treeDataProvider: SidebarDebugView | undefined;
    private componentViewerTreeDataProvider: ComponentViewerTreeDataProvider | undefined;

    public constructor(
    ) {
    }

    protected async readScvdFiles(): Promise<ComponentViewerInstance[] | undefined> {
        const cbuildRunReader = new CbuildRunReader();
        const scvdFilesPaths: string [] = cbuildRunReader.getScvdFilePaths();
        if (scvdFilesPaths.length === 0) {
            return undefined;
        }
        const instances: ComponentViewerInstance[] = [];
        for (const scvdFilePath of scvdFilesPaths) {
            const instance = new ComponentViewerInstance();
            await instance.readModel(URI.file(scvdFilePath));
            instances.push(instance);
        }
        return instances;
    }

    protected async buildMockInstancesArray(context: vscode.ExtensionContext): Promise<ComponentViewerInstance[]> {
        const instances: ComponentViewerInstance[] = [];
        let counter = 0;
        for (const scvdFile of scvdFiles) {
            const instance = new ComponentViewerInstance();
            await instance.readModel(URI.file(path.join(context.extensionPath, scvdFile)));
            instances.push(instance);
            counter++;
            if (counter >= 3) {
                break;
            }
        }
        return instances;
    }

    protected async createInstance(context: vscode.ExtensionContext) {
        // Try to read SCVD files from cbuild-run file first
        const instancesFromCbuildRun = await this.readScvdFiles();
        // If no SCVD files found in cbuild-run, use mock files
        if (instancesFromCbuildRun) {
            // Add all models from cbuild-run to the tree view
            for (const instance of instancesFromCbuildRun) {
                this.componentViewerTreeDataProvider?.addModel(instance.model);
            }
            return;
        }
        const instances = await this.buildMockInstancesArray(context);
        // Add all mock models to the tree view
        for (const instance of instances) {
            this.componentViewerTreeDataProvider?.addModel(instance.model);
        }
        /* These lines are for Thorsten's debugging purposes */
        const instance = new ComponentViewerInstance();
        await instance.readModel(URI.file(path.join(context.extensionPath, scvdFile1)));
        this.treeDataProvider?.setModel(instance.model);
        /** End of lines for Thorsten's debugging purposes */
    }

    public async activate(context: vscode.ExtensionContext) {
        // debug side view
        this.treeDataProvider = new SidebarDebugView();
        this.componentViewerTreeDataProvider = new ComponentViewerTreeDataProvider();
        const providerDisposable = vscode.window.registerTreeDataProvider('cmsis-scvd-explorer', this.treeDataProvider);
        const treeProviderDisposable = vscode.window.registerTreeDataProvider('cmsis-debugger.componentViewer', this.componentViewerTreeDataProvider);
        await this.createInstance(context);
        await this.componentViewerTreeDataProvider.activate();
        context.subscriptions.push(providerDisposable, treeProviderDisposable);
    }
}
