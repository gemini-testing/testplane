// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="./api.d.ts" />
// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="./clear-require.d.ts" />
/// <reference types="mocha" />
/// <reference types="webdriverio" />

declare namespace globalThis {
    // eslint-disable-next-line no-var
    var expect: ExpectWebdriverIO.Expect;
}

//Temporary workaround to get rid of Cannot find module 'rollup/parseAst' or its corresponding type declarations. There are types at '/node_modules/rollup/dist/parseAst.d.ts', but this result could not be resolved under your current 'moduleResolution' setting. Consider updating to 'node16', 'nodenext', or 'bundler'.
declare module "rollup/parseAst" {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    export function parseAst(...args: any[]): any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    export function parseAstAsync(...args: any[]): Promise<any>;
}

// remove after updating expect-webdriverio@4 (should migrate to esm first)
declare module "expect-webdriverio/lib/matchers" {
    const matchers: ExpectWebdriverIO.Matchers<Promise<void>, unknown>;
    export default matchers;
}
