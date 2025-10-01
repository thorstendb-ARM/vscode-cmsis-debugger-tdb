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
import { debugSessionFactory, extensionContextFactory } from '../../__test__/vscode.factory';
import { CpuStates } from './cpu-states';
import { CpuStatesStatusBarItem, QuickPickHandlerItem } from './cpu-states-statusbar-item';
import { GDBTargetDebugSession, GDBTargetDebugTracker } from '../../debug-session';
import { waitForMs } from '../../utils';
import { gdbTargetConfiguration } from '../../debug-configuration/debug-configuration.factory';

describe('CpuStatesStatusBarItem', () => {
    let context: vscode.ExtensionContext;
    let cpuStates: CpuStates;
    let statusBarItem: vscode.StatusBarItem|undefined;
    let registeredCommands: Map<string, () => Promise<void>>;
    let cpuStatesStatusBarItem: CpuStatesStatusBarItem;

    beforeEach(() => {
        context = extensionContextFactory();
        cpuStates = new CpuStates();
        statusBarItem = undefined;
        registeredCommands = new Map();
        (vscode.commands.registerCommand as jest.Mock).mockImplementation(async (command: string, handler: () => Promise<void>) => {
            registeredCommands.set(command, handler);
        });
        (vscode.commands.executeCommand as jest.Mock).mockImplementation(async (command: string) => {
            const handler = registeredCommands.get(command);
            if (handler) {
                await handler();
            }
        });
        (vscode.window.createStatusBarItem as jest.Mock).mockImplementation((id: string, alignment?: vscode.StatusBarAlignment) => {
            statusBarItem = {
                id,
                alignment: alignment ?? vscode.StatusBarAlignment.Left,
                name: undefined,
                text: '',
                tooltip: undefined,
                command: undefined,
                show: jest.fn(),
                hide: jest.fn(),
            } as unknown as vscode.StatusBarItem;
            return statusBarItem;
        });
        cpuStatesStatusBarItem = new CpuStatesStatusBarItem();
    });

    it('creates status bar item with defaults and registers cpuStatesItemCommand on activation', () => {
        cpuStatesStatusBarItem.activate(context, cpuStates);
        expect(vscode.window.createStatusBarItem as jest.Mock).toHaveBeenCalledWith('vscode-cmsis-debugger.cpuStatesItem', vscode.StatusBarAlignment.Left);
        expect(vscode.commands.registerCommand as jest.Mock).toHaveBeenCalledWith('vscode-cmsis-debugger.cpuStatesItemCommand', expect.any(Function));
        expect(statusBarItem).toBeDefined();
        expect(statusBarItem?.id).toEqual('vscode-cmsis-debugger.cpuStatesItem');
        expect(statusBarItem?.name).toEqual('CPU States');
    });

    it('updates the status bar item and hides it without active session', async () => {
        cpuStatesStatusBarItem.activate(context, cpuStates);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (cpuStates as any)['_onRefresh'].fire(0);
        // Let events get processed
        await waitForMs(0);
        expect(statusBarItem?.show as jest.Mock).not.toHaveBeenCalled();
        expect(statusBarItem?.hide as jest.Mock).toHaveBeenCalled();
        expect(statusBarItem?.text).toEqual('');
        expect(statusBarItem?.command).toBeUndefined();
    });

    it('updates the status bar item and shows it with active session', async () => {
        const tracker = new GDBTargetDebugTracker();
        cpuStates.activate(tracker);
        cpuStatesStatusBarItem.activate(context, cpuStates);
        const debugSession = debugSessionFactory(gdbTargetConfiguration({ cmsis: {} }));
        (debugSession.customRequest as jest.Mock).mockResolvedValueOnce({
            address: '0xE0001000',
            data:  new Uint8Array([ 0x01, 0x00, 0x00, 0x00 ]).buffer
        });
        const gdbtargetDebugSession = new GDBTargetDebugSession(debugSession);
        // Add session
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (tracker as any)._onWillStartSession.fire(gdbtargetDebugSession);
        await waitForMs(0);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (tracker as any)._onDidChangeActiveDebugSession.fire(gdbtargetDebugSession);
        // Connected
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (tracker as any)._onConnected.fire(gdbtargetDebugSession);
        await waitForMs(0);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (cpuStates as any)['_onRefresh'].fire(0);
        // Let events get processed
        await waitForMs(0);
        // Can't test for show/hide. Using setTimeout in implementation to delay refresh
        // makes behavior a little less predictable for tests.
        expect(statusBarItem?.text).toEqual('$(watch) 0 states');
        expect(statusBarItem?.command).toBeDefined();
    });

    it.each([
        { commandLabel: 'CPU Time', handlerCommand: 'vscode-cmsis-debugger.showCpuTimeHistory' },
        { commandLabel: 'Reset CPU Time', handlerCommand: 'vscode-cmsis-debugger.resetCpuTimeHistory' },
        { commandLabel: undefined, handlerCommand: undefined },
    ])('opens quickpick and handles selection ($commandLabel)', async ({ commandLabel, handlerCommand }) => {
        let registeredCallbackName: string | undefined = undefined;
        let registeredCallback: (() => Promise<void>) | undefined = undefined;
        (vscode.commands.registerCommand as jest.Mock).mockImplementationOnce(async (command, callback) => {
            registeredCallbackName = command;
            registeredCallback = callback;
        });
        (vscode.window.showQuickPick as jest.Mock).mockImplementationOnce((items: QuickPickHandlerItem[] ) => {
            const returnValue = items.find(item => item.label === commandLabel);
            return returnValue;
        });

        cpuStatesStatusBarItem.activate(context, cpuStates);
        expect(registeredCallbackName).toEqual('vscode-cmsis-debugger.cpuStatesItemCommand');
        expect(registeredCallback).toBeDefined();

        await registeredCallback!();
        if (handlerCommand) {
            expect(vscode.commands.executeCommand as jest.Mock).toHaveBeenCalledWith(handlerCommand);
        } else {
            expect(vscode.commands.executeCommand as jest.Mock).not.toHaveBeenCalled();
        }

    });

});
