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
    itemsGroup?: childObjectItem[];
    listsGroup?: childObjectList[];
    //itemsGroup: ItemsGroup;
    //listsGroup: ListsGroup;
}

export interface childObjectItem {
    property: string | undefined;
    value: string | undefined;
    info?: string | undefined;
    condition?: string | undefined;
    bold?: string | undefined;
    alert?: string | undefined;
    children?: childObjectItem[] | undefined;
    parent: rootObjectOut | childObjectItem;
}

export interface childObjectList {
    name: string | undefined;
    start: string | undefined;
    limit?: string | undefined;
    while?: string | undefined;
    condition?: string | undefined;
}

/*
export interface ItemsGroup {
    groupName: 'itemsGroup';
    items: childObjectItem[]
}

export interface ListsGroup {
    groupName: 'listsGroup';
    lists: childObjectList[]
}
*/

export class ComponentViewerTreeDataProvider implements vscode.TreeDataProvider<rootObjectOut | childObjectItem | childObjectList> {
    private readonly _onDidChangeTreeData = new vscode.EventEmitter<rootObjectOut |void>();
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

    public getTreeItem(element: rootObjectOut | childObjectItem | childObjectList): vscode.TreeItem {
        // if element is rootObjectOut, return its corresponding tree item
        if ('id' in element && element.name !== undefined) {
            const treeItem = new vscode.TreeItem(element.name, vscode.TreeItemCollapsibleState.Collapsed);
            return treeItem;
        }

        // if element is childObjectItem, return its corresponding tree item
        if ('property' in element) {
            const treeItem = new vscode.TreeItem(element.property + ' = ' || 'Item');
            treeItem.collapsibleState = element.children && element.children.length > 0
                ? vscode.TreeItemCollapsibleState.Collapsed
                : vscode.TreeItemCollapsibleState.None;
            treeItem.description = element.value as string;
            return treeItem;
        }

        // if element is childObjectList, return its corresponding tree item
        if ('name' in element) {
            const treeItem = new vscode.TreeItem(element.name ?? 'List', vscode.TreeItemCollapsibleState.None);
            return treeItem;
        }

        return new vscode.TreeItem('Unknown', vscode.TreeItemCollapsibleState.None);
    }

    public getChildren(element?: rootObjectOut | childObjectItem | childObjectList): Promise<(rootObjectOut | childObjectItem | childObjectList)[]> {
        if (!element) {
            return Promise.resolve(this._objectOutRoots);
        }

        // if element is of the type rootObjectOut, return both itemsGroup and listsGroup children
        if ('id' in element && (element.itemsGroup || element.listsGroup)) {
            return Promise.resolve([element.itemsGroup, element.listsGroup].flat().filter(Boolean) as (childObjectItem | childObjectList)[]);
        }

        // trying to retrieve children of children
        /*
        if ('property' in element) {
            // Get children from model
            const children = this.
            // Populate children array to be returned
            //const children : childObjectItem [] = element.children?.map( child => {
            //    const 
            //})
            return Promise.resolve(element.children);
        }
        */
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
        if(!this._objects?.objects) {
            return;
        }
        for(const objects of this._objects?.objects) {
            for (const singleOutObject of objects.out) {
                const root: rootObjectOut = {
                    id: this._nodeID,
                    name: singleOutObject.name,
                    value: singleOutObject.value?.expression,
                    condition: singleOutObject.cond?.expression?.expression,
                };
                this._objectOutRoots.push(root);
                this._nodeID++;
            }
        }
        this.refresh();
    }
    /*
    private addRootObject(): void {
    // make sure a model exists
        if(!this._objects?.objects) {
            return;
        }
        // create a root node for each out in the scvd model objects
        for(const objects of this._objects?.objects) {
            for (const singleOut of objects.out) {
                const lists: childObjectList [] = [];
                const items: childObjectItem [] = [];
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
                    const propertyValuePair = item.getDisplayEntry();
                    const childItem: childObjectItem = {
                        property: propertyValuePair.name,
                        value: propertyValuePair.value,
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
    */
}
