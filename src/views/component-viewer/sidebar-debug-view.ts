/*********************************************************************
 * Copyright (c) 2025 Arm Ltd.
 * SPDX-License-Identifier: EPL-2.0
 *********************************************************************/

import * as vscode from 'vscode';
import { ScvdComponentViewer } from './model/scvd-comonent-viewer';
import { ScvdBase } from './model/scvd-base';

export class SidebarDebugView implements vscode.TreeDataProvider<vscode.TreeItem> {
    private readonly _onDidChangeTreeData = new vscode.EventEmitter<void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    constructor(private model?: ScvdComponentViewer) {}

    public setModel(model: ScvdComponentViewer | undefined) {
        if(model !== undefined) {
            this.model = model;
        }
        this.refresh();
    }

    refresh() {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
        return element;
    }

    private noData(): vscode.TreeItem[] {
        const item = new vscode.TreeItem('Updating Component Viewer…');
        item.description = 'Please wait';
        item.iconPath = new vscode.ThemeIcon('sync');
        item.contextValue = 'updating';
        return [item];
    }

    private makeModelNode(node: ScvdBase): vscode.TreeItem {
        const tagString = node.tag ? `${node.tag}: ` : '';
        const dispName = node.getExplorerDisplayName();
        const label = dispName.startsWith(tagString)
            ? dispName
            : `${tagString}${dispName}`;
        const ti = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.Collapsed);
        ti.id = node.nodeId;
        ti.description = node.getExplorerDescription() ?? 'Unknown';
        ti.contextValue = 'model-node';
        return ti;
    }

    private makeDetailItem(label: string, value: string, icon: string = 'symbol-field'): vscode.TreeItem {
        const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.None);
        item.description = (value === undefined || value === null || value === '') ? '—' : String(value);
        item.iconPath = new vscode.ThemeIcon(icon);
        item.contextValue = 'detail-leaf';
        return item;
    }

    private buildDetailChildren(target: ScvdBase): vscode.TreeItem[] {
        const out: vscode.TreeItem[] = [];

        const explorerInfo = target.getExplorerInfo();
        if (explorerInfo.length === 0) {
            out.push(this.makeDetailItem('info', 'No details'));
            return out;
        }

        explorerInfo.forEach( info => {
            out.push(this.makeDetailItem(info.name, info.value, info.icon));
        });

        return out;
    }

    private makeInfoNode(target: ScvdBase): vscode.TreeItem {
        const info = new vscode.TreeItem('Details', vscode.TreeItemCollapsibleState.Collapsed);
        info.id = `${target.nodeId}:info`;
        info.description = '';
        info.tooltip = 'Details for this node';
        info.iconPath = new vscode.ThemeIcon('info');
        info.contextValue = 'info-node';
        return info;
    }

    public getChildren = (element?: vscode.TreeItem): vscode.ProviderResult<vscode.TreeItem[]> => {
        if (!this.model) return this.noData();

        // Root
        if (!element) {
            const roots: vscode.TreeItem[] = [];
            this.model.map(n => roots.push(this.makeModelNode(n)));
            return roots;
        }

        // Info node expansion
        if (element.id?.endsWith(':info')) {
            const baseId = element.id.slice(0, -5);
            const base = this.findNodeById(this.model, baseId);
            return base ? this.buildDetailChildren(base) : [];
        }

        // Normal model node expansion
        const modelNode = this.findNodeById(this.model, element.id);
        if (!modelNode) return [];

        const children: vscode.TreeItem[] = [this.makeInfoNode(modelNode)];
        modelNode.map(child => children.push(this.makeModelNode(child)));
        return children;
    };

    private findNodeById(node: ScvdBase, id: string | undefined): ScvdBase | undefined {
        if (!node || !id) return undefined;
        if (node.nodeId === id) return node;
        if (typeof node.map === 'function') {
            let found: ScvdBase | undefined;
            node.map(child => { if (!found) found = this.findNodeById(child, id); });
            return found;
        }
        return undefined;
    }
}
