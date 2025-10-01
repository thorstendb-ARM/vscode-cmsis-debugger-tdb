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

import * as yaml from 'yaml';
import { CbuildRunRootType, CbuildRunType } from './cbuild-run-types';
import { FileReader, VscodeFileReader } from '../desktop/file-reader';
import { getCmsisPackRootPath } from '../utils';

const CMSIS_PACK_ROOT_ENVVAR = '${CMSIS_PACK_ROOT}';

export class CbuildRunReader {
    private cbuildRun: CbuildRunType | undefined;

    constructor(private reader: FileReader = new VscodeFileReader()) {}

    public hasContents(): boolean {
        return !!this.cbuildRun;
    }

    public getContents(): CbuildRunType | undefined {
        return this.cbuildRun;
    }

    public async parse(filePath: string): Promise<void> {
        const fileContents = await this.reader.readFileToString(filePath);
        const fileRoot = yaml.parse(fileContents) as CbuildRunRootType;
        this.cbuildRun = fileRoot ? fileRoot['cbuild-run'] : undefined;
        if (!this.cbuildRun) {
            throw new Error(`Invalid '*.cbuild-run.yml' file: ${filePath}`);
        }
    }

    public getSvdFilePaths(cmsisPackRoot?: string, pname?: string): string[] {
        if (!this.cbuildRun) {
            return [];
        }
        // Get SVD file descriptors
        const systemDescriptions = this.cbuildRun['system-descriptions'];
        const svdFileDescriptors = systemDescriptions?.filter(descriptor => descriptor.type === 'svd') ?? [];
        if (svdFileDescriptors.length === 0) {
            return [];
        }
        // Replace potential ${CMSIS_PACK_ROOT} placeholder
        const effectiveCmsisPackRoot = cmsisPackRoot ?? getCmsisPackRootPath();
        // Map to copies, leave originals untouched
        const filteredSvdDescriptors = pname ? svdFileDescriptors.filter(descriptor => descriptor.pname === pname): svdFileDescriptors;
        const svdFilePaths = filteredSvdDescriptors.map(descriptor => `${effectiveCmsisPackRoot
            ? descriptor.file.replaceAll(CMSIS_PACK_ROOT_ENVVAR, effectiveCmsisPackRoot)
            : descriptor.file}`);
        return svdFilePaths;
    }

    public getPnames(): string[] {
        if (!this.cbuildRun) {
            return [];
        }
        const processors = this.cbuildRun['debug-topology']?.processors;
        const pnameProcessors = processors?.filter(p => p.pname);
        if (!pnameProcessors?.length) {
            return [];
        }
        return pnameProcessors.map(p => p.pname!);
    }

}
