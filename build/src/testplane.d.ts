import { Command } from "@gemini-testing/commander";
import { BaseTestplane } from "./base-testplane";
import { MainRunner as NodejsEnvRunner } from "./runner";
import { MainRunner as BrowserEnvRunner } from "./runner/browser-env";
import { TestCollection } from "./test-collection";
import { ConfigInput } from "./config/types";
import { MasterEventHandler, Test, TestResult } from "./types";
interface RunOpts {
    browsers: string[];
    sets: string[];
    grep: RegExp;
    updateRefs: boolean;
    requireModules: string[];
    inspectMode: {
        inspect: boolean;
        inspectBrk: boolean;
    };
    reporters: string[];
    replMode: {
        enabled: boolean;
        beforeTest: boolean;
        onFail: boolean;
    };
    devtools: boolean;
    local: boolean;
}
export type FailedListItem = {
    browserVersion?: string;
    browserId?: string;
    fullTitle: string;
};
interface RunnableOpts {
    saveLocations?: boolean;
}
export interface ReadTestsOpts extends Pick<RunOpts, "browsers" | "sets" | "grep" | "replMode"> {
    silent: boolean;
    ignore: string | string[];
    failed: FailedListItem[];
    runnableOpts?: RunnableOpts;
}
export interface Testplane {
    on: MasterEventHandler<this>;
    once: MasterEventHandler<this>;
    prependListener: MasterEventHandler<this>;
}
export declare class Testplane extends BaseTestplane {
    protected failed: boolean;
    protected failedList: FailedListItem[];
    protected runner: NodejsEnvRunner | BrowserEnvRunner | null;
    constructor(config?: string | ConfigInput);
    extendCli(parser: Command): void;
    protected _init(): Promise<void>;
    run(testPaths: TestCollection | string[], { browsers, sets, grep, updateRefs, requireModules, inspectMode, replMode, devtools, local, reporters, }?: Partial<RunOpts>): Promise<boolean>;
    protected _saveFailed(): Promise<void>;
    protected _readTests(testPaths: string[] | TestCollection, opts: Partial<ReadTestsOpts>): Promise<TestCollection>;
    addTestToRun(test: Test, browserId: string): boolean;
    readTests(testPaths: string[], { browsers, sets, grep, silent, ignore, replMode, runnableOpts }?: Partial<ReadTestsOpts>): Promise<TestCollection>;
    isFailed(): boolean;
    protected _fail(): void;
    protected _addFailedTest(result: TestResult): void;
    isWorker(): boolean;
    halt(err: Error, timeout?: number): void;
}
export {};
