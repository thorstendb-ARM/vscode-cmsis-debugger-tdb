import * as vscode from 'vscode';
import { DebugProtocol } from '@vscode/debugprotocol';
import { GDBTargetDebugSession } from '../../debug-session';
import { logger } from '../../logger';
import { createMockDebugSession} from './component-viewer-controller';


export class ComponentViewerTargetAccess {
    // Check if mocks shall be used from configuration
    private useMocks = vscode.workspace.getConfiguration('vscode-cmsis-debugger').get('useMocks');
    _activeSession: GDBTargetDebugSession | undefined;
    constructor () {
    }

    // Function to reset active session
    public setActiveSession(session: GDBTargetDebugSession): void {
        if (this.useMocks) {
            this._activeSession = createMockDebugSession();
            return;
        } else {
            this._activeSession = session;
            return;
        }
    }

    public async evaluateSymbolAddress(address: string, context = 'hover'): Promise<string> {
        try {
            const frameId = (vscode.debug.activeStackItem as vscode.DebugStackFrame)?.frameId ?? 0;
            const args: DebugProtocol.EvaluateArguments = {
                expression: `&${address}`,
                frameId, // Currently required by CDT GDB Adapter
                context: context
            };
            const response = await this._activeSession?.session.customRequest('evaluate', args) as DebugProtocol.EvaluateResponse['body'];
            return response.result.split(' ')[0]; // Return only the address part
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

    public async doesSymbolExist(symbol: string): Promise<boolean> {
        try {
            const frameId = (vscode.debug.activeStackItem as vscode.DebugStackFrame)?.frameId ?? 0;
            const args: DebugProtocol.EvaluateArguments = {
                expression: `&${symbol}`,
                frameId, // Currently required by CDT GDB Adapter
                context: 'hover'
            };
            const response = await this._activeSession?.session.customRequest('evaluate', args) as DebugProtocol.EvaluateResponse['body'];
            const symbolInfo = response.result;
            const doesExist = symbolInfo.includes(symbol);
            return doesExist;
        } catch (error: unknown) {
            const errorMessage = (error as Error)?.message;
            logger.debug(`Session '${this._activeSession?.session.name}': Failed to know if symbol ${symbol} exists - '${errorMessage}'`);
            return false;
        }
    }
}
