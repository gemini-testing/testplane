/// <reference types="node" />
/// <reference types="node" />
/// <reference types="node" />
import { type ChildProcess } from "child_process";
export { resolveSafariVersion } from "./browser";
export declare const runSafariDriver: ({ debug }?: {
    debug?: boolean | undefined;
}) => Promise<{
    gridUrl: string;
    process: ChildProcess;
    port: number;
}>;
