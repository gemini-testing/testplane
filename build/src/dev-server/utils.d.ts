/// <reference types="node" />
import type { ChildProcess, ChildProcessWithoutNullStreams } from "child_process";
import type { Config } from "../config";
export declare const findCwd: (configPath: string) => string;
export declare const pipeLogsWithPrefix: (childProcess: ChildProcess | ChildProcessWithoutNullStreams, prefix: string) => void;
export declare const waitDevServerReady: (devServer: ChildProcessWithoutNullStreams, readinessProbe: Config["devServer"]["readinessProbe"]) => Promise<void>;
declare const _default: {
    findCwd: (configPath: string) => string;
    pipeLogsWithPrefix: (childProcess: ChildProcess | ChildProcessWithoutNullStreams, prefix: string) => void;
    waitDevServerReady: (devServer: ChildProcessWithoutNullStreams, readinessProbe: ((childProcess: ChildProcessWithoutNullStreams) => Promise<void>) | {
        url: string | null;
        isReady: ((response: Response) => boolean | Promise<boolean>) | null;
        timeouts: {
            waitServerTimeout: number;
            probeRequestTimeout: number;
            probeRequestInterval: number;
        };
    }) => Promise<void>;
};
export default _default;
