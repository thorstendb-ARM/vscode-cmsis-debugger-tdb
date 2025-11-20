// target-runtime.ts
import { ScvdBase } from '../model/scvd-base';
import { MemoryBackend, ModelAddressName } from './cache';

export interface GdbClientSync {
  read(addr: number, size: number): Uint8Array;
  write(addr: number, data: Uint8Array): void;
}

export interface Symtab {
  addressOf(ref: ScvdBase): number; // symbol -> base address
  nameOf(ref: ScvdBase): string;    // symbol -> human/key name
}

/** Unifies memory + symbol lookups for the cache host. */
export class TargetRuntime implements MemoryBackend, ModelAddressName {
    constructor(
    private readonly gdb: GdbClientSync,
    private readonly symtab: Symtab
    ) {}

    // MemoryBackend
    read(addr: number, size: number): Uint8Array {
        return this.gdb.read(addr, size);
    }
    write(addr: number, data: Uint8Array): void {
        this.gdb.write(addr, data);
    }

    // ModelAddressName
    addressOf(ref: ScvdBase): number {
        return this.symtab.addressOf(ref);
    }
    nameOf(ref: ScvdBase): string {
        return this.symtab.nameOf(ref);
    }
}
