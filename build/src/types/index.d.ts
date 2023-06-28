import type { Browser } from "webdriverio";
import { Events } from "../events";
import { MainRunner } from "../runner";
import { TestCollection } from "../test-collection";
import type { Test } from "../test-reader/test-object/test";
import type { Suite } from "../test-reader/test-object/suite";
import type { TestParserAPI } from "../test-reader/test-parser-api";
import { StatsResult } from "../stats";
import { ConfigController } from "../test-reader/controllers/config-controller";
import { OnlyController } from "../test-reader/controllers/only-controller";
import { SkipController } from "../test-reader/controllers/skip-controller";
import { BrowserVersionController } from "../test-reader/controllers/browser-version-controller";
import { WorkerProcess } from "../utils/worker-process";
import { BaseHermione } from "../base-hermione";
export { Suite as RunnerSuite, Test as RunnerTest } from "mocha";
export type { Browser as WdioBrowser } from "webdriverio";
export type { Test } from "../test-reader/test-object/test";
export type { Suite } from "../test-reader/test-object/suite";
export interface RootSuite extends Suite {
    root: true;
}
export interface BrowserInfo {
    browserId: string;
    sessionId: string;
}
export type AsyncSessionEventCallback = (browser: Browser, browserInfo: BrowserInfo) => Promise<void> | void;
export interface TestError extends Error {
    screenshot?: {
        base64: string;
    };
}
export interface ImageSize {
    width: number;
    height: number;
}
export interface ImageInfo {
    path: string;
    size: ImageSize;
}
export interface AssertViewResultsSuccess {
    stateName: string;
    refImg: ImageInfo;
}
export interface CommandHistory {
    /** Name: command name */
    n: string;
    /** Arguments: array of passed arguments */
    a: unknown[];
    /** Time start */
    ts: number;
    /** Time end */
    te: number;
    /** Duration */
    d: number;
    /** Scope: scope of execution (browser or element) */
    s: "b" | "e";
    /** Children: array of children commands */
    c: CommandHistory[];
}
export interface TestResult extends Test {
    startTime: number;
    duration: number;
    assertViewResults: Array<AssertViewResultsSuccess>;
    meta: {
        [name: string]: unknown;
    };
    hermioneCtx: {
        assertViewResults: Array<AssertViewResultsSuccess>;
    };
    history: CommandHistory;
    err?: TestError;
}
export interface TestResultWithRetries extends TestResult {
    retriesLeft: number;
}
export interface GlobalHelper {
    ctx: Record<string, unknown>;
    skip: SkipController;
    only: OnlyController;
    browser: (browserName: string) => BrowserVersionController;
    config: ConfigController;
}
export interface AfterFileReadData {
    hermione: GlobalHelper;
    browser: string;
    file: string;
}
export interface BeforeFileReadData extends AfterFileReadData {
    testParser: TestParserAPI;
}
export type SyncSessionEventCallback = (browser: Browser, browserInfo: {
    browserId: string;
    browserVersion: string;
}) => void;
export type MasterEventHandler<T extends BaseHermione> = {
    (event: Events["INIT"], callback: () => Promise<void> | void): T;
    (event: Events["RUNNER_START"], callback: (runner: MainRunner) => Promise<void> | void): T;
    (event: Events["RUNNER_END"], callback: (result: StatsResult) => Promise<void> | void): T;
    (event: Events["SESSION_START"], callback: AsyncSessionEventCallback): T;
    (event: Events["SESSION_END"], callback: AsyncSessionEventCallback): T;
    (event: Events["EXIT"], callback: () => Promise<void> | void): T;
    (event: Events["NEW_WORKER_PROCESS"], callback: (suite: WorkerProcess) => void): T;
    (event: Events["SUITE_BEGIN"], callback: (suite: Suite) => void): T;
    (event: Events["SUITE_END"], callback: (suite: Suite) => void): T;
    (event: Events["TEST_BEGIN"], callback: (test: Test) => void): T;
    (event: Events["TEST_END"], callback: (test: TestResult) => void): T;
    (event: Events["TEST_PASS"], callback: (test: TestResult) => void): T;
    (event: Events["TEST_FAIL"], callback: (test: TestResult) => void): T;
    (event: Events["TEST_PENDING"], callback: (test: Test) => void): T;
    (event: Events["RETRY"], callback: (test: TestResultWithRetries) => void): T;
    (event: Events["CLI"], callback: (commander: commander.CommanderStatic) => void): T;
    (event: Events["BEGIN"], callback: () => void): T;
    (event: Events["END"], callback: () => void): T;
    (event: Events["BEFORE_FILE_READ"], callback: (data: BeforeFileReadData) => void): T;
    (event: Events["AFTER_FILE_READ"], callback: (data: AfterFileReadData) => void): T;
    (event: Events["AFTER_TESTS_READ"], callback: (collection: TestCollection) => void): T;
    (event: Events["INFO"], callback: () => void): T;
    (event: Events["WARNING"], callback: () => void): T;
    (event: Events["ERROR"], callback: (err: Error) => void): T;
    (event: Events["UPDATE_REFERENCE"], callback: (data: {
        state: string;
        refImg: ImageInfo;
    }) => void): T;
    (event: Events["NEW_BROWSER"], callback: SyncSessionEventCallback): T;
};
export type WorkerEventHandler<T extends BaseHermione> = {
    (event: Events["INIT"], callback: () => Promise<void> | void): T;
    (event: Events["BEFORE_FILE_READ"], callback: (data: BeforeFileReadData) => void): T;
    (event: Events["AFTER_FILE_READ"], callback: (data: AfterFileReadData) => void): T;
    (event: Events["AFTER_TESTS_READ"], callback: (collection: TestCollection) => void): T;
    (event: Events["UPDATE_REFERENCE"], callback: (data: {
        state: string;
        refImg: ImageInfo;
    }) => void): T;
    (event: Events["NEW_BROWSER"], callback: SyncSessionEventCallback): T;
};
