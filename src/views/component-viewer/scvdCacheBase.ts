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

// https://arm-software.github.io/CMSIS-View/main/elem_var.html


export type CacheCbFunc<T> = (key: T) => ScvdValueRecord;

export interface ScvdValueRecord {
    value: number;
    accCnt: number;
    valid: boolean;
    toBeRemoved?: boolean;
}

export enum ScvdRecordAccess {
    Read = 0,
    Write = 1,
    Set = 2,
    Clear = 3
}

export abstract class ScvdCacheBase<T> {
    private _cache: Map<T, ScvdValueRecord> | undefined;
    private static readonly _MAX_ACC_CNT = 100;
    private static readonly _MIN_ACC_CNT = 0;
    private static readonly _DEFAULT_ACC_CNT = 10;

    constructor(
    ) {
        this._cache = new Map<T, ScvdValueRecord>();
    }

    protected get cache(): Map<T, ScvdValueRecord> | undefined {
        return this._cache;
    }


    protected get MAX_ACC_CNT(): number {
        return ScvdCacheBase._MAX_ACC_CNT;
    }
    protected get MIN_ACC_CNT(): number {
        return ScvdCacheBase._MIN_ACC_CNT;
    }
    protected get DEFAULT_ACC_CNT(): number {
        return ScvdCacheBase._DEFAULT_ACC_CNT;
    }

    protected clearCache(): void {
        this._cache?.clear();
    }

    protected invalidate(): void {
        this._cache?.forEach( (record: ScvdValueRecord) => {
            record.valid = false;
        });
    }

    // update access count based on access type
    // will be used to remove least frequently used records when cache size limit is reached
    private updateAccCnt(record: ScvdValueRecord, access: ScvdRecordAccess): void {
        switch (access) {
            case ScvdRecordAccess.Read:
                if (record.accCnt < this.MAX_ACC_CNT) {
                    record.accCnt += 1;
                }
                break;
            case ScvdRecordAccess.Write:
                if (record.accCnt > this.MIN_ACC_CNT) {
                    record.accCnt -= 1;
                }
                break;
            case ScvdRecordAccess.Set:
                record.accCnt = this.DEFAULT_ACC_CNT;
                break;
            case ScvdRecordAccess.Clear:
                record.accCnt = this.MIN_ACC_CNT;
                break;
        }
    }

    // add a new or update a value to the cache
    // used when the value is directly known
    protected writeAddValue(key: T, value: number): void {
        if (this.cache === undefined) {
            return;
        }

        const record = this.cache.get(key);
        if (record === undefined) {
            const newRecord: ScvdValueRecord = {
                value,
                accCnt: 0,
                valid: true
            };
            this.updateAccCnt(newRecord, ScvdRecordAccess.Set);
            this.cache.set(key, newRecord);
        } else {
            const record = this.cache.get(key);
            if (record !== undefined) {
                record.value = value;
                record.valid = true;
                this.updateAccCnt(record, ScvdRecordAccess.Write);
            }
        }
    }

    // get a value from the cache or add/update it using the callback function
    // used when the value needs to be fetched
    protected readAddValue(key: T, cbFunc: CacheCbFunc<T>): ScvdValueRecord | undefined {
        if (this.cache === undefined) {
            return undefined;
        }

        const record = this.cache.get(key);
        if (record !== undefined) {
            if(record.valid === true) { // return cached record
                this.updateAccCnt(record, ScvdRecordAccess.Read);
                return record;
            } else {    // update cached record
                const newRecord = cbFunc(key);
                if(newRecord.toBeRemoved === true) {
                    this.cache.delete(key);
                    return undefined;
                }
                if(newRecord.valid === true) {
                    record.value = newRecord.value;
                    record.valid = true;
                    this.updateAccCnt(record, ScvdRecordAccess.Write);
                    return record;
                } else {
                    return undefined;
                }
            }
        } else {    // add new record
            const newRecord = cbFunc(key);
            if(newRecord.valid === false || newRecord.toBeRemoved === true) {
                return undefined;
            }
            this.updateAccCnt(newRecord, ScvdRecordAccess.Write);
            this.cache.set(key, newRecord);
            return newRecord;
        }
    }

    protected updateWholeCache(cbFunc: CacheCbFunc<T>): void {
        if (this.cache === undefined) {
            return;
        }

        this.cache.forEach( (record: ScvdValueRecord, key: T) => {
            const newRecord = cbFunc(key);
            if (newRecord.toBeRemoved) {
                this.cache?.delete(key);
                return;
            }
            if(newRecord.valid === true) {
                record.value = newRecord.value;
                record.valid = true;
                this.updateAccCnt(record, ScvdRecordAccess.Write);
            } else {
                record.valid = false;
            }
        });
    }

    protected invalidateWholeCache(): void {
        if (this.cache === undefined) {
            return;
        }

        this.cache.forEach( (record: ScvdValueRecord) => {
            record.valid = false;
        });
    }
}
