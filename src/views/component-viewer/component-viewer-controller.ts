import * as vscode from 'vscode';
import { GDBTargetDebugTracker, GDBTargetDebugSession, SessionStackItem } from '../../debug-session';
import { ComponentViewerInstance } from './component-viewer-instance';
import { URI } from 'vscode-uri';
import path from 'path';
import { ComponentViewerTreeDataProvider } from './component-viewer-tree-view';
// Erase later, for Thorsten's debugging purposes
import { SidebarDebugView } from './sidebar-debug-view';
// End of erase later

const scvdMockTestFiles: Map<string, boolean> = new Map<string, boolean>([
    ['test-data/MyTest.scvd',           true],
    ['test-data/RTX5.scvd',             false],
    ['test-data/BaseExample.scvd',      false],
    ['test-data/Network.scvd',          false],
    ['test-data/USB.scvd',              false],
    ['test-data/FileSystem.scvd',       false],
    ['test-data/EventRecorder.scvd',    false],
    ['test-data/GetRegVal_Test.scvd',   false],
]);

const scvdMockFiles: string[] = Array.from(scvdMockTestFiles.entries())
    .filter(([_, include]) => include)
    .map(([filePath]) => filePath);

// Helper function to create a mock GDBTargetDebugSession for testing
export function createMockDebugSession(): GDBTargetDebugSession {
    const mockVSCodeSession: vscode.DebugSession = {
        id: 'mock-session-id',
        name: 'Mock Debug Session',
        type: 'gdbtarget',
        workspaceFolder: undefined,
        configuration: {
            type: 'gdbtarget',
            name: 'Mock Debug Session',
            request: 'launch'
        },
        customRequest: async () => ({}),
        getDebugProtocolBreakpoint: async () => undefined
    };
    return new GDBTargetDebugSession(mockVSCodeSession);
}


export class ComponentViewerController {
    private activeSession: GDBTargetDebugSession | undefined;
    private instances: ComponentViewerInstance[] = [];
    private componentViewerTreeDataProvider: ComponentViewerTreeDataProvider | undefined;
    private treeDataProvider: SidebarDebugView | undefined;
    private _context: vscode.ExtensionContext;
    private mockFlag: boolean = true;
    // Check if mocks shall be used from configuration
    private useMocks = vscode.workspace.getConfiguration('vscode-cmsis-debugger').get('useMocks');

    public constructor(context: vscode.ExtensionContext) {
        this._context = context;
    }

    public async activate(tracker: GDBTargetDebugTracker): Promise<void> {
        /* Create Tree Viewer */
        // Shall be removed later, only for Thorsten's debugging purposes
        this.treeDataProvider = new SidebarDebugView();
        const providerDisposable = vscode.window.registerTreeDataProvider('cmsis-scvd-explorer', this.treeDataProvider);
        // End of shall be removed later
        this.componentViewerTreeDataProvider = new ComponentViewerTreeDataProvider();
        const treeProviderDisposable = vscode.window.registerTreeDataProvider('cmsis-debugger.componentViewer', this.componentViewerTreeDataProvider);
        this._context.subscriptions.push(
            providerDisposable, // Shall be removed later
            treeProviderDisposable);
        // Subscribe to vscode event for changes in mocks configuration in the settings.json
        vscode.workspace.onDidChangeConfiguration(async (event) => {
            // Do an initial setup of mocks if useMocks is true and no instances are loaded yet
            this.useMocks = vscode.workspace.getConfiguration('vscode-cmsis-debugger').get('useMocks');
            if (this.instances.length === 0 && this.useMocks && this.mockFlag) {
                this.mockFlag = false; // to avoid multiple initializations
                await this.useMocksInstances(this._context);
                await this.componentViewerTreeDataProvider?.activate();
                return;
            }
            // if there are instances already loaded, check if the configuration changed
            if (event.affectsConfiguration('vscode-cmsis-debugger.useMocks')) {
                if (this.useMocks) {
                    await this.useMocksInstances(this._context);
                    await this.componentViewerTreeDataProvider?.activate();
                } else {
                    await this.componentViewerTreeDataProvider?.deleteModels();
                }
            }
        });
        // Subscribe to debug tracker events to update active session
        this.subscribetoDebugTrackerEvents(this._context, tracker);
    }

    protected async buildMockInstancesArray(context: vscode.ExtensionContext): Promise<void> {
        const mockedInstances: ComponentViewerInstance[] = [];
        //const mockSession = createMockDebugSession();
        for (const scvdFile of scvdMockFiles) {
            const instance = new ComponentViewerInstance();
            try {
                // use a mocked GDBTargetDebugSession
            await instance.readModel(URI.file(path.join(context.extensionPath, scvdFile)), createMockDebugSession());
            } catch (error) {
                console.error('Error reading mock SCVD file:', scvdFile, error);
                continue;
            }
            mockedInstances.push(instance);
        }
        this.instances = mockedInstances;
        /*const sidebarModel = this.instances[0].model; // Shall be removed later
        if(sidebarModel !== undefined) {
            this.treeDataProvider?.setModel(sidebarModel); // Shall be removed later
        }*/
    }

