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
 * DISTRIBUTED UNDER THE LICENSE IS DISTRIBUTED ON AN "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { ScvdCalc } from './scvdCalc';
import { ScvdCondition } from './scvdCondition';
import { ScvdExpression } from './scvdExpression';
import { ScvdBase, Json } from './scvdBase';


const getStringFromJsonMock = jest.fn();
const getTextBodyFromJsonMock = jest.fn();

jest.mock('./scvdUtils', () => ({
    getStringFromJson: (...a: unknown[]) => getStringFromJsonMock(...a),
    getTextBodyFromJson: (...a: unknown[]) => getTextBodyFromJsonMock(...a),
}));

describe('ScvdCalc.readXml', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('returns false and does not call super when xml is undefined', () => {
        const superSpy = jest.spyOn(ScvdBase.prototype, 'readXml').mockReturnValue(true);
        const calc = new ScvdCalc(undefined);
        const result = calc.readXml(undefined as unknown as Json);
        expect(result).toBe(false);
        expect(superSpy).not.toHaveBeenCalled();
    });

    it('parses cond only (no expressions)', () => {
        getStringFromJsonMock.mockReturnValueOnce('A > B');
        getTextBodyFromJsonMock.mockReturnValueOnce(undefined);

        const superSpy = jest.spyOn(ScvdBase.prototype, 'readXml').mockReturnValue(true);
        const calc = new ScvdCalc(undefined);
        const result = calc.readXml({ cond: 'ignoredRaw' } as Json);

        expect(result).toBe(true);
        expect(calc.cond).toBeInstanceOf(ScvdCondition);
        expect(calc.expression).toHaveLength(0);
        expect(superSpy).toHaveBeenCalledTimes(1);
    });

    it('parses expressions only (no cond)', () => {
        getStringFromJsonMock.mockReturnValueOnce(undefined);
        getTextBodyFromJsonMock.mockReturnValueOnce(['x + 1', 'y - 2']);

        const calc = new ScvdCalc(undefined);
        calc.readXml({ anything: 1 } as Json);

        expect(calc.cond).toBeUndefined();
        expect(calc.expression).toHaveLength(2);
        calc.expression.forEach(e => expect(e).toBeInstanceOf(ScvdExpression));
    });

    it('parses cond and multiple expressions (including an undefined one that is skipped)', () => {
        getStringFromJsonMock.mockReturnValueOnce('flag == 1');
        getTextBodyFromJsonMock.mockReturnValueOnce(['alpha', undefined, 'beta']);

        const calc = new ScvdCalc(undefined);
        calc.readXml({ cond: 'flag == 1' } as Json);

        expect(calc.cond).toBeInstanceOf(ScvdCondition);
        expect(calc.expression).toHaveLength(2);
    });

    it('accumulates expressions across multiple readXml calls while replacing condition', () => {
        // First call
        getStringFromJsonMock.mockReturnValueOnce('first');
        getTextBodyFromJsonMock.mockReturnValueOnce(['one']);

        const calc = new ScvdCalc(undefined);
        calc.readXml({ cond: 'first' } as Json);

        const firstCond = calc.cond;
        expect(calc.expression).toHaveLength(1);

        // Second call: new cond, new expressions
        getStringFromJsonMock.mockReturnValueOnce('second');
        getTextBodyFromJsonMock.mockReturnValueOnce(['two', 'three']);

        calc.readXml({ cond: 'second' } as Json);

        expect(calc.cond).toBeInstanceOf(ScvdCondition);
        expect(calc.cond).not.toBe(firstCond);
        expect(calc.expression).toHaveLength(3); // accumulated
    });

    it('handles empty object: no cond, no expressions', () => {
        getStringFromJsonMock.mockReturnValueOnce(undefined);
        getTextBodyFromJsonMock.mockReturnValueOnce([]);

        const calc = new ScvdCalc(undefined);
        calc.readXml({} as Json);

        expect(calc.cond).toBeUndefined();
        expect(calc.expression).toHaveLength(0);
    });

    it('handles nullish cond value gracefully', () => {
        getStringFromJsonMock.mockReturnValueOnce(undefined);
        getTextBodyFromJsonMock.mockReturnValueOnce(['e1']);

        const calc = new ScvdCalc(undefined);
        calc.readXml({ cond: null } as unknown as Json);

        expect(calc.cond).toBeUndefined();
        expect(calc.expression).toHaveLength(1);
    });

    it('verifies super.readXml return value is forwarded', () => {
        const superSpy = jest.spyOn(ScvdBase.prototype, 'readXml').mockReturnValue(false);
        getStringFromJsonMock.mockReturnValueOnce('c');
        getTextBodyFromJsonMock.mockReturnValueOnce(['e']);

        const calc = new ScvdCalc(undefined);
        const result = calc.readXml({ cond: 'c' } as Json);

        expect(result).toBe(false);
        expect(superSpy).toHaveBeenCalledTimes(1);
    });
});
