import * as vscode from 'vscode';
import { DebugProtocol } from '@vscode/debugprotocol';
import { GDBTargetDebugSession } from '../../debug-session';
import { logger } from '../../logger';


class ComponentViewerTargetAccess {

    _activeSession: GDBTargetDebugSession | undefined;
    constructor (session: GDBTargetDebugSession) {
        this._activeSession = session;
    }
    
    /** Function returns string only in case of failure */
    public async evaluateSymbolAddress(address: string, context = 'hover'): Promise<string> {
        try {
            const frameId = (vscode.debug.activeStackItem as vscode.DebugStackFrame)?.frameId ?? 0;
            const args: DebugProtocol.EvaluateArguments = {
                expression: `&${address}`,
                frameId, // Currently required by CDT GDB Adapter
                context: context
            };
            const response = await this._activeSession?.session.customRequest('evaluate', args) as DebugProtocol.EvaluateResponse['body'];
            return response.result;
        } catch (error: unknown) {
            const errorMessage = (error as Error)?.message;
            logger.debug(`Session '${this._activeSession?.session.name}': Failed to evaluate address '${address}' - '${errorMessage}'`);
            return errorMessage === 'custom request failed' ? 'No active session' : errorMessage;
        }
    }

    public async evaluateMemory(address: string, length: number, offset: number): Promise<string | undefined> {
        try {
            const args: DebugProtocol.ReadMemoryArguments = {
                memoryReference: `${address}`,
                count: length,
                offset: offset
            };
            const response = await this._activeSession?.session.customRequest('readMemory', args) as DebugProtocol.ReadMemoryResponse['body'];
            return response?.data;
        } catch (error: unknown) {
            const errorMessage = (error as Error)?.message;
            logger.debug(`Session '${this._activeSession?.session.name}': Failed to read memory at address '${address}' - '${errorMessage}'`);
            return errorMessage === 'custom request failed' ? 'No active session' : errorMessage;
        }
    }

    public async isMemberInStruct(structure: string, member: string): Promise<boolean> {
        try {
            const frameId = (vscode.debug.activeStackItem as vscode.DebugStackFrame)?.frameId ?? 0;
            const args: DebugProtocol.EvaluateArguments = {
                expression: `ptype ${structure}`,
                frameId, // Currently required by CDT GDB Adapter
                context: 'hover'
            };
            const response = await this._activeSession?.session.customRequest('evaluate', args) as DebugProtocol.EvaluateResponse['body'];
            const structDefinition = response.result;
            const isMemberInStructure = structDefinition.includes(member);
            return isMemberInStructure;
        } catch (error: unknown) {
            const errorMessage = (error as Error)?.message;
            logger.debug(`Session '${this._activeSession?.session.name}': Failed to know if member ${member} is part of '${structure}' - '${errorMessage}'`);
            return false;
        }
    }
}