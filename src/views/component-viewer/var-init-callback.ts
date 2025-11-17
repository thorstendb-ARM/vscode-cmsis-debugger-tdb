// Initialization callback for virtual vars (auto-add on first use)

import type { RefContainer } from './evaluator';
import type { ScvdBase } from './model/scvd-base';
import type { ScvdVar } from './model/scvd-var';

export type VarInitContext = {
  kind: 'bound' | 'global';
  container: RefContainer;
  anchor: ScvdBase;
  member?: ScvdVar;           // present for kind==='bound'
  symbolName: string;
  byteOffset?: number;        // present for kind==='bound'
  varName: string;
};

export type VarInitHook = (ctx: VarInitContext) => number | undefined;

export function createDefaultVarInit(): VarInitHook {
    return (ctx) => {
        const m = ctx.member as any;
        if (m && typeof m.getDefault === 'function') {
            const dv = m.getDefault();
            if (typeof dv === 'number') return dv >>> 0;
        }
        if (m && typeof m.defaultValue === 'number') return (m.defaultValue as number) >>> 0;
        if (m && typeof m.resetValue === 'number') return (m.resetValue as number) >>> 0;
        return 0;
    };
}
