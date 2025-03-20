import { Test } from "./test";
import { Suite } from "./suite";
import { Hook } from "./hook";
export type TestObjectData = {
    title: string;
};
export type Location = {
    line: number;
    column: number;
};
export type ConfigurableTestObjectData = {
    id: string;
    pending: boolean;
    timeout: number;
    file: string;
    disabled: boolean;
    skipReason: string;
    silentSkip: boolean;
    browserId: string;
    browserVersion?: string;
    location?: Location;
};
export interface TestFunctionCtx {
    browser: WebdriverIO.Browser;
    currentTest: Test;
}
export type TestFunction<T> = (this: TestFunctionCtx, ctx: T) => void | Promise<void>;
export interface TestHookDefinition {
    <T extends Partial<TestFunctionCtx> = TestFunctionCtx>(fn?: TestFunction<T>): Hook;
}
export interface TestDefinition {
    <T extends Partial<TestFunctionCtx> = TestFunctionCtx>(title: string, fn?: TestFunction<T>): Test;
    only: <T>(title: string, fn?: TestFunction<T>) => Test;
    skip: <T>(title: string, fn?: TestFunction<T>) => Test;
}
export interface SuiteDefinition {
    (title: string, fn: (this: Suite) => void): Suite;
    only: (title: string, fn: (this: Suite) => void) => Suite;
    skip: (title: string, fn: (this: Suite) => void) => Suite;
}
