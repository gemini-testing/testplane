import type { InlineConfig } from "vite";
import type { BrowserTestRunEnvOptions } from "./types";
type MockOnFs = {
    fullPath: string;
    moduleName: string;
};
type ManualMockOptions = {
    automock: boolean;
    mocksOnFs: MockOnFs[];
};
export declare class ManualMock {
    private _automock;
    private _mocksOnFs;
    private _mocks;
    private _unmocks;
    static create<T extends ManualMock>(this: new (opts: ManualMockOptions) => T, config: Partial<InlineConfig>, options?: BrowserTestRunEnvOptions): Promise<T>;
    constructor(options: ManualMockOptions);
    resolveId(id: string): Promise<string | void>;
    mock(moduleName: string): void;
    unmock(moduleName: string): void;
    resetMocks(): void;
}
export {};