    protected async readScvdFiles(session?: GDBTargetDebugSession): Promise<void> {
        if (!session) {
            return;
        }
        const cbuildRunReader = await session.getCbuildRun();
        if (!cbuildRunReader) {
            return;
        }
        // Get SCVD file paths from cbuild-run reader
        const scvdFilesPaths: string [] = cbuildRunReader.getScvdFilePaths();
        if (scvdFilesPaths.length === 0) {
            return undefined;
        }
        const cbuildRunInstances: ComponentViewerInstance[] = [];
        for (const scvdFilePath of scvdFilesPaths) {
            const instance = new ComponentViewerInstance();
            if (this.activeSession !== undefined) {
                await instance.readModel(URI.file(scvdFilePath), this.activeSession);
                cbuildRunInstances.push(instance);
            }
        }
        this.instances = cbuildRunInstances;
    }

    private async useMocksInstances(context: vscode.ExtensionContext) : Promise<void> {
        await this.buildMockInstancesArray(context);
        // Add all mock models to the tree view
        for (const instance of this.instances) {
            this.componentViewerTreeDataProvider?.addGuiOut(instance.getGuiOut());
        }
    }

    private async loadCbuildRunInstances(session: GDBTargetDebugSession) : Promise<void> {
        // Try to read SCVD files from cbuild-run file first
        await this.readScvdFiles(session);
        // Are there any SCVD files found in cbuild-run?
        if (this.instances.length > 0) {
            // Add all models from cbuild-run to the tree view
            for (const instance of this.instances) {
                this.componentViewerTreeDataProvider?.addGuiOut(instance.getGuiOut());
            }
            this.componentViewerTreeDataProvider?.showModelData();
            return;
        }
    }

    private subscribetoDebugTrackerEvents(context: vscode.ExtensionContext, tracker: GDBTargetDebugTracker): void {
        const onWillStopSessionDisposable = tracker.onWillStopSession(async (session) => {
            await this.handleOnWillStopSession(session);
        });
        const onConnectedDisposable = tracker.onConnected(async (session) => {
            await this.handleOnConnected(session);
        });
        //const onWillStartSessionDisposable = tracker.onWillStartSession(async (session) => {
        //    await this.handleOnWillStartSession(session);
        //});
        const onDidChangeActiveStackItemDisposable = tracker.onDidChangeActiveStackItem(async (stackTraceItem) => {
            await this.handleOnDidChangeActiveStackItem(stackTraceItem);
        });
        const onDidChangeActiveDebugSessionDisposable = tracker.onDidChangeActiveDebugSession(async (session) => {
            await this.handleOnDidChangeActiveDebugSession(session);
        });
        // clear all disposables on extension deactivation
        context.subscriptions.push(
            onWillStopSessionDisposable,
            //onWillStartSessionDisposable,
            onConnectedDisposable,
            onDidChangeActiveStackItemDisposable,
            onDidChangeActiveDebugSessionDisposable
        );
    }

    private async handleOnWillStopSession(session: GDBTargetDebugSession): Promise<void> {
        // Clear active session if it is the one being stopped
        if (this.activeSession?.session.id === session.session.id) {
            this.activeSession = undefined;
        }
        // Update component viewer instance(s)
        this.updateInstances();
    }

    private async handleOnConnected(session: GDBTargetDebugSession): Promise<void> {
        // If mocks are being used, erase them and start reading SCVD files from cbuild-run
        if( this.instances.length > 0 && this.useMocks ) {
            this.instances = [];
            await this.componentViewerTreeDataProvider?.deleteModels();
        }
        // if new session is not the current active session, erase old instances and read the new ones
        if (this.activeSession?.session.id !== session.session.id) {
            this.instances = [];
            await this.componentViewerTreeDataProvider?.deleteModels();
        }
        // Load SCVD files from cbuild-run
        this.loadCbuildRunInstances(session);
        // Update debug session
        this.activeSession = session;
        // Subscribe to refresh events of the started session
        session.refreshTimer.onRefresh(async (refreshSession) => {
            if (this.activeSession?.session.id === refreshSession.session.id) {
                // Update component viewer instance(s)
                this.updateInstances();
            }
        });
    }

    private async handleOnDidChangeActiveStackItem(stackTraceItem: SessionStackItem): Promise<void> {
        if ((stackTraceItem.item as vscode.DebugStackFrame).frameId !== undefined) {
            // Update instance(s) with new stack frame info
            this.updateInstances();
        }
    }

    private async handleOnDidChangeActiveDebugSession(session: GDBTargetDebugSession | undefined): Promise<void> {
        // Update debug session
        this.activeSession = session;
        // Update component viewer instance(s)
        this.updateInstances();
    }

    private async updateInstances(): Promise<void> {
        if (!this.activeSession) {
            return;
        }
        for (const instance of this.instances) {
            instance.updateModel(this.activeSession);
        }
    }

}
