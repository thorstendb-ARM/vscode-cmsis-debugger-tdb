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
} from '../../debug-session';
import { GDBTargetDebugSession } from '../../debug-session/gdbtarget-debug-session';
import { CpuStatesHistory } from './cpu-states-history';
import { calculateTime, extractPname } from '../../utils';
import { GDBTargetConfiguration } from '../../debug-configuration';
import { DebugProtocol } from '@vscode/debugprotocol';

// Architecturally defined registers (M-profile)
const DWT_CTRL_ADDRESS = 0xE0001000;
const DWT_CYCCNT_ADDRESS = 0xE0001004;

const DWT_CTRL_NOCYCCNT = 0x02000000; // Only for v7-M and v8-M
const DWT_CTRL_CYCCNTENA = 0x00000001;

interface SessionCpuStates {
    states: bigint;
    frequency: number|undefined;
    lastCycles?: number;
    statesHistory: CpuStatesHistory;
    isRunning: boolean;
    hasStates: boolean|undefined;
}

export class CpuStates {
    private readonly _onRefresh: vscode.EventEmitter<number> = new vscode.EventEmitter<number>();
    public readonly onRefresh: vscode.Event<number> = this._onRefresh.event;

    public activeSession: GDBTargetDebugSession | undefined;
    private sessionCpuStates: Map<string, SessionCpuStates> = new Map();
    private stackTraceRequests: Map<string, Map<number, number>> = new Map();

    public get activeCpuStates(): SessionCpuStates|undefined {
        if (!this.activeSession) {
            return undefined;
        }
        return this.sessionCpuStates.get(this.activeSession?.session.id);
    }

    public activate(tracker: GDBTargetDebugTracker): void {
        tracker.onWillStartSession(session => this.handleOnWillStartSession(session));
        tracker.onWillStopSession(session => this.handleOnWillStopSession(session));
        tracker.onDidChangeActiveDebugSession(session => this.handleActiveSessionChanged(session));
        tracker.onDidChangeActiveStackItem(item => this.handleOnDidChangeActiveStackItem(item));
        tracker.onConnected(session => this.handleConnected(session));
        tracker.onContinued(event => this.handleContinuedEvent(event));
        tracker.onStopped(event => this.handleStoppedEvent(event));
        tracker.onStackTraceRequest(request => this.handleStackTraceRequest(request));
        tracker.onStackTraceResponse(response => this.handleStackTraceResponse(response));
    }

    protected handleOnWillStartSession(session: GDBTargetDebugSession): void {
        const states: SessionCpuStates = {
            states: BigInt(0),
            frequency: undefined,
            statesHistory: new CpuStatesHistory(extractPname(session.session.name)),
            isRunning: true,
            hasStates: undefined
        };
        this.sessionCpuStates.set(session.session.id, states);
    }

    protected handleOnWillStopSession(session: GDBTargetDebugSession): void {
        this.stackTraceRequests.delete(session.session.id);
        this.sessionCpuStates.delete(session.session.id);
        if (this.activeSession?.session.id && this.activeSession?.session.id === session.session.id) {
            this.activeSession = undefined;
        }
    }

    protected handleActiveSessionChanged(session?: GDBTargetDebugSession): void {
        this.activeSession = session;
        this._onRefresh.fire(0);
    }

    protected async handleConnected(session: GDBTargetDebugSession): Promise<void> {
        const cpuStates = this.sessionCpuStates.get(session.session.id);
        if (!cpuStates) {
            return;
        }
        // Following call might fail if target not stopped on connect, returns undefined
        // Retry on first Stopped Event.
        cpuStates.hasStates = await this.supportsCpuStates(session);
    }

    protected handleContinuedEvent(event: ContinuedEvent): void {
        const cpuStates = this.sessionCpuStates.get(event.session.session.id);
        if (!cpuStates) {
            return;
        }
        cpuStates.isRunning = true;
    }

    protected async handleStoppedEvent(event: StoppedEvent): Promise<void> {
        const cpuStates = this.sessionCpuStates.get(event.session.session.id);
        if (!cpuStates) {
            return;
        }
        cpuStates.isRunning = false;
        if (cpuStates.hasStates === undefined) {
            // Retry if early read after launch/attach response failed (e.g. if
            // target was running).
            cpuStates.hasStates = await this.supportsCpuStates(event.session);
        }
        if (!cpuStates.hasStates) {
            return;
        }
        return this.updateCpuStates(event.session, event.event.body.threadId, event.event.body.reason);
    }

    protected handleStackTraceRequest(request: StackTraceRequest): void {
        const cpuStates = this.sessionCpuStates.get(request.session.session.id);
        if (!cpuStates) {
            // No need to continue
            return;
        }
        let stackTraceRequests = this.stackTraceRequests.get(request.session.session.id);
        if (stackTraceRequests === undefined) {
            stackTraceRequests = new Map();
            this.stackTraceRequests.set(request.session.session.id, stackTraceRequests);
        }
        stackTraceRequests.set(request.request.seq, request.request.arguments.threadId);
    }

