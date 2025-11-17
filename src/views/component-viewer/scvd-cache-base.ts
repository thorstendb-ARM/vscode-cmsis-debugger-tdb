// FILE: src/scvd-cache-base.ts
/*
 * Base cache layer (SYNC VERSION)
 * - No async/await anywhere
 * - TargetFetchFn is synchronous
 */

export type TargetFetchFn = (expr: string) => unknown;

export interface CacheContainer<T> {
  value: T;
  valid: boolean;
  dirty: boolean;
  lastUpdated: number;
}

/** Utility for rounding up to next multiple. */
export function roundUp(n: number, multiple: number) {
    return (n + multiple - 1) - ((n + multiple - 1) % multiple);
}

export class ScvdCacheBase<T> {
    protected containers = new Map<string, CacheContainer<T>>();
    protected fetchFn: TargetFetchFn;

    constructor(fetchFn: TargetFetchFn) {
        this.fetchFn = fetchFn;
    }

    setFetchCallback(fetchFn: TargetFetchFn) { this.fetchFn = fetchFn; }

    /** Create or return an existing container, initializing its value via `init`. */
    protected getOrInit(symbol: string, init: () => T): CacheContainer<T> {
        let c = this.containers.get(symbol);
        if (!c) {
            c = { value: init(), valid: false, dirty: false, lastUpdated: 0 };
            this.containers.set(symbol, c);
        }
        return c;
    }

    /** Set container value and mark valid/not dirty. */
    protected setValue(symbol: string, value: T) {
        const c = this.getOrInit(symbol, () => value);
        c.value = value;
        c.valid = true;
        c.dirty = false;
        c.lastUpdated = Date.now();
    }

    protected markDirty(symbol: string) {
        const c = this.containers.get(symbol);
        if (c) c.dirty = true;
    }

    invalidate(symbol?: string) {
        if (symbol === undefined) {
            for (const c of this.containers.values()) c.valid = false;
        } else {
            const c = this.containers.get(symbol);
            if (c) c.valid = false;
        }
    }

    remove(symbol: string) { this.containers.delete(symbol); }
    clear() { this.containers.clear(); }
    has(symbol: string) { return this.containers.has(symbol); }
    protected getContainer(symbol: string): CacheContainer<T> | undefined { return this.containers.get(symbol); }

    /** Ensure container is valid; if not, fetch and decode (SYNC). */
    protected fetchIfInvalidSync(
        symbol: string,
        expr: string,
        init: () => T,
        decode: (raw: unknown, previous?: T) => T,
    ): CacheContainer<T> {
        const c = this.getOrInit(symbol, init);
        if (!c.valid) {
            const raw = this.fetchFn(expr);
            c.value = decode(raw, c.value);
            c.valid = true;
            c.dirty = false;
            c.lastUpdated = Date.now();
        }
        return c;
    }
}
