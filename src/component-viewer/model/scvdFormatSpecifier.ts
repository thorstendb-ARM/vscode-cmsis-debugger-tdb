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

import { ExplorerInfo } from './scvdBase';

// https://arm-software.github.io/CMSIS-View/main/elem_component_viewer.html


export class ScvdFormatSpecifier {

    constructor(
    ) {
    }

    private format_d(value: number | string): string {
        const n = Number(value);
        return Number.isFinite(n) ? n.toString(10) : `${value}`;
    }

    private format_u(value: number | string): string {
        const n = Number(value);
        if (!Number.isFinite(n)) return `${value}`;
        return (n >>> 0).toString(10);
    }

    private format_t(value: number | string): string {
        if (typeof value === 'number') {
            if (Number.isInteger(value) && value >= 0 && value <= 0x10FFFF) {
                try { return String.fromCodePoint(value); } catch { /* fallthrough */ }
            }
            return value.toString();
        }
        return value;
    }

    private format_x(value: number | string): string {
        const n = Number(value);
        if (!Number.isFinite(n)) return `${value}`;
        return '0x' + (n >>> 0).toString(16);
    }

    private resolveSymbol(_addr: number): string | undefined {
        // TODO: implement symbol resolution
        return undefined;
    }

    private format_address_like(value: number | string, fallbackHex: boolean): string {
        const n = Number(value);
        if (Number.isFinite(n)) {
            const sym = this.resolveSymbol(n);
            if (sym) return sym;
            if (fallbackHex) return '0x' + n.toString(16);
            return n.toString(10);
        }
        return `${value}`;
    }

    private format_C(value: number | string): string {
        return this.format_address_like(value, true);
    }

    private format_S(value: number | string): string {
        return this.format_address_like(value, true);
    }

    private format_E(value: number | string): string {
        // Placeholder: attempt symbolic enumerator resolution (not implemented)
        return this.format_d(value);
    }

    private format_I(value: number | string): string {
        if (typeof value === 'string') return value;
        const n = Number(value);
        if (!Number.isFinite(n)) return `${value}`;
        const b0 = (n >>> 24) & 0xFF;
        const b1 = (n >>> 16) & 0xFF;
        const b2 = (n >>> 8) & 0xFF;
        const b3 = n & 0xFF;
        return `${b0}.${b1}.${b2}.${b3}`;
    }

    private format_J(value: number | string): string {
        // If already a string, assume formatted IPv6
        if (typeof value === 'string') return value;
        // Cannot reliably format numeric IPv6 (needs 128-bit); fallback to hex
        return this.format_x(value);
    }

    private format_N(value: number | string): string {
        return `${value}`;
    }

    private format_M(value: number | string): string {
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

    private format_T(value: number | string): string {
        if (typeof value === 'number') {
            if (Number.isInteger(value)) return this.format_x(value);
            return value.toString();
        }
        const n = Number(value);
        if (Number.isFinite(n)) {
            if (Number.isInteger(n)) return this.format_x(n);
            return n.toString();
        }
        return `${value}`;
    }

    private format_U(value: number | string): string {
        // Placeholder for USB descriptor formatting
        return `${value}`;
    }

    private format_percent(): string {
        return '%';
    }

    private readonly formatterMap: Map<string, (value: number | string) => string> = new Map([
        ['%d', (value) => this.format_d(value)],
        ['%u', (value) => this.format_u(value)],
        ['%t', (value) => this.format_t(value)],
        ['%x', (value) => this.format_x(value)],
        ['%C', (value) => this.format_C(value)],
        ['%E', (value) => this.format_E(value)],
        ['%I', (value) => this.format_I(value)],
        ['%J', (value) => this.format_J(value)],
        ['%N', (value) => this.format_N(value)],
        ['%M', (value) => this.format_M(value)],
        ['%S', (value) => this.format_S(value)],
        ['%T', (value) => this.format_T(value)],
        ['%U', (value) => this.format_U(value)],
        ['%%', () => this.format_percent()],
    ]);

    public formatValue(specifier: string, value: string): string | undefined {
        const fn = this.formatterMap.get(specifier);
        return fn ? fn(value) : undefined;
    }

    /**
     * Expand the property template by replacing format specifiers with provided values.
     * Values are consumed left-to-right for each non-escaped specifier.
     * Unknown specifiers are left unchanged.
     */
    public expand(text: string | undefined): string {
        if (text === undefined) return '';

        const pattern = /%[A-Za-z%]/g;

        return text.replace(pattern, (m: string): string => {
            const start = pattern.lastIndex - m.length;
            const substrFromMatch = text.slice(start);
            if (m === '%%') {
                return this.formatValue('%%', '') ?? '%';
            }

            const formatted = this.formatValue(m, substrFromMatch);
            return formatted !== undefined ? formatted : m;
        });
    }

    public getExplorerInfo(itemInfo: ExplorerInfo[] = []): ExplorerInfo[] {
        const info: ExplorerInfo[] = [];

        info.push(...itemInfo);
        return info;
    }
}
