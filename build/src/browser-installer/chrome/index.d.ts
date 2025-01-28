/// <reference types="node" />
/// <reference types="node" />
/// <reference types="node" />
import { type ChildProcess } from "child_process";
import { installChrome, resolveLatestChromeVersion } from "./browser";
import { installChromeDriver } from "./driver";
export { installChrome, resolveLatestChromeVersion, installChromeDriver };
export declare const runChromeDriver: (chromeVersion: string, { debug }?: {
    debug?: boolean | undefined;
}) => Promise<{
    gridUrl: string;
    process: ChildProcess;
    port: number;
}>;
