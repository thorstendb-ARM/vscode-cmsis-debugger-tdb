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

import * as vscode from 'vscode';
import { ScvdComponentViewer } from './model/scvd-comonent-viewer';
import { ScvdGuiInterface } from './model/scvd-gui-interface';
//import { GDBTargetDebugSession, GDBTargetDebugTracker, SessionStackItem } from '../../debug-session';

interface ISCVDFiles {
    scvdModels: ScvdComponentViewer[];
}

export class ComponentViewerTreeDataProvider implements vscode.TreeDataProvider<ScvdGuiInterface> {
    private readonly _onDidChangeTreeData = new vscode.EventEmitter<ScvdGuiInterface | void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
    //private _activeSession: GDBTargetDebugSession | undefined;
    private _objectOutRoots: ScvdGuiInterface[] = [];
    private _scvdModel: ISCVDFiles;

    constructor () {
        this._objectOutRoots = [];
        this._scvdModel = { scvdModels: [] };
    }
    public async activate(): Promise<void> {
    //public async activate(tracker: GDBTargetDebugTracker): Promise<void> {
        /*
        // Subscribe to the debug tracker relevant events 
        const onDidChangeActiveDebugSessionDisposable = tracker.onDidChangeActiveDebugSession(
            async (session) => await this.handleOnDidChangeActiveDebugSession(session)
        );
        const onWillStartSessionDisposable = tracker.onWillStartSession(
            async (session) => await this.handleOnWillStartSession(session)
        );
        const onWillStopSessionDisposable = tracker.onWillStopSession(
            async (session) => await this.handleOnWillStopSession(session)
        );
        const onDidChangeActiveStackItemDisposable = tracker.onDidChangeActiveStackItem(
            async (stackFrame) => await this.handleOnDidChangeActiveStackItem(stackFrame)
        );
        // Extracts out data from objects inside of the scvd model
        if (!this._scvdModel) {
            console.warn('No SCVD model set in ComponentViewerTreeDataProvider');
            return;
        }
            */
        this.addRootObject();
        this.refresh();
    }

    public getTreeItem(element: ScvdGuiInterface): vscode.TreeItem {
       const treeItemLabel = element.getGuiName() ?? 'UNKNOWN';
       const treeItem = new vscode.TreeItem(treeItemLabel);
       treeItem.collapsibleState = element.getGuiChildren()
           ? vscode.TreeItemCollapsibleState.Collapsed
           : vscode.TreeItemCollapsibleState.None;
        // Needs fixing, getGuiValue() for ScvdBase returns 0 when undefined
       treeItem.description = element.getGuiValue() ?? '';
       treeItem.tooltip = element.getGuiLineInfo() ?? '';
        return treeItem;
    }

    public getChildren(element?: ScvdGuiInterface): Promise<ScvdGuiInterface[]> {
        if (!element) {
            return Promise.resolve(this._objectOutRoots);
        }

        return Promise.resolve(element.getGuiChildren() || []);
    }
    /*
    private async handleOnDidChangeActiveDebugSession(session: GDBTargetDebugSession | undefined): Promise<void> {
        // Handle changes to the active debug session if needed
        this.refresh();
    }
    
    private async handleOnWillStartSession(session: GDBTargetDebugSession): Promise<void> {
        // Handle actions before a debug session starts if needed
        this.refresh();
    }

    private async handleOnWillStopSession(session: GDBTargetDebugSession): Promise<void> {
        // Handle actions before a debug session stops if needed
        this.refresh();
    }

    private async handleOnDidChangeActiveStackItem(stackFrame: SessionStackItem): Promise<void> {
        // Handle changes to the active stack frame if needed
        this.refresh();
    }
    */
    private refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    public setModel(scvdModel: ScvdComponentViewer | undefined) {
        if(scvdModel !== undefined) {
            this._scvdModel.scvdModels.push(scvdModel);
        }
    }

    private addRootObject(): void {
        if(this._scvdModel?.scvdModels.length === 0) {
            return;
        }
        this._scvdModel.scvdModels.forEach(model => {
            if(!model.objects?.objects) {
                return;
            }
            for(const objects of model.objects?.objects) {
            this._objectOutRoots.push(...objects.out);
            }
        })
        this.refresh();
    }
}
