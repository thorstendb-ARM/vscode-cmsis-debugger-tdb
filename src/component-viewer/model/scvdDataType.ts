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

// https://arm-software.github.io/CMSIS-View/main/data_type.html#scalar_data_type

import { ScvdItem } from './scvdItem';

const ScvdDataTypeMap: Record<string, [number, string]> = {
    'uint8_t': [8, 'unsigned char'],
    'int8_t': [8, 'signed char'],
    'uint16_t': [16, 'unsigned short'],
    'int16_t': [16, 'signed short'],
    'uint32_t': [32, 'unsigned int'],
    'int32_t': [32, 'signed int'],
    'uint64_t': [64, 'unsigned long long'],
    'int64_t': [64, 'signed long long'],
    'float': [32, 'single precision floating number'],
    'double': [64, 'double precision floating number'],
};

export class ScvdDataType extends ScvdItem {

    constructor(
        parent: ScvdItem | undefined,
    ) {
        super(parent);
    }

    public get size(): number | undefined {
        if(this.name === undefined) {
            return undefined;
        }
        return ScvdDataTypeMap[this.name]?.[0] / 8; // Convert bits to bytes
    }
}
