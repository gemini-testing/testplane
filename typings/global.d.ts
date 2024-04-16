// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="./api.d.ts" />
/// <reference types="mocha" />
/// <reference types="webdriverio" />

interface TestFunctionCtx {
    browser: WebdriverIO.Browser;
    currentTest: Mocha.Test;
}

type TestFunction<T> = (this: TestFunctionCtx, ctx: T) => void | Promise<void>;

interface TestHookDefinition {
    <T extends Partial<TestFunctionCtx> = TestFunctionCtx>(fn?: TestFunction<T>): void;
}

interface TestDefinition {
    <T extends Partial<TestFunctionCtx> = TestFunctionCtx>(title: string, fn?: TestFunction<T>): Mocha.Test;

    only: <T>(title: string, fn?: TestFunction<T>) => Mocha.Test;

    skip: <T>(title: string, fn?: TestFunction<T>) => Mocha.Test;
}

interface SuiteDefinition {
    (title: string, fn: (this: Mocha.Suite) => void): Mocha.Suite;

    only: (title: string, fn: (this: Mocha.Suite) => void) => Mocha.Suite;
    skip: (title: string, fn: (this: Mocha.Suite) => void) => Mocha.Suite;
}

declare namespace globalThis {
    // eslint-disable-next-line no-var
    var expect: ExpectWebdriverIO.Expect;
}

// remove after updating expect-webdriverio@4 (should migrate to esm first)
declare module "expect-webdriverio/lib/matchers" {
    const matchers: ExpectWebdriverIO.Matchers<Promise<{ pass: boolean; message(): string }>, unknown>;
    export default matchers;
}
