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
import {
    ContinuedEvent,
    GDBTargetDebugTracker,
    SessionStackItem,
    StackTraceRequest,
    StackTraceResponse,
    StoppedEvent
} from './gdbtarget-debug-tracker';
import { debugSessionFactory, extensionContextFactory } from '../__test__/vscode.factory';
import { GDBTargetDebugSession } from './gdbtarget-debug-session';
import { DebugProtocol } from '@vscode/debugprotocol';
import { GDBTargetConfiguration } from '../debug-configuration';
import { waitForMs } from '../utils';
import { debugConfigurationFactory } from '../debug-configuration/debug-configuration.factory';

const TEST_CBUILD_RUN_FILE = 'test-data/multi-core.cbuild-run.yml'; // Relative to repo root

describe('GDBTargetDebugTracker', () => {
    let debugTracker: GDBTargetDebugTracker;
    let contextMock: vscode.ExtensionContext;

    beforeEach(() => {
        debugTracker = new GDBTargetDebugTracker();
        contextMock = extensionContextFactory();
    });

    it('should activate', async () => {
        debugTracker.activate(contextMock);

        expect(contextMock.subscriptions).toHaveLength(3);
        expect(vscode.debug.registerDebugAdapterTrackerFactory as jest.Mock).toHaveBeenCalledWith('gdbtarget', expect.objectContaining({ createDebugAdapterTracker: expect.any(Function) }));
        expect(vscode.debug.onDidChangeActiveDebugSession as jest.Mock).toHaveBeenCalledWith(expect.any(Function));
    });

    it('brings the debug console to front \'onWillStartSession\' is called', async () => {
        debugTracker.bringConsoleToFront();

        expect(vscode.commands.executeCommand as jest.Mock).toHaveBeenCalledWith('workbench.debug.action.focusRepl');
    });

    describe('test forwarding to event emitters', () => {
        let adapterFactory: vscode.DebugAdapterTrackerFactory|undefined;

        beforeEach(() => {
            adapterFactory = undefined;
            (vscode.debug.registerDebugAdapterTrackerFactory as jest.Mock).mockImplementation((_debugType: string, factory: vscode.DebugAdapterTrackerFactory): vscode.Disposable => {
                adapterFactory = factory;
                return { dispose: jest.fn() };
            });
            debugTracker.activate(contextMock);
        });

        it('defines relevant event handlers', async () => {
            expect(adapterFactory).toBeDefined();
            const tracker = await adapterFactory!.createDebugAdapterTracker(debugSessionFactory(debugConfigurationFactory()));
            expect(tracker?.onWillStartSession).toBeDefined();
            expect(tracker?.onWillStopSession).toBeDefined();
            expect(tracker?.onDidSendMessage).toBeDefined();
            expect(tracker?.onWillReceiveMessage).toBeDefined();
        });

        it('forwards start and stop session events', async () => {
            const tracker = await adapterFactory!.createDebugAdapterTracker(debugSessionFactory(debugConfigurationFactory()));
            let startTargetSession: GDBTargetDebugSession|undefined = undefined;
            let stopTargetSession: GDBTargetDebugSession|undefined = undefined;
            debugTracker.onWillStartSession(session => startTargetSession = session);
            debugTracker.onWillStopSession(session => stopTargetSession = session);
            tracker!.onWillStartSession!();
            expect(startTargetSession).toBeDefined();
            tracker!.onWillStopSession!();
            expect(stopTargetSession).toBeDefined();
            expect(stopTargetSession).toEqual(startTargetSession);
        });

        it('sends event on changing active debug session to a valid session', async () => {
            type ActiveStackItemListener = (e: vscode.DebugThread | vscode.DebugStackFrame | undefined) => unknown;
            let stackItemListener: ActiveStackItemListener|undefined = undefined;
            (vscode.debug.onDidChangeActiveStackItem as jest.Mock).mockImplementation(
                ((listener: ActiveStackItemListener): vscode.Disposable => {
                    stackItemListener = listener;
                    return { dispose: jest.fn() };
                })
            );
            let result: SessionStackItem | undefined = undefined;
            debugTracker.onDidChangeActiveStackItem((stackItem: SessionStackItem) => {
                result = stackItem;
            });
            const session = debugSessionFactory(debugConfigurationFactory());
            const tracker = await adapterFactory!.createDebugAdapterTracker(session);
            let gdbSession: GDBTargetDebugSession|undefined = undefined;
            debugTracker.onWillStartSession(session => gdbSession = session);

            // Activate again to reuse beforeEach but get the listener
            debugTracker.activate(contextMock);
            await waitForMs(0);
            expect(stackItemListener).toBeDefined();
            tracker!.onWillStartSession!();
            await waitForMs(0);
            const sentStackItem = { session, frameId: 0, threadId: 0 };
            stackItemListener!(sentStackItem);
            await waitForMs(0);
            expect(result).toBeDefined();
            expect(result!.session).toEqual(gdbSession);
            expect(result!.item).toEqual(sentStackItem);
        });

        it('parses cbuildrun file', async () => {
            const debugConfig: GDBTargetConfiguration = {
                ...debugConfigurationFactory(),
                cmsis: { cbuildRunFile: TEST_CBUILD_RUN_FILE }
            };
            const tracker = await adapterFactory!.createDebugAdapterTracker(debugSessionFactory(debugConfig));
            let gdbSession: GDBTargetDebugSession|undefined = undefined;
            debugTracker.onWillStartSession(session => gdbSession = session);
            tracker!.onWillStartSession!();
            const cbuildRunBeforeAttach = await gdbSession!.getCbuildRun();
            expect(cbuildRunBeforeAttach).toBeUndefined();
            const attachRequest: DebugProtocol.AttachRequest = {
                command: 'attach',
                type: 'request',
                seq: 1,
                arguments: debugConfig as unknown as DebugProtocol.AttachRequestArguments
            };
            tracker!.onWillReceiveMessage!(attachRequest);
            const cbuildRunAfterAttach = await gdbSession!.getCbuildRun();
            expect(cbuildRunAfterAttach).toBeDefined();
        });

        it('sends an onConnected event', async () => {
            let connectedSession: GDBTargetDebugSession|undefined = undefined;
            debugTracker.onConnected(session => connectedSession = session);
            const tracker = await adapterFactory!.createDebugAdapterTracker(debugSessionFactory(debugConfigurationFactory()));
            tracker!.onWillStartSession!();
            const launchRequest: DebugProtocol.LaunchResponse = {
                command: 'launch',
                type: 'response',
                success: true,
                seq: 1,
                request_seq: 1,
                body: {}
            };
            tracker!.onDidSendMessage!(launchRequest);
            expect(connectedSession).toBeDefined();
        });

        it('sends an onStackTraceRequest event', async () => {
            const tracker = await adapterFactory!.createDebugAdapterTracker(debugSessionFactory(debugConfigurationFactory()));
            let gdbSession: GDBTargetDebugSession|undefined = undefined;
            debugTracker.onWillStartSession(session => gdbSession = session);
            let result: StackTraceRequest|undefined = undefined;
            debugTracker.onStackTraceRequest(request => result = request);
            tracker!.onWillStartSession!();
            const stackTraceRequest: DebugProtocol.StackTraceRequest = {
                command: 'stackTrace',
                type: 'request',
                seq: 1,
                arguments: {
                    threadId: 1
                }
            };
            tracker!.onWillReceiveMessage!(stackTraceRequest);
            expect(gdbSession).toBeDefined();
            expect(result).toBeDefined();
            expect(result!.session).toEqual(gdbSession);
            expect(result!.request).toEqual(stackTraceRequest);
        });

        it('sends an onStackTraceResponse event', async () => {
            let gdbSession: GDBTargetDebugSession|undefined = undefined;
            debugTracker.onWillStartSession(session => gdbSession = session);
            let result: StackTraceResponse|undefined = undefined;
            debugTracker.onStackTraceResponse(response => result = response);
            const tracker = await adapterFactory!.createDebugAdapterTracker(debugSessionFactory(debugConfigurationFactory()));
            tracker!.onWillStartSession!();
            const stackTraceResponse: DebugProtocol.StackTraceResponse = {
                command: 'stackTrace',
                type: 'response',
                success: true,
                seq: 1,
                request_seq: 1,
                body: {
                    stackFrames: [
                        {
                            id: 0,
                            column: 0,
                            line: 0,
                            name: 'stackframe'
                        }
                    ]
                }
            };
            tracker!.onDidSendMessage!(stackTraceResponse);
            expect(gdbSession).toBeDefined();
            expect(result).toBeDefined();
            expect(result!.session).toEqual(gdbSession);
            expect(result!.response).toEqual(stackTraceResponse);
        });

        it('sends a session continued event', async () => {
            let gdbSession: GDBTargetDebugSession|undefined = undefined;
            debugTracker.onWillStartSession(session => gdbSession = session);
            let result: ContinuedEvent|undefined = undefined;
            debugTracker.onContinued(event => result = event);
            const tracker = await adapterFactory!.createDebugAdapterTracker(debugSessionFactory(debugConfigurationFactory()));
            tracker!.onWillStartSession!();
            const continuedEvent: DebugProtocol.ContinuedEvent = {
                event: 'continued',
                type: 'event',
                seq: 1,
                body: {
                    threadId: 1
                }
            };
            tracker!.onDidSendMessage!(continuedEvent);
            expect(gdbSession).toBeDefined();
            expect(result).toBeDefined();
            expect(result!.session).toEqual(gdbSession);
            expect(result!.event).toEqual(continuedEvent);
        });

        it('sends a session stopped event', async () => {
            let gdbSession: GDBTargetDebugSession|undefined = undefined;
            debugTracker.onWillStartSession(session => gdbSession = session);
            let result: StoppedEvent|undefined = undefined;
            debugTracker.onStopped(event => result = event);
            const tracker = await adapterFactory!.createDebugAdapterTracker(debugSessionFactory(debugConfigurationFactory()));
            tracker!.onWillStartSession!();
            const stoppedEvent: DebugProtocol.StoppedEvent = {
                event: 'stopped',
                type: 'event',
                seq: 1,
                body: {
                    reason: 'step'
                }
            };
            tracker!.onDidSendMessage!(stoppedEvent);
            expect(gdbSession).toBeDefined();
            expect(result).toBeDefined();
            expect(result!.session).toEqual(gdbSession);
            expect(result!.event).toEqual(stoppedEvent);
        });

    });

});
