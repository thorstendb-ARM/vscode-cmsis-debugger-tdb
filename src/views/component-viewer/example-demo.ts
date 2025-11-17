// ============================================================================
// FILE: src/views/component-viewer/example-demo.ts (optional demo)
// SPLIT HERE ─ save as its own file (optional).
// ============================================================================

/*
import { ScvdEvalInterface } from './scvd-eval-interface';
import { createMockTargetReader } from './eval-byte-cache';
import { createMockCm81MRegisterReader } from './cm81m-registers';
import { EvalContext, evaluateParseResult } from './evaluator';
import { parseExpression } from './parser';

// Target-backed symbol TCB (4 KB)
const TOTAL = 4096;
const seed = new Uint8Array(TOTAL);

const host = new ScvdEvalInterface({
  targetSymbols: [
    { name: 'TCB', totalSize: TOTAL, readChunk: createMockTargetReader(seed), chunkSize: 256 },
  ],
  globalVars: { i: 3, j: 1 },
  readRegister: createMockCm81MRegisterReader(),
});

// Suppose model provides offsets/widths for TCB elements and members
const root: ScvdBase = ...; // your root model
const ctx = new EvalContext({ data: host as any, container: root });

// Demo 1: Read a CPU register
const prReg = parseExpression('__GetRegVal("R0")', false);
console.log('R0 =', evaluateParseResult(prReg, ctx));

// Demo 2: Index + member
const pr1 = parseExpression('TCB[i + j].state', false);
console.log('state =', evaluateParseResult(pr1, ctx));

// Demo 3: Virtual member bound to object instance
// ... host.cache.addBoundVar('TCB', stride * (i+j), 'virt', 0x1234);
const pr2 = parseExpression('TCB[i + j].virt', false);
console.log('virt =', evaluateParseResult(pr2, ctx));
*/
