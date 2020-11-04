import { MaybeMocked } from "ts-jest/dist/utils/testing";
import { mocked } from "ts-jest/utils";

export function cleanMocked<T extends (...args: any[]) => any>(item: T, deep?: false): MaybeMocked<T> {
    const mock = mocked(item, deep);
    mock.mockClear();
    
    return mock;
}