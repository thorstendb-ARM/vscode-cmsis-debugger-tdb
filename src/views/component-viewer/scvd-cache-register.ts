// FILE: src/cache-register.ts
/*
 * Register cache (SYNC VERSION)
 * - Map: register name -> number
 * - read()/write() are synchronous
 */

import { ScvdCacheBase, TargetFetchFn } from './scvd-cache-base';

export type CortexMReg =
  | `r${0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12}`
  | 'sp' | 'lr' | 'pc'
  | 'psr' | 'apsr' | 'ipsr' | 'epsr' | 'xpsr'
  | 'msp' | 'psp' | 'msplim' | 'psplim'
  | 'msp_ns' | 'psp_ns' | 'msplim_ns' | 'psplim_ns' | 'sp_ns'
  | 'control' | 'primask' | 'basepri' | 'basepri_max' | 'faultmask'
  | 'control_ns' | 'primask_ns' | 'basepri_ns' | 'faultmask_ns'
  | 'fpscr' | 'fpccr' | 'fpcar' | 'fpdscr'
  | `s${0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20 | 21 | 22 | 23 | 24 | 25 | 26 | 27 | 28 | 29 | 30 | 31}`;

export class ScvdCacheRegister extends ScvdCacheBase<number> {
    constructor(fetchFn: TargetFetchFn) { super(fetchFn); }
    protected exprFor(reg: string) { return `reg:${reg.trim().toLowerCase()}`; }
    private normalize(name: string) { return name.trim().toLowerCase(); }

    // Optional: simple listeners for UI updates (still synchronous)
    private listeners = new Map<string, Set<(value: number) => void>>();
    onUpdate(registerName: string, listener: (value: number) => void): () => void {
        const key = this.normalize(registerName);
        let set = this.listeners.get(key);
        if (!set) { set = new Set(); this.listeners.set(key, set); }
        set.add(listener);
        return () => {
            const s = this.listeners.get(key);
            if (!s) return;
            s.delete(listener);
            if (s.size === 0) this.listeners.delete(key);
        };
    }
    private emitUpdate(key: string) {
        const listeners = this.listeners.get(key);
        if (!listeners || listeners.size === 0) return;
        const c = this.getContainer(key);
        if (!c) return;
        const val = c.value;
        for (const cb of listeners) { try { cb(val); } catch { /* ignore */ } }
    }

    /** Refresh from target synchronously and clear dirty. */
    private refreshFromTargetSync(key: string) {
        const raw = this.fetchFn(this.exprFor(key));
        let v: number;
        if (typeof raw === 'number') v = raw >>> 0;
        else if (typeof raw === 'string') v = Number(raw) >>> 0;
        else throw new Error(`Unexpected register payload for ${key}`);
        const c = this.getOrInit(key, () => 0 as number);
        c.value = v;
        c.valid = true;
        c.dirty = false;
        c.lastUpdated = Date.now();
        this.emitUpdate(key);
        return c;
    }

    /** Read: add symbol if missing; refresh if invalid or dirty; return value (SYNC). */
    read(registerName: string): number {
        const key = this.normalize(registerName);
        const c = this.getOrInit(key, () => 0 as number);
        if (!c.valid || c.dirty) this.refreshFromTargetSync(key);
        return this.getContainer(key)!.value;
    }

    /** Write: add symbol if missing; refresh first if invalid/dirty; then set & mark dirty (SYNC). */
    write(registerName: string, value: number): void {
        const key = this.normalize(registerName);
        const c = this.getOrInit(key, () => 0 as number);
        if (!c.valid || c.dirty) this.refreshFromTargetSync(key);
        c.value = (value >>> 0);
        c.valid = true;
        c.dirty = true; // local change pending push-to-target (out of scope here)
        c.lastUpdated = Date.now();
        this.emitUpdate(key);
    }
}

/** Mock for registers (SYNC). */
export class MockRegisterTarget {
    private regs = new Map<string, number>();

    constructor(initial?: Partial<Record<CortexMReg | string, number>>) {
        const defaults: Record<string, number> = {
            // Core integer and status
            r0: 0x00000000, r1: 0x11111111, r2: 0x22222222, r3: 0x33333333,
            r4: 0x44444444, r5: 0x55555555, r6: 0x66666666, r7: 0x77777777,
            r8: 0x88888888, r9: 0x99999999, r10: 0xAAAAAAAA >>> 0, r11: 0xBBBBBBBB >>> 0,
            r12: 0xCCCCCCCC >>> 0, sp: 0x20001000, lr: 0x08000101, pc: 0x08000000,
            psr: 0x01000000, apsr: 0x00000000, ipsr: 0x00000000, epsr: 0x01000000, xpsr: 0x01000000,

            // Stack pointers & limits (Armv8-M / v8.1-M)
            msp: 0x20002000, psp: 0x20003000, msplim: 0x20000000, psplim: 0x20000000,
            // Non-secure banked versions (TrustZone)
            msp_ns: 0x10002000, psp_ns: 0x10003000, msplim_ns: 0x10000000, psplim_ns: 0x10000000,
            sp_ns: 0x10001000,

            // Mask/control
            control: 0x00000002, primask: 0x00000000, basepri: 0x00000000, basepri_max: 0x00000000, faultmask: 0x00000000,
            control_ns: 0x00000000, primask_ns: 0x00000000, basepri_ns: 0x00000000, faultmask_ns: 0x00000000,

            // Floating-point (optional extension)
            fpscr: 0x00000000, fpccr: 0x00000000, fpcar: 0x00000000, fpdscr: 0x00000000,
            s0:0, s1:0, s2:0, s3:0, s4:0, s5:0, s6:0, s7:0,
            s8:0, s9:0, s10:0, s11:0, s12:0, s13:0, s14:0, s15:0,
            s16:0, s17:0, s18:0, s19:0, s20:0, s21:0, s22:0, s23:0,
            s24:0, s25:0, s26:0, s27:0, s28:0, s29:0, s30:0, s31:0,
        };
        for (const [k, v] of Object.entries({ ...defaults, ...(initial ?? {}) })) {
            if (typeof v === 'number') this.regs.set(k.trim().toLowerCase(), v >>> 0);
        }
    }

    /** Synchronous target fetch for registers. */
    fetch: TargetFetchFn = (expr: string): unknown => {
        if (!expr.startsWith('reg:')) throw new Error(`MockRegisterTarget cannot handle ${expr}`);
        const name = expr.slice(4).trim().toLowerCase();
        const val = this.regs.get(name);
        if (val === undefined) throw new Error(`Unknown register ${name}`);
        return val >>> 0;
    };

    set(name: string, value: number) { this.regs.set(name.trim().toLowerCase(), value >>> 0); }
    get(name: string) { return this.regs.get(name.trim().toLowerCase()) ?? 0; }
}

// Example usage (sync):
// const regTarget = new MockRegisterTarget();
// const regCache = new ScvdCacheRegister(regTarget.fetch);
// const pc = regCache.read('pc');
// regCache.write('pc', pc + 4);

