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

import { ResolveSymbolCb, ResolveType } from '../resolver';
import { ExplorerInfo, ScvdBase } from './scvd-base';
import { ScvdTypedef } from './scvd-typedef';

// https://arm-software.github.io/CMSIS-View/main/data_type.html#scalar_data_type

// The following scalar data types are supported and can be used in read, typedef, and var elements.
// read and var also support arrays based on scalar data types.
const ScvdScalarDataTypeMap: Record<string, [number, string]> = {
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

export class ScvdDataType extends ScvdBase {
    private _type: ScvdScalarDataType | ScvdComplexDataType | undefined;

    constructor(
        parent: ScvdBase | undefined,
        type: string | undefined
    ) {
        super(parent);
        this.type = type;
    }

    public get type(): ScvdScalarDataType | ScvdComplexDataType | undefined {
        return this._type;
    }

    public set type(type: string | undefined) {
        if (typeof type === 'string') {
            Object.keys(ScvdScalarDataTypeMap).forEach(element => { // test, then create object
                if (element === type) {
                    this._type = new ScvdScalarDataType(this, type);
                }
            });
            if( this._type === undefined) { // not a scalar type, create complex type
                this._type = new ScvdComplexDataType(this, type);
            }
        }
    }

    public getMember(property: string): ScvdBase | undefined {
        return this._type?.getMember(property);
    }

    public getBitWidth(): number {
        return this._type?.getBitWidth() ?? 32;
    }

    public getExplorerInfo(itemInfo: ExplorerInfo[] = []): ExplorerInfo[] {
        const info: ExplorerInfo[] = [];

        if (this._type !== undefined) {
            info.push({ name: 'Type', value: this._type.getExplorerDisplayName() });
            info.push({ name: 'Size', value: this.getBitWidth().toString() ?? '' });
        } else {
            info.push({ name: 'Type', value: 'undefined' });
        }
        info.push(...itemInfo);
        return super.getExplorerInfo(info);
    }

    public getExplorerDisplayName(): string {
        return this.getExplorerDisplayEntry() ?? this._type?.getExplorerDisplayName() ?? 'data type';
    }

}


export class ScvdScalarDataType extends ScvdBase {
    private _type: string | undefined;

    constructor(
        parent: ScvdBase | undefined,
        type: string | undefined
    ) {
        super(parent);
        if (typeof type === 'string') {
            Object.keys(ScvdScalarDataTypeMap).forEach(element => {
                if (element === type) {
                    this._type = type;
                }
            });
        }
    }

    public get size(): number | undefined {
        const info = this._type && ScvdScalarDataTypeMap[this._type];
        const value = info ? info[0]: undefined;
        return value;
    }

    public get type(): string | undefined {
        return this._type;
    }

    public getBitWidth(): number {
        const bitWidth = this.size;
        if( bitWidth !== undefined) {
            return bitWidth;
        }
        return 32;
    }

    public getExplorerInfo(itemInfo: ExplorerInfo[] = []): ExplorerInfo[] {
        const info: ExplorerInfo[] = [];
        if (this._type !== undefined) {
            info.push({ name: 'Type', value: this._type });
            info.push({ name: 'Size', value: this.size?.toString() ?? '' });
        }
        info.push(...itemInfo);
        return super.getExplorerInfo(info);
    }

    public getExplorerDisplayName(): string {
        return this.getExplorerDisplayEntry() ?? this._type ?? 'unknown scalar type';
    }
}

export class ScvdComplexDataType extends ScvdBase{
    private _typeName: string | undefined;
    private _type: ScvdTypedef | undefined;
    private _isPointer: boolean = false;

    constructor(
        parent: ScvdBase | undefined,
        typeName: string | undefined
    ) {
        super(parent);
        this.typeName = typeName;
    }

    private set typeName(value: string | undefined) {
        this._typeName = value;
    }

    public get typeName(): string | undefined {
        return this._typeName;
    }

    public get size(): number | undefined {
        const sizeInBytes = this._type?.size;
        if (sizeInBytes !== undefined) {
            return sizeInBytes;
        }
        return undefined;
    }

    public getBitWidth(): number {
        const bitWidth = this.size;
        if( bitWidth !== undefined) {
            return bitWidth * 8;
        }
        return 32;
    }

    public get isPointer(): boolean {
        return this._isPointer;
    }
    private set isPointer(value: boolean) {
        this._isPointer = value;
    }

    public resolveAndLink(resolveFunc: ResolveSymbolCb): boolean {
        const typeName = this.typeName?.replace(/\*/g, '').trim();
        if(typeName === undefined) {
            return false;
        }
        const isPointer = (this.typeName?.indexOf('*') === 0);
        if(isPointer) {
            this.isPointer = true;
        }

        const item = resolveFunc(typeName, ResolveType.localType);
        if(item === undefined || !(item instanceof ScvdTypedef)) {
            console.error('Failed to resolve complex data type:', typeName);
            return false;
        }
        this._type = item;
        return true;
    }

    public getMember(property: string): ScvdBase | undefined {
        return this._type?.getMember(property);
    }


    public getExplorerInfo(itemInfo: ExplorerInfo[] = []): ExplorerInfo[] {
        const info: ExplorerInfo[] = [];
        if (this._typeName !== undefined) {
            info.push({ name: 'TypeName', value: this._typeName });
        }
        if( this._type !== undefined) {
            info.push({ name: 'Resolved Type', value: this._type.getExplorerDisplayName() });
        } else {
            info.push({ name: 'Resolved Type', value: 'not resolved' });
        }
        if( this.isPointer) {
            info.push({ name: 'Pointer', value: 'true' });
        }
        info.push(...itemInfo);
        return super.getExplorerInfo(info);
    }

    public getExplorerDisplayName(): string {
        return this.getExplorerDisplayEntry() ?? this._typeName ?? 'unknown complex type';
    }

}
