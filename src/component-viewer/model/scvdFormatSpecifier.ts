/**
 * Copyright 2025 Arm Limited
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { EvalContext } from '../evaluator';

// https://arm-software.github.io/CMSIS-View/main/elem_component_viewer.html


export class ScvdFormatSpecifier {

    constructor(
    ) {
    }

    private format_d(value: number | string, _ctx: EvalContext): string {
        const n = Number(value);
        return Number.isFinite(n) ? n.toString(10) : `${value}`;
    }

    private format_u(value: number | string, _ctx: EvalContext): string {
        const n = Number(value);
        if (!Number.isFinite(n)) return `${value}`;
        return (n >>> 0).toString(10);
    }

    private format_t(value: number | string, _ctx: EvalContext): string {
        if (typeof value === 'number' && Number.isInteger(value)) {
            return `Reading string from: 0x${value.toString(16)}`;
        }
        return `Error reading string from: 0x${value.toString(16)}`;
    }

    private format_x(value: number | string, _ctx: EvalContext): string {
        const n = Number(value);
        if (!Number.isFinite(n)) return `${value}`;
        return '0x' + (n >>> 0).toString(16);
    }

    private resolveSymbol(_addr: number, _ctx: EvalContext): string | undefined {
        // TODO: implement symbol resolution
        return `symbol: 0x${_addr.toString(16)}`;
    }

    private format_address_like(value: number | string, fallbackHex: boolean, ctx: EvalContext): string {
        const n = Number(value);
        if (Number.isFinite(n)) {
            const sym = this.resolveSymbol(n, ctx);
            if (sym) return sym;
            if (fallbackHex) return '0x' + n.toString(16);
            return n.toString(10);
        }
        return `${value}`;
    }

    private format_C(value: number | string, ctx: EvalContext): string {
        return this.format_address_like(value, true, ctx);
    }

    private format_S(value: number | string, ctx: EvalContext): string {
        return this.format_address_like(value, true, ctx);
    }

    private format_E(value: number | string, ctx: EvalContext): string {
        // Placeholder: attempt symbolic enumerator resolution (not implemented)
        return this.format_d(value, ctx);
    }

    private format_I(value: number | string, _ctx: EvalContext): string {
        if (typeof value === 'string') return value;
        const n = Number(value);
        if (!Number.isFinite(n)) return `${value}`;
        const b0 = (n >>> 24) & 0xFF;
        const b1 = (n >>> 16) & 0xFF;
        const b2 = (n >>> 8) & 0xFF;
        const b3 = n & 0xFF;
        return `${b0}.${b1}.${b2}.${b3}`;
    }

    private format_J(value: number | string, ctx: EvalContext): string {
        // If already a string, assume formatted IPv6
        if (typeof value === 'string') return value;
        // Cannot reliably format numeric IPv6 (needs 128-bit); fallback to hex
        return this.format_x(value, ctx);
    }

    private format_N(value: number | string, _ctx: EvalContext): string {
        return `${value}`;
    }

    private format_M(value: number | string, _ctx: EvalContext): string {
        if (typeof value === 'string') {
            const cleaned = value.replace(/[^0-9a-fA-F]/g, '').slice(0, 12).padStart(12, '0');
            return cleaned.match(/.{1,2}/g)?.join('-').toUpperCase() ?? value;
        }
        const n = Number(value);
        if (!Number.isFinite(n)) return `${value}`;
        const parts: string[] = [];
        for (let i = 5; i >= 0; i--) {
            parts.push(((n >> (i * 8)) & 0xFF).toString(16).padStart(2, '0'));
        }
        return parts.join('-').toUpperCase();
    }

    private format_T(value: number | string, ctx: EvalContext): string {
        if (typeof value === 'number') {
            if (Number.isInteger(value)) return this.format_x(value, ctx);
            return value.toString();
        }
        const n = Number(value);
        if (Number.isFinite(n)) {
            if (Number.isInteger(n)) return this.format_x(n, ctx);
            return n.toString();
        }
        return `${value}`;
    }

    private format_U(value: number | string, _ctx: EvalContext): string {
        // Placeholder for USB descriptor formatting
        return `USB descriptor: ${value}`;
    }

    private format_percent(): string {
        return '%';
    }

    private readonly formatterMap: Map<string, (value: number | string, ctx: EvalContext) => string> = new Map([
        ['d', (value, ctx) => this.format_d(value, ctx)],
        ['u', (value, ctx) => this.format_u(value, ctx)],
        ['t', (value, ctx) => this.format_t(value, ctx)],
        ['x', (value, ctx) => this.format_x(value, ctx)],
        ['C', (value, ctx) => this.format_C(value, ctx)],
        ['E', (value, ctx) => this.format_E(value, ctx)],
        ['I', (value, ctx) => this.format_I(value, ctx)],
        ['J', (value, ctx) => this.format_J(value, ctx)],
        ['N', (value, ctx) => this.format_N(value, ctx)],
        ['M', (value, ctx) => this.format_M(value, ctx)],
        ['S', (value, ctx) => this.format_S(value, ctx)],
        ['T', (value, ctx) => this.format_T(value, ctx)],
        ['U', (value, ctx) => this.format_U(value, ctx)],
        ['%', () => this.format_percent()],
    ]);

    public formatValue(specifier: string, value: string, ctx: EvalContext): string | undefined {
        const fn = this.formatterMap.get(specifier);
        return fn ? fn(value, ctx) : undefined;
    }
}
