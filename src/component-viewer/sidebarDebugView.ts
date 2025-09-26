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
import { ScvdComonentViewer } from './model/scvdComonentViewer';
import { ScvdBase } from './model/scvdBase';


export class SidebarDebugView implements vscode.TreeDataProvider<vscode.TreeItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
    private model: ScvdComonentViewer | undefined;

    constructor(model: ScvdComonentViewer | undefined) {
        this.model = model;
    }

    public setModel(model: ScvdComonentViewer | undefined) {
        this.model = model;
        this.refresh();
    }

    refresh() {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
        return element;
    }

    getNoDataInfo(): vscode.ProviderResult<vscode.TreeItem[]> {
        const updatingItem = new vscode.TreeItem('Updating Component Viewer…');
        updatingItem.description = 'Please wait';
        updatingItem.iconPath = new vscode.ThemeIcon('sync');
        updatingItem.contextValue = 'updating';
        return [updatingItem];
    }

    getChildInfo(child: ScvdBase): vscode.TreeItem {
        const label = (child.tag ?? '') + ': ' + (child.name ?? '');
        const node: vscode.TreeItem = new vscode.TreeItem(label);
        node.id = child.nodeId;
        node.description = `(${child.constructor?.name ?? 'UnknownClass'})`;
        node.collapsibleState = (child.hasChildren() ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None);
        node.contextValue = child.info ?? 'no info';
        return node;
    }

    getChildren(element?: vscode.TreeItem): vscode.ProviderResult<vscode.TreeItem[]> {
        if (!this.model) {
            return this.getNoDataInfo();
        }

        if (element === undefined) {
            // Root elements
            const rootNodes: vscode.TreeItem[] = [];
            this.model.map((child, _index) => {
                const node = this.getChildInfo(child);
                if (node) {
                    rootNodes.push(node);
                }
            });
            return rootNodes;
        } else {
            // Child elements
            const parentId = element.id;
            const parentNode = this.findNodeById(this.model, parentId);
            if (parentNode) {
                const childNodes: vscode.TreeItem[] = [];
                parentNode.map((child, _index) => {
                    const node = this.getChildInfo(child);

                    node.collapsibleState = (child.hasChildren() ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None);
                    node.contextValue = 'context';
                    childNodes.push(node);
                });
                return childNodes;
            }
        }

        return [];
    }

    // Recursively search the model tree for a node with the given id.
    private findNodeById(node: ScvdBase, id: string | undefined): ScvdBase | undefined {
        if (!node || !id) {
            return undefined;
        }
        if (node.nodeId === id) {
            return node;
        }
        if (typeof node.map === 'function') {
            let found: ScvdBase | undefined;
            node.map((child: ScvdBase, _index: number) => {
                if (!found) {
                    found = this.findNodeById(child, id);
                }
            });
            return found;
        }
        return undefined;
    }
}
