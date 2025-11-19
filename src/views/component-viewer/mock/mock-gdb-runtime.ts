// ./src/views/component-viewer/mock/mock-gdb-runtime.ts

import { ScvdBase } from '../model/scvd-base';

export interface GdbClientSync {
  read(addr: number, size: number): Uint8Array;
  write(addr: number, data: Uint8Array): void;
}

export interface Symtab {
  addressOf(ref: ScvdBase): number; // auto-define if missing
  nameOf(ref: ScvdBase): string;
}

export interface MockGdbRuntimeOptions {
  memSize?: number;                 // total memory, default 1 MiB
  refToName?: (ref: ScvdBase) => string;
  fetchSymbols?: () => Array<{ name: string; address: number }>;
  defaultSymbolSpan?: number;       // bytes reserved if size not given (default 256)
  allocAlign?: number;              // alignment (default 16)
}

export class MockGdbRuntime implements GdbClientSync, Symtab {
    private mem: Uint8Array;
    private symbols = new Map<string, number>(); // name -> base address
    private nextAlloc = 0;
    private readonly span: number;
    private readonly align: number;
    private readonly fetchSymbols: () => Array<{ name: string; address: number }>;
    private readonly refToName: (ref: ScvdBase) => string;

    constructor(opts?: MockGdbRuntimeOptions) {
        const size = opts?.memSize ?? (1 << 20);
        this.mem = new Uint8Array(size); // zero-initialized
        this.span = Math.max(1, opts?.defaultSymbolSpan ?? 256);
        this.align = Math.max(1, opts?.allocAlign ?? 16);
        this.fetchSymbols = opts?.fetchSymbols ?? (() => []);
        this.refToName =
      opts?.refToName ??
      ((ref: any) => {
          if (ref && typeof ref.name === 'string') return ref.name;
          throw new Error('MockGdbRuntime: provide refToName or ensure ref.name exists');
      });
    }

    // ----------------- GDB-like memory I/O -----------------
    read(addr: number, size: number): Uint8Array {
        this.assertRange(addr, size);
        return this.mem.slice(addr, addr + size);
    }

    write(addr: number, data: Uint8Array): void {
        this.assertRange(addr, data.length);
        this.mem.set(data, addr);
    }

    // ----------------- Symtab (auto-define) -----------------
    addressOf(ref: ScvdBase): number {
        const name = this.nameOf(ref);
        // If missing, allocate with default span, zero-init
        return this.ensureSymbol(name);
    }

    nameOf(ref: ScvdBase): string {
        return this.refToName(ref);
    }

    /**
   * Ensure a symbol exists; if not, allocate it with `size` bytes and initialize with `init`.
   * - size: bytes to allocate (defaults to defaultSymbolSpan)
   * - init: number | bigint | Uint8Array; if shorter than size, remainder is zero-filled
   * Returns the base address.
   */
    ensureSymbol(
        name: string,
        size?: number,
        init?: number | bigint | Uint8Array
    ): number {
        const existing = this.symbols.get(name);
        if (existing !== undefined) return existing;

        const bytes = Math.max(1, size ?? this.span);
        const base = this.alignUp(this.nextAlloc, this.align);
        this.assertRange(base, bytes);

        // Initialize buffer
        const buf = new Uint8Array(bytes); // starts zeroed
        if (init !== undefined) {
            let src: Uint8Array;
            if (init instanceof Uint8Array) {
                src = init;
            } else if (typeof init === 'number' || typeof init === 'bigint') {
                // Little-endian pack of number/bigint into up to `bytes` bytes
                src = this.packLE(init, bytes);
            } else {
                throw new Error('ensureSymbol: unsupported init type');
            }
            buf.set(src.subarray(0, bytes), 0); // remainder stays 0
        }

        // Commit symbol + bytes
        this.symbols.set(name, base);
        this.mem.set(buf, base);

        // Move bump pointer past this allocation (keep same alignment invariant)
        this.nextAlloc = this.alignUp(base + bytes, this.align);
        return base;
    }

    /**
   * Optional preload/refresh from provider.
   * Missing entries are defined at given addresses (contents left as-is unless you poke()).
   */
    refreshSymtabFromGdb(): void {
        for (const { name, address } of this.fetchSymbols()) {
            if (!this.symbols.has(name)) {
                this.defineSymbolAt(name, address, this.span);
            }
        }
    }

    // ----------------- Test/setup helpers -----------------
    /** Define a symbol at explicit address with size, leaving bytes zeroed unless you poke(). */
    defineSymbolAt(name: string, address: number, size: number): void {
        this.assertRange(address, size);
        this.symbols.set(name, address);
        // Keep bump pointer ahead to avoid overlap
        const after = this.alignUp(address + size, this.align);
        if (after > this.nextAlloc) this.nextAlloc = after;
    }

    poke(addr: number, bytes: ArrayLike<number>): void {
        this.assertRange(addr, bytes.length);
        this.mem.set(bytes, addr);
    }

    peek(addr: number, size: number): Uint8Array {
        return this.read(addr, size);
    }

    // ----------------- Internals -----------------
    private packLE(value: number | bigint, size: number): Uint8Array {
        let v = typeof value === 'bigint' ? value : BigInt(Math.trunc(value));
        const out = new Uint8Array(size);
        for (let i = 0; i < size; i++) {
            out[i] = Number(v & 0xffn);
            v >>= 8n;
            if (v === 0n) break; // remainder stays 0
        }
        return out;
    }

    private alignUp(x: number, a: number): number {
        return (x + (a - 1)) & ~(a - 1);
    // For non-power-of-two align, replace with: Math.ceil(x / a) * a
    }

    private assertRange(addr: number, size: number) {
        if (!Number.isInteger(addr) || !Number.isInteger(size) || addr < 0 || size < 0) {
            throw new Error(`MockGdbRuntime: bad range addr=${addr} size=${size}`);
        }
        if (addr + size > this.mem.length) {
            throw new Error(
                `MockGdbRuntime: OOB addr=0x${addr.toString(16)} size=${size} (limit=${this.mem.length})`
            );
        }
    }
}
