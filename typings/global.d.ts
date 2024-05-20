// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="./api.d.ts" />
/// <reference types="mocha" />
/// <reference types="webdriverio" />

declare namespace globalThis {
    // eslint-disable-next-line no-var
    var expect: ExpectWebdriverIO.Expect;
}
