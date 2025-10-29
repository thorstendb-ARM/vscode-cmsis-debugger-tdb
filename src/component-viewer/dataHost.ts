// src/component-viewer/dataHost.ts
import {
    EvalContext,
    type EvalContextInit,
    type DataHost,
    type CTypeDesc,
} from './evaluator';

/** Object-backed DataHost */
export class ObjectDataHost implements DataHost {
    private readonly target: Record<string, any>;
    private readonly types = new Map<string, CTypeDesc>();

    constructor(initial: Record<string, any> = {}) {
        this.target = initial;
    }

    // Symbols
    hasSymbol(name: string): boolean {
        return Object.prototype.hasOwnProperty.call(this.target, name);
    }
    readSymbol(name: string): any | undefined {
        return this.target[name];
    }
    writeSymbol(name: string, value: any): any {
        this.target[name] = value;
        return value;
    }

    // Containers
    isContainer(v: any): boolean {
        return typeof v === 'object' && v !== null;
    }
    isArray(v: any): boolean {
        return Array.isArray(v);
    }
    makeObject(): any {
        return {};
    }
    makeArray(): any {
        const a: any[] = [];
        if (!Object.getOwnPropertyDescriptor(a, '_count')) {
            Object.defineProperty(a, '_count', { get() { return a.length; }, enumerable: false });
        }
        return a;
    }

    // Generic key access
    readKey(container: any, key: any): any | undefined {
        if (Array.isArray(container) && (key === '_count' || key === 'length')) {
            return container.length;
        }
        return (typeof container === 'object' && container !== null) ? (container as any)[key] : undefined;
    }
    writeKey(container: any, key: any, value: any): any {
        (container as any)[key] = value;
        if (Array.isArray(container) && !Object.getOwnPropertyDescriptor(container, '_count')) {
            Object.defineProperty(container, '_count', { get() {
                return (container as any).length;
            }, enumerable: false });
        }
        return value;
    }

    stats() {
        return { symbols: Object.keys(this.target).length };
    }

    // Optional symbol → type registry
    registerType(symbol: string, desc: CTypeDesc): void {
        this.types.set(symbol, desc);
    }
    getType(symbol: string): CTypeDesc | undefined {
        return this.types.get(symbol);
    }
}

/** Instantiate a JS value for a CTypeDesc */
export function instantiateFromDesc(desc: CTypeDesc): any {
    switch (desc.kind) {
        case 'scalar': return 0;
        case 'struct': {
            const o: Record<string, any> = {};
            for (const [k, f] of Object.entries(desc.fields)) o[k] = instantiateFromDesc(f);
            return o;
        }
        case 'array': {
            const arr = Array.from({ length: desc.length }, () => instantiateFromDesc(desc.of)) as any;
            if (!Object.getOwnPropertyDescriptor(arr, '_count')) {
                Object.defineProperty(arr, '_count', { get() { return arr.length; }, enumerable: false });
            }
            return arr;
        }
    }
}

/**
 * Demo/reference initializer.
 * Accepts EvalContextInit; will use its data/intrinsics/functions/printf if provided.
 * Falls back to ObjectDataHost() when no data host is passed in.
 */
export function makeTypedDemoContext(init: EvalContextInit = {}): EvalContext {
    const data = init.data ?? new ObjectDataHost();
    const ctx = new EvalContext({ ...init, data });

    // 1) Plain scalar (top-level coercion via ctx.define)
    ctx.define('RTX_En', 'uint32_t', 1);

    // 2) Struct type: mem_head_com : mem_head_t
    const mem_head_t: CTypeDesc = {
        kind: 'struct',
        fields: {
            size:     { kind: 'scalar', ctype: 'uint32_t' },
            used:     { kind: 'scalar', ctype: 'uint32_t' },
            max_used: { kind: 'scalar', ctype: 'uint32_t' },
        },
    };
    data.registerType?.('mem_head_com', mem_head_t);
    const mem_head_val = instantiateFromDesc(mem_head_t);
    Object.assign(mem_head_val, { size: 1024, used: 0, max_used: 0 });
    data.writeSymbol('mem_head_com', mem_head_val);

    // 3) Array-of-structs: mem_list_com : mem_block_t[3]
    const mem_block_t: CTypeDesc = {
        kind: 'struct',
        fields: {
            next: { kind: 'scalar', ctype: 'uint32_t' }, // pointer-as-u32 for demo
            len:  { kind: 'scalar', ctype: 'uint32_t' },
            id:   { kind: 'scalar', ctype: 'uint8_t'  },
        },
    };
    const mem_list_com_desc: CTypeDesc = { kind: 'array', of: mem_block_t, length: 3 };
    data.registerType?.('mem_list_com', mem_list_com_desc);

    const mem_list_val = instantiateFromDesc(mem_list_com_desc);
    mem_list_val[0].len = 10; mem_list_val[0].id = 1; mem_list_val[0].next = 0;
    mem_list_val[1].len = 20; mem_list_val[1].id = 2; mem_list_val[1].next = 0;
    mem_list_val[2].len = 30; mem_list_val[2].id = 3; mem_list_val[2].next = 0;
    data.writeSymbol('mem_list_com', mem_list_val);

    return ctx;
}
