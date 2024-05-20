// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="./api.d.ts" />
/// <reference types="mocha" />
/// <reference types="webdriverio" />

declare namespace globalThis {
    // eslint-disable-next-line no-var
    var expect: ExpectWebdriverIO.Expect;
}

// remove after updating expect-webdriverio@4 (should migrate to esm first)
declare module "expect-webdriverio/lib/matchers" {
    const matchers: ExpectWebdriverIO.Matchers<Promise<{ pass: boolean; message(): string }>, unknown>;
    export default matchers;
}
