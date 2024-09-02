/* eslint-disable @typescript-eslint/triple-slash-reference*/
/// <reference path="./clear-require.d.ts" />
/// <reference path="./escape-string-regexp.d.ts" />
/* eslint-enable @typescript-eslint/triple-slash-reference */
/// <reference types="expect-webdriverio" />
/// <reference types="webdriverio" />

//Temporary workaround to get rid of Cannot find module 'rollup/parseAst' or its corresponding type declarations. There are types at '/node_modules/rollup/dist/parseAst.d.ts', but this result could not be resolved under your current 'moduleResolution' setting. Consider updating to 'node16', 'nodenext', or 'bundler'.
declare module "rollup/parseAst" {
    export function parseAst(...args: unknown[]): unknown;
    export function parseAstAsync(...args: unknown[]): Promise<unknown>;
}

// remove after updating expect-webdriverio@4 (should migrate to esm first)
declare module "expect-webdriverio/lib/matchers" {
    const matchers: ExpectWebdriverIO.Matchers<Promise<void>, unknown>;
    export default matchers;
}
