// Facade combining TargetByteCache + BoundVarStore for the host.

import { TargetByteCache, ReadChunkFn } from './eval-byte-cache';
import { BoundVarStore } from './eval-var-store';

export class EvalSymbolCache {
    readonly target = new TargetByteCache();
    readonly vars = new BoundVarStore();

    addTargetSymbol(name: string, totalSize: number, readChunk: ReadChunkFn, chunkSize?: number) {
        this.target.addTargetSymbol(name, totalSize, readChunk, chunkSize);
    }

    addGlobalVar(name: string, initial = 0) {
        this.vars.addGlobal(name, initial);
    }

    addBoundVar(symbolName: string, byteOffset: number, varName: string, initial = 0) {
        this.vars.addBound(symbolName, byteOffset, varName, initial);
    }
}
