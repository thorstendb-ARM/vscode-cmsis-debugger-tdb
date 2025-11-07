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
import { ScvdObjects } from './model/scvd-object';

export interface rootObjectOut {
    id: number;
    name?: string | undefined;
    value?: string | undefined;
    condition?: string | undefined;
    itemsGroup: ItemsGroup;
    listsGroup: ListsGroup;
}

export interface childObjectItem {
    property?: string | undefined;
    value?: string | undefined;
    info?: string | undefined;
    condition?: string | undefined;
    bold?: string | undefined;
    alert?: string | undefined;
}

export interface childObjectList {
    name: string | undefined;
    start: string | undefined;
    limit?: string | undefined;
    while?: string | undefined;
    condition?: string | undefined;
}

export interface ItemsGroup {
    groupName: 'itemsGroup';
    items: childObjectItem[]
}

export interface ListsGroup {
    groupName: 'listsGroup';
    lists: childObjectList[]
}

export class ComponentViewerTreeDataProvider implements vscode.TreeDataProvider<rootObjectOut | childObjectItem | childObjectList | ItemsGroup | ListsGroup> {
private readonly _onDidChangeTreeData = new vscode.EventEmitter<rootObjectOut | ItemsGroup | ListsGroup | void>();
readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
private _objectOutRoots: rootObjectOut[] = [];
//private _activeSession: GDBTargetDebugSession | undefined;
private _nodeID: number;
private _scvdModel: ScvdComponentViewer | undefined;
private _objects: ScvdObjects | undefined;

constructor () {
    this._objectOutRoots = [];
    this._nodeID = 0;
}

public async activate(): Promise<void> {
    // Extracts out data from objects inside of the scvd model
    if (!this._scvdModel) {
        console.warn('No SCVD model set in ComponentViewerTreeDataProvider');
        return;
    }

    this.addRootObject();

    this.refresh(); 

}

public getTreeItem(element: rootObjectOut | childObjectItem | childObjectList | ItemsGroup | ListsGroup): vscode.TreeItem {
    // if element is ItemsGroup, return its tree item
    if ('groupName' in element && element.groupName === 'itemsGroup') {
        const treeItem = new vscode.TreeItem('Items', vscode.TreeItemCollapsibleState.Collapsed);
        return treeItem;
    }

    // if element is ListsGroup, return its tree item
    if ('groupName' in element && element.groupName === 'listsGroup') {
        const treeItem = new vscode.TreeItem('Lists', vscode.TreeItemCollapsibleState.Collapsed);
        return treeItem;
    }

    // if element is rootObjectOut, return its tree item
    if ('id' in element && ('itemsGroup' in element || 'listsGroup' in element)) {
        const rootElement = element as rootObjectOut;
        const treeItem = new vscode.TreeItem(rootElement.name || `Root ${rootElement.id}`, vscode.TreeItemCollapsibleState.Collapsed);
        return treeItem;
    }

    // if element is childObjectItem, return its tree item
    if ('property' in element) {
        // childObjectItem
        const treeItem = new vscode.TreeItem(element.property + ' = ' || 'Item', vscode.TreeItemCollapsibleState.None);
        treeItem.description = element.value as string;
        return treeItem;
    }
    
    // if element is childObjectList, return its tree item
    if ('name' in element && 'start' in element) {
        // childObjectList
        const treeItem = new vscode.TreeItem(element.name ?? 'List', vscode.TreeItemCollapsibleState.None);
        treeItem.description = `start: ${element.start}`;
        return treeItem;
    }
    
    return new vscode.TreeItem('Unknown', vscode.TreeItemCollapsibleState.None);
}

public getChildren(element?: rootObjectOut | childObjectItem | childObjectList | ItemsGroup | ListsGroup): Promise<(rootObjectOut | childObjectItem | childObjectList | ItemsGroup | ListsGroup)[]> {
    if (!element) {
        return Promise.resolve(this._objectOutRoots);
    }
    
    // if element is of the type rootObjectOut, return two group objects; one for items and one for lists
    if ('id' in element) {
        return Promise.resolve([element.itemsGroup, element.listsGroup]);
    }
    
    // if element is ItemsGroup, return its items
    if ('groupName' in element && element.groupName === 'itemsGroup') {
        return Promise.resolve(element.items);
    }
    
    // if element is ListsGroup, return its lists
    if ('groupName' in element && element.groupName === 'listsGroup') {
        return Promise.resolve(element.lists);
    }

    return Promise.resolve([]);
}

private refresh(): void {
    this._onDidChangeTreeData.fire();
}

public setModel(scvdModel: ScvdComponentViewer | undefined) {
        if(scvdModel !== undefined) {
            this._scvdModel = scvdModel;
            this._objects = this._scvdModel.objects;
        }
    }

    
private addRootObject(): void {
    // make sure a model exists
    if(!this._objects?.objects) {
        return;
    }
    // create a root node for each out in the scvd model objects
    for(const objects of this._objects?.objects) {
        for (const singleOut of objects.out) {
            let lists: childObjectList [] = [];
            let items: childObjectItem [] = [];
            const testList = singleOut.list;
            const testItem = singleOut.item;
            console.log('Test List:', testList);
            console.log('Test Item:', testItem);
            for (const list of singleOut.list) {
                const childList: childObjectList = {
                    name: list.name,
                    start: list.start?.expression,
                    limit: list.limit?.expression,
                    while: list.while?.expression,
                    condition: list.cond?.expression
                };
                lists.push(childList);
            }
            for (const item of singleOut.item) {
                const childItem: childObjectItem = {
                    property: item.property?.expression?.expression,
                    value: item.value?.expression?.expression,
                    info: item.info,
                    condition: item.cond?.expression?.expression,
                    bold: item.bold?.expression?.expression,
                    alert: item.alert?.expression?.expression
                };
                items.push(childItem);
            }
            const root: rootObjectOut = {
                id: this._nodeID,
                name: singleOut.name,
                value: singleOut.value?.expression,
                condition: singleOut.cond?.expression?.expression,
                itemsGroup: {
                    groupName: 'itemsGroup',
                    items: items
                },
                listsGroup: {
                    groupName: 'listsGroup',
                    lists: lists
                }
            };
            this._objectOutRoots.push(root);
            this._nodeID++;
        }
    }
    this.refresh();
}

// For a given root node get its lists from the svcd model objects
//private addListToRoot(rootNode: rootObjectOut, object: childObjectList): void {
//}
/*
private addItemToRoot(rootId: number, item: childObjectItem): void {
    const root = this._objectOutRoots.find(r => r.id === rootId);
    if (root) {
        root.itemsGroup.items.push(item);
        this.refresh();
    }
}
*/

}