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

import { CbuildRunReader } from './cbuild-run-reader';

const TEST_CBUILD_RUN_FILE = 'test-data/multi-core.cbuild-run.yml'; // Relative to repo root
const TEST_FILE_PATH = 'test-data/fileReaderTest.txt'; // Relative to repo root

describe('CbuildRunReader', () => {

    describe('Parser', () => {
        it('successfully parses a *.cbuild-run.yml file', async () => {
            const cbuildRunReader = new CbuildRunReader();
            await expect(cbuildRunReader.parse(TEST_CBUILD_RUN_FILE)).resolves.not.toThrow();
            expect(cbuildRunReader.hasContents()).toBe(true);
            const contents = cbuildRunReader.getContents();
            expect(contents).toBeDefined();
            expect(contents).toMatchSnapshot();
        });

        it('throws if it parses something other than a *.cbuild-run.yml file and correctly responds to raw contents calls', async () => {
            const expectedError = /Invalid '\*\.cbuild-run\.yml' file: .*test-data\/fileReaderTest\.txt/;
            const cbuildRunReader = new CbuildRunReader();
            await expect(cbuildRunReader.parse(TEST_FILE_PATH)).rejects.toThrow(expectedError);
            expect(cbuildRunReader.hasContents()).toBe(false);
            expect(cbuildRunReader.getContents()).toBeUndefined();
        });

        it('correctly responds to raw contents calls if nothing is parsed', () => {
            const cbuildRunReader = new CbuildRunReader();
            expect(cbuildRunReader.hasContents()).toBe(false);
            expect(cbuildRunReader.getContents()).toBeUndefined();
        });
    });

    describe('Extract Values', () => {
        let cbuildRunReader: CbuildRunReader;

        beforeEach(() => {
            cbuildRunReader = new CbuildRunReader();
        });

        it.each([
            {
                info: 'no pname',
                pname: undefined,
                expectedSvdPaths: [
                    '/my/pack/root/MyVendor/MyDevice/1.0.0/Debug/SVD/MyDevice_Core0.svd',
                    '/my/pack/root/MyVendor/MyDevice/1.0.0/Debug/SVD/MyDevice_Core1.svd'
                ]
            },
            {
                info: 'Core0',
                pname: 'Core0',
                expectedSvdPaths: [
                    '/my/pack/root/MyVendor/MyDevice/1.0.0/Debug/SVD/MyDevice_Core0.svd',
                ]
            },
            {
                info: 'Core1',
                pname: 'Core1',
                expectedSvdPaths: [
                    '/my/pack/root/MyVendor/MyDevice/1.0.0/Debug/SVD/MyDevice_Core1.svd'
                ]
            },
        ])('returns SVD file path ($info)', async ({ pname, expectedSvdPaths }) => {
            await cbuildRunReader.parse(TEST_CBUILD_RUN_FILE);
            const svdFilePaths = cbuildRunReader.getSvdFilePaths('/my/pack/root', pname);
            expect(svdFilePaths.length).toEqual(svdFilePaths.length);
            for (let i = 0; i < svdFilePaths.length; i++) {
                // eslint-disable-next-line security/detect-object-injection
                expect(expectedSvdPaths[i]).toEqual(svdFilePaths[i]);
            }
        });

        it('returns empty SVD file path list if nothing is parsed', () => {
            const svdFilePaths = cbuildRunReader.getSvdFilePaths('/my/pack/root');
            expect(svdFilePaths.length).toEqual(0);
        });
    });
});
