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


export function AddText(text: string, addText: string | string[]): string {
    if (Array.isArray(addText)) {
        if (text.length) {
            return text + ' ' + addText.join(' ');
        }
        return addText.join(' ');
    }

    if (text.length) {
        return text + ' ' + addText;
    }
    return addText;
}

export function insertString(text: string, add: string, pos: number): string {
    if (pos == 0) {
        return add + text;
    }
    if (pos >= text.length) {
        return text + add;
    }

    return text.slice(0, pos) + add + text.slice(pos);
}

export function unsignedRShift(num: number, rShift: number) {
    return num >>> rShift;
}

export function clearSignBit(num: number) {
    return num >>> 0;
}

export function getArrayFromJson<T>(value: T | T[] | undefined): T[] | undefined {
    return value === undefined ? undefined : (Array.isArray(value) ? value : [value]);
}
