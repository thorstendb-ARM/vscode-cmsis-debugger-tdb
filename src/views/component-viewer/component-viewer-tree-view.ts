/*
 * Component Viewer Tree (ordered exactly as provided by getGuiChildren())
 * - Root = model.objects?.objects?.[0]?.out?.[0]
 * - Label/description from node.getGuiEntry() -> { name, value }
 * - Children from node.getGuiChildren() (returned AS-IS, in order)
 * - Each item id = node.nodeId (no fallbacks)
 * - Activation via `await provider.activate()`; no constructor args
 * - View ID defaults to 'cmsis-debugger.componentViewer'
 */

import * as vscode from 'vscode';
import { ScvdGuiInterface } from './model/scvd-gui-interface';

export class ComponentViewerTreeDataProvider implements vscode.TreeDataProvider<vscode.TreeItem>, vscode.Disposable {
    private readonly _onDidChangeTreeData = new vscode.EventEmitter<void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    private _model: any;
    private _root: ScvdGuiInterface | undefined;
    private _view?: vscode.TreeView<vscode.TreeItem>;
    private _disposed = false;
    private static readonly VIEW_ID = 'cmsis-debugger.componentViewer';

    constructor() {}

    async activate(viewIdOverride?: string): Promise<void> {
        if (this._view) return; // already active
        const viewId = viewIdOverride ?? ComponentViewerTreeDataProvider.VIEW_ID;
        this._view = vscode.window.createTreeView<vscode.TreeItem>(viewId, { treeDataProvider: this });
    }

    /** Provide/replace the model, recompute root, and refresh. */
    public setModel(model: any): void {
        this._model = model;
        this._root = this.computeRoot();
        this.refresh();
    }

    refresh(): void { this._onDidChangeTreeData.fire(); }

    private computeRoot(): ScvdGuiInterface | undefined {
    // Root child for addRootObject(): const outItem = this.model.objects?.objects?.[0]?.out[0];
        const outItem: ScvdGuiInterface | undefined = this._model?.objects?.objects?.[0]?.out?.[0];
        return outItem;
    }

    // --- TreeDataProvider<vscode.TreeItem> API ---
    getTreeItem(element: vscode.TreeItem): vscode.TreeItem { return element; }

    getChildren(element?: vscode.TreeItem): vscode.ProviderResult<vscode.TreeItem[]> {
        if (!this._root) {
            return this.noData();
        }

        // Root expansion
        if (!element) {
            return [this.makeNodeItem(this._root)];
        }

        // Otherwise, element.id corresponds to a ScvdGuiInterface.nodeId. Find that node and enumerate its children in order.
        const nodeId = element.id as string | undefined;
        const base = nodeId ? this.findNodeById(this._root, nodeId) : undefined;
        if (!base) return [];

        const kids = base.getGuiChildren?.() ?? [];
        // Reference view uses model.map(...) which yields the natural order.
        // getGuiChildren() appears to return the inverse; render reversed to match the reference's visible order.
        const ordered = [...kids]; //.reverse();
        const out: vscode.TreeItem[] = [];
        for (const child of ordered) {
            out.push(this.makeNodeItem(child));
        }
        return out;
    }

    // --- Helpers ---
    private noData(): vscode.TreeItem[] {
        const item = new vscode.TreeItem('Updating Component Viewer…');
        item.description = 'Please wait';
        item.iconPath = new vscode.ThemeIcon('sync');
        item.contextValue = 'updating';
        return [item];
    }

    private makeNodeItem(node: ScvdGuiInterface): vscode.TreeItem {
        const entry = node.getGuiEntry?.() ?? ({} as any);
        const label: string = entry?.name ?? '(unnamed)';
        const value: string | undefined = entry?.value;

        // Collapsible if there could be children (we do not call getGuiChildren() here to avoid double-enumeration during label rendering)
        const collapsible = typeof node.getGuiChildren === 'function' ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None;
        const ti = new vscode.TreeItem(label, collapsible);

        // id strictly from node.nodeId; no fallbacks to avoid collisions or reordering side-effects
        if ((node as any).nodeId !== undefined && (node as any).nodeId !== null) {
            ti.id = String((node as any).nodeId);
        }

        // Value formatting: " = <value>"
        ti.description = value ? ' = ' + value : '';
        ti.tooltip = value ? `${label}: ${value}` : label;
        ti.contextValue = 'model-node';
        return ti;
    }

    private findNodeById(node: ScvdGuiInterface | undefined, id: string): ScvdGuiInterface | undefined {
        if (!node) return undefined;
        if ((node as any).nodeId === id) return node;
        const kids = node.getGuiChildren?.();
        if (!kids || kids.length === 0) return undefined;
        for (const k of kids) {
            const found = this.findNodeById(k, id);
            if (found) return found;
        }
        return undefined;
    }

    dispose(): void {
        if (this._disposed) return;
        this._disposed = true;
        this._view?.dispose();
        this._onDidChangeTreeData.dispose();
    }
}