    protected handleStackTraceResponse(response: StackTraceResponse): void {
        // Retrieve and delete tracked request from map first
        const stackTraceRequest = this.stackTraceRequests.get(response.session.session.id);
        const threadId = stackTraceRequest?.get(response.response.request_seq);
        stackTraceRequest?.delete(response.response.request_seq);
        const states = this.activeCpuStates;
        if (!states) {
            return;
        }
        const responseBody: DebugProtocol.StackTraceResponse['body'] = response.response.body;
        const hasValidFrames = response.response.success && responseBody.totalFrames;
        const topFrame = hasValidFrames ? responseBody.stackFrames[0] : undefined;
        let locationString = '';
        if (topFrame) {
            if (topFrame.instructionPointerReference) {
                locationString += `PC=${topFrame.instructionPointerReference} `;
            }
            locationString += `<${topFrame.name}>`;
            if (topFrame.source?.name) {
                locationString += `, ${topFrame.source?.name}`;
            }
            if (topFrame.line) {
                locationString += `::${topFrame.line}`;
            }
        }
        states.statesHistory.insertStopLocation(locationString, threadId);
        // Workaround for VS Code not automatically selecting stack frame without source info.
        // Assuming the correct stack frame is selected within 100ms. To revisit if something
        // can be done without fixed delays and duplicate updates.
        this._onRefresh.fire(100);
    }

    protected handleOnDidChangeActiveStackItem(_item: SessionStackItem): void {
        this._onRefresh.fire(0);
    }

    protected async supportsCpuStates(session: GDBTargetDebugSession): Promise<boolean> {
        if (!(session.session.configuration as GDBTargetConfiguration)?.cmsis) {
            // Only enable feature if launch config contains CMSIS parts.
            return false;
        }
        const dwtCtrlValue = await session.readMemoryU32(DWT_CTRL_ADDRESS);
        // Expect DWT CYCCNT to be enabled by debugger backend. This also covers
        // v6-M where DWT_CTRL_NOCYCCNT is not implemented and always reads '0' while
        // not having a cycle counter.
        return dwtCtrlValue !== undefined && !(dwtCtrlValue & DWT_CTRL_NOCYCCNT) && !!(dwtCtrlValue & DWT_CTRL_CYCCNTENA);
    }

    protected async updateCpuStates(session: GDBTargetDebugSession, threadId?: number, reason?: string): Promise<void> {
        // Update for passed session, not necessarily the active session
        const states = this.sessionCpuStates.get(session.session.id);
        if (!states) {
            return;
        }
        const newCycles = await session.readMemoryU32(DWT_CYCCNT_ADDRESS);
        if (newCycles === undefined) {
            return;
        }
        if (states.lastCycles === undefined) {
            states.lastCycles = newCycles;
        }
        const cycleDiff = newCycles - states.lastCycles;
        const cycleAdd = cycleDiff >= 0 ? cycleDiff : newCycles + Math.pow(2, 32) - states.lastCycles;
        // Caution with types...
        states.lastCycles = newCycles;
        states.states += BigInt(cycleAdd);
        states.statesHistory.updateHistory(states.states, threadId, reason);
    }

    protected async getFrequency(): Promise<number|undefined> {
        const frequencyString = await this.activeSession?.evaluateGlobalExpression('SystemCoreClock');
        if (!frequencyString) {
            return undefined;
        }
        const frequencyValue = parseInt(frequencyString);
        return isNaN(frequencyValue) ? undefined : frequencyValue;
    }

    public async getActivePname(): Promise<string|undefined> {
        if (!this.activeSession) {
            return undefined;
        }
        const sessionName = this.activeSession.session?.name;
        if (!sessionName) {
            return undefined;
        }
        const cbuildRunReader = await this.activeSession.getCbuildRun();
        const pnames = cbuildRunReader?.getPnames();
        const pname = pnames && pnames.length > 1 ? extractPname(sessionName) : undefined;
        return pname;
    }

    public activeHasStates(): boolean|undefined {
        if (this.activeCpuStates?.hasStates === undefined) {
            return undefined;
        }
        return this.activeCpuStates.hasStates;
    }

    public async getActiveTimeString(): Promise<string|undefined> {
        if (!this.activeCpuStates || this.activeHasStates() === undefined ) {
            return undefined;
        }
        const pname = await this.getActivePname();
        if (!this.activeCpuStates.isRunning) {
            // Only update frequency while stopped. User previous otherwise
            // to avoid switching between states and time display.
            await this.updateFrequency();
        }
        const cpuName = pname ? ` ${pname} ` : '';
        if (!this.activeHasStates()) {
            return `${cpuName} N/A`;
        }
        const timeString = this.activeCpuStates.frequency === undefined
            ? `${this.activeCpuStates.states.toString()} states`
            : calculateTime(this.activeCpuStates.states, this.activeCpuStates.frequency);
        return `${cpuName} ${timeString}`;
    }

    public async updateFrequency(): Promise<void> {
        const states = this.activeCpuStates;
        if (!states) {
            return;
        }
        const frequency = await this.getFrequency();
        states.frequency = frequency;
        states.statesHistory.frequency = frequency;
    }

    public showStatesHistory(): void {
        const states = this.activeCpuStates;
        if (!states) {
            return;
        }
        if (!states.hasStates) {
            vscode.window.showWarningMessage('CPU Time commands not available for target');
            return;
        }
        states.statesHistory.showHistory();
    }

    public resetStatesHistory(): void {
        const states = this.activeCpuStates;
        if (!states) {
            return;
        }
        if (!states.hasStates) {
            vscode.window.showWarningMessage('CPU Time commands not available for target');
            return;
        }
        states.statesHistory.resetHistory();
        states.states = BigInt(0);
        this._onRefresh.fire(0);
    }
};
