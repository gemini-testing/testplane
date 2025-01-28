/// <reference types="node" />
/// <reference types="node" />
/// <reference types="node" />
import { installEdgeDriver } from "./driver";
import { type ChildProcess } from "child_process";
export { resolveEdgeVersion } from "./browser";
export { installEdgeDriver };
export declare const runEdgeDriver: (edgeVersion: string, { debug }?: {
    debug?: boolean | undefined;
}) => Promise<{
    gridUrl: string;
    process: ChildProcess;
    port: number;
}>;
