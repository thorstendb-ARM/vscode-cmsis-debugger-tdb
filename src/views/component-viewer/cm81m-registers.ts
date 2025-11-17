// Cortex-M v8.1-M register cache with a target-read callback + mock

export type ReadRegFn = (name: string) => number | undefined;

function norm(name: string): string {
    return name.trim().toUpperCase();
}

function alias(name: string): string {
    const n = norm(name);
    if (n === 'R13') return 'SP';
    if (n === 'R14') return 'LR';
    if (n === 'R15') return 'PC';
    if (n === 'CPSR') return 'XPSR';
    return n;
}

/** Decide SP alias (MSP vs PSP) using CONTROL.SPSEL if available. */
function resolveSP(store: Map<string, number>, readThrough: ReadRegFn): string {
    const ctl = store.get('CONTROL') ?? readThrough('CONTROL');
    if (ctl !== undefined) {
        const SPSEL = (ctl >>> 1) & 1;
        return SPSEL ? 'PSP' : 'MSP';
    }
    return 'MSP';
}

export class Cm81MRegisterCache {
    private store = new Map<string, number>();
    constructor(private readonly readReg: ReadRegFn) {}

    read(name: string): number | undefined {
        let key = alias(name);
        if (key === 'SP') key = resolveSP(this.store, this.readReg);

        let v = this.store.get(key);
        if (v === undefined) {
            v = this.readReg(key);
            if (v !== undefined) this.store.set(key, v >>> 0);
        }
        return v;
    }

    set(name: string, value: number): void {
        this.store.set(alias(name), value >>> 0);
    }

    preload(map: Record<string, number>): void {
        for (const [k, v] of Object.entries(map)) this.set(k, v);
    }
}

/** Wide mock covering typical Armv8.1-M core + FP regs. */
export function createMockCm81MRegisterReader(): ReadRegFn {
    const gen: Record<string, number> = {};
    for (let i = 0; i <= 12; i++) gen[`R${i}`] = 0x1000 + i;
    gen.SP = 0x20001000;
    gen.MSP = 0x20001000;
    gen.PSP = 0x20002000;
    gen.LR = 0x08000123;
    gen.PC = 0x08001234;
    gen.XPSR = 0x01000000;
    gen.APSR = 0x00000000;
    gen.IPSR = 0x00000011;
    gen.EPSR = 0x01000000;
    gen.CONTROL = 0x00000002; // SPSEL=1 -> PSP
    gen.PRIMASK = 0x00000000;
    gen.BASEPRI = 0x00000000;
    gen.FAULTMASK = 0x00000000;
    gen.MSPLIM = 0x20000000;
    gen.PSPLIM = 0x20000000;

    for (let s = 0; s <= 31; s++) gen[`S${s}`] = (0x3f800000 + s) >>> 0;
    gen.FPSCR = 0x00000000;
    gen.FPCCR = 0xC0000000;
    gen.FPCAR = 0x20003000;
    gen.FPDSCR = 0x00000000;

    return (name: string) => {
        const a = alias(name);
        const n = norm(name);
        return gen[n] ?? gen[a] ?? undefined;
    };
}
