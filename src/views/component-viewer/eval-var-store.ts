// Per-object **virtual var** store.
// - GLOBAL vars (helpers like i, j)
// - BOUND vars keyed by (symbolName @ byteOffset) → varName

export class BoundVarStore {
    private globals = new Map<string, number>();
    private bound = new Map<string, Map<string, number>>();

    static makeBindingKey(symbolName: string, byteOffset: number): string {
        return `${symbolName}@${byteOffset >>> 0}`;
    }

    // ---- GLOBAL ----
    addGlobal(name: string, initial = 0): void { this.globals.set(name, initial >>> 0); }
    readGlobal(name: string): number | undefined { return this.globals.get(name); }
    writeGlobal(name: string, value: number): boolean {
        if (!this.globals.has(name)) return false;
        this.globals.set(name, value >>> 0);
        return true;
    }
    hasGlobal(name: string): boolean { return this.globals.has(name); }
    ensureGlobal(name: string, initial = 0): void {
        if (!this.globals.has(name)) this.addGlobal(name, initial);
    }

    // ---- BOUND (per-instance) ----
    addBound(symbolName: string, byteOffset: number, varName: string, initial = 0): void {
        const key = BoundVarStore.makeBindingKey(symbolName, byteOffset);
        let inner = this.bound.get(key);
        if (!inner) { inner = new Map(); this.bound.set(key, inner); }
        inner.set(varName, initial >>> 0);
    }
    readBound(symbolName: string, byteOffset: number, varName: string): number | undefined {
        const key = BoundVarStore.makeBindingKey(symbolName, byteOffset);
        return this.bound.get(key)?.get(varName);
    }
    writeBound(symbolName: string, byteOffset: number, varName: string, value: number): boolean {
        const key = BoundVarStore.makeBindingKey(symbolName, byteOffset);
        const inner = this.bound.get(key);
        if (!inner || !inner.has(varName)) return false;
        inner.set(varName, value >>> 0);
        return true;
    }
    hasBound(symbolName: string, byteOffset: number, varName: string): boolean {
        const key = BoundVarStore.makeBindingKey(symbolName, byteOffset);
        return !!this.bound.get(key)?.has(varName);
    }
    ensureBound(symbolName: string, byteOffset: number, varName: string, initial = 0): void {
        if (!this.hasBound(symbolName, byteOffset, varName)) {
            this.addBound(symbolName, byteOffset, varName, initial);
        }
    }
}
