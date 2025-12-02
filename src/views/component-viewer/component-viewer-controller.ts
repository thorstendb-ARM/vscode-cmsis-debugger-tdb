import * as vscode from 'vscode';
import { GDBTargetDebugTracker, GDBTargetDebugSession, SessionStackItem} from '../../debug-session';
import { ComponentViewerInstance } from './component-viewer-instance';
import { URI } from 'vscode-uri';
import path from 'path';
import { ComponentViewerTreeDataProvider } from './component-viewer-tree-view';
// Erase later, for Thorsten's debugging purposes
import { SidebarDebugView } from './sidebar-debug-view';
// End of erase later


const scvdFiles: string[] = [
    'test-data/BaseExample.scvd',
    'test-data/RTX5.scvd',
    'test-data/Network.scvd',
    'test-data/USB.scvd',
    'test-data/FileSystem.scvd',
    'test-data/EventRecorder.scvd',
    'test-data/GetRegVal_Test.scvd',
    'test-data/MyTest.scvd',
];

enum scvdExamples {
    BaseExample = 0,
    RTX5 = 1,
    Network = 2,
    USB = 3,
    FileSystem = 4,
    EventRecorder = 5,
    GetRegVal_Test = 6,
    MyTest = 7,
}

const scvdFile1 = scvdFiles[scvdExamples.RTX5];
 // cherry pick 3 files for testing
const scvdFile2 = scvdFiles.filter((_, index) => 
    index === scvdExamples.BaseExample ||
    index === scvdExamples.RTX5 ||
    index === scvdExamples.GetRegVal_Test
);


export class ComponentViewerController {
    private activeSession: GDBTargetDebugSession | undefined;
    private instances: ComponentViewerInstance[] = [];
    private componentViewerTreeDataProvider: ComponentViewerTreeDataProvider | undefined;
    private treeDataProvider: SidebarDebugView | undefined;
    private _context: vscode.ExtensionContext;
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
        // if we are using mocks, no need to subscribe to debug tracker events
        if (this.useMocks) {
            await this.useMocksInstances(this._context);
            await this.componentViewerTreeDataProvider.activate();
            return;
        }
        // Subscribe to debug tracker events to update active session
        this.subscribetoDebugTrackerEvents(this._context, tracker);
    }

    protected async buildMockInstancesArray(context: vscode.ExtensionContext): Promise<void> {
            const mockedInstances: ComponentViewerInstance[] = [];
            for (const scvdFile of scvdFile2) {
                const instance = new ComponentViewerInstance();
                await instance.readModel(URI.file(path.join(context.extensionPath, scvdFile)));
                mockedInstances.push(instance);
            }
            this.instances = mockedInstances;
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
            await instance.readModel(URI.file(scvdFilePath));
            cbuildRunInstances.push(instance);
        }
        this.instances = cbuildRunInstances;
    }

    private async useMocksInstances(context: vscode.ExtensionContext) : Promise<void> {
            await this.buildMockInstancesArray(context);
            // Add all mock models to the tree view
            for (const instance of this.instances) {
                this.componentViewerTreeDataProvider?.addModel(instance.model);
            }
            /* These lines are for Thorsten's debugging purposes and should be erased later */
            const instance = new ComponentViewerInstance();
            await instance.readModel(URI.file(path.join(context.extensionPath, scvdFile1)));
            this.treeDataProvider?.setModel(instance.model);
            /** End of lines for Thorsten's debugging purposes */
    }

    private async loadCbuildRunInstances(session: GDBTargetDebugSession) : Promise<void> {
            // Try to read SCVD files from cbuild-run file first
            await this.readScvdFiles(session);
            // Are there any SCVD files found in cbuild-run?
            if (this.instances.length > 0) {
                // Add all models from cbuild-run to the tree view
                for (const instance of this.instances) {
                    this.componentViewerTreeDataProvider?.addModel(instance.model);
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
