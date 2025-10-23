import type { Events } from "../events";
import type { MainRunner as NodejsEnvRunner } from "../runner";
import type { MainRunner as BrowserEnvRunner } from "../runner/browser-env/index";
import type { TestCollection } from "../test-collection";
import type { Test } from "../test-reader/test-object/test";
import type { Suite } from "../test-reader/test-object/suite";
import type { TestParserAPI } from "../test-reader/test-parser-api";
import type { StatsResult } from "../stats";
import type { ConfigController } from "../test-reader/controllers/config-controller";
import type { OnlyController } from "../test-reader/controllers/only-controller";
import type { SkipController } from "../test-reader/controllers/skip-controller";
import type { AlsoController } from "../test-reader/controllers/also-controller";
import type { BrowserVersionController } from "../test-reader/controllers/browser-version-controller";
import type { WorkerProcess } from "../utils/worker-process";
import type { BaseTestplane } from "../base-testplane";
import type { CoordBounds, LooksSameOptions } from "looks-same";
import type { eventWithTime as RrwebEvent } from "@rrweb/types";
import type { runGroup } from "../browser/history";

export type { Test } from "../test-reader/test-object/test";
export type { Suite } from "../test-reader/test-object/suite";
export type { TestFunction, TestFunctionCtx } from "../test-reader/test-object/types";

export type WdioBrowser = WebdriverIO.Browser;

export interface RootSuite extends Suite {
    root: true;
}

export interface BrowserInfo {
    browserId: string;
    sessionId: string;
}

export type AsyncSessionEventCallback = (
    browser: WebdriverIO.Browser,
    browserInfo: BrowserInfo,
) => Promise<void> | void;

export interface ImageSize {
    width: number;
    height: number;
}

export interface ImageBase64 {
    base64: string;
    size: ImageSize;
}

export interface ErrorDetails {
    title: string;
    data?: unknown;
    filePath: string;
}

export interface TestError extends Error {
    screenshot?: ImageBase64;
    details: ErrorDetails;
}

export interface ImageInfo {
    path: string;
    size: ImageSize;
}

export interface RefImageInfo extends ImageInfo {
    relativePath: string;
}

export interface DiffOptions extends LooksSameOptions {
    diff: string;
    current: string;
    reference: string;
    diffColor: string;
}

export interface AssertViewResultSuccess {
    refImg: RefImageInfo;
    stateName: string;
}

export interface AssertViewResultDiff {
    currImg: ImageInfo;
    diffBuffer?: ArrayBuffer;
    diffClusters: CoordBounds[];
    diffOpts: DiffOptions;
    message: string;
    name: "ImageDiffError";
    refImg: RefImageInfo;
    stack: string;
    stateName: string;
    differentPixels: number;
    diffRatio: number;
}

export interface AssertViewResultNoRefImage {
    currImg: ImageInfo;
    message: string;
    name: "NoRefImageError";
    refImg: RefImageInfo;
    stack: string;
    stateName: string;
}

export type AssertViewResult = AssertViewResultSuccess | AssertViewResultDiff | AssertViewResultNoRefImage;

export enum TestStepKey {
    Name = "n",
    Args = "a",
    Scope = "s",
    Duration = "d",
    TimeStart = "ts",
    TimeEnd = "te",
    IsOverwritten = "o",
    IsGroup = "g",
    IsFailed = "f",
    Children = "c",
    Key = "k",
}

export interface TestStep {
    [TestStepKey.Name]: string;
    [TestStepKey.Args]: string[];
    [TestStepKey.TimeStart]: number;
    [TestStepKey.TimeEnd]: number;
    [TestStepKey.Duration]: number;
    [TestStepKey.Scope]: "b" | "e";
    [TestStepKey.Children]: TestStep[];
    [TestStepKey.Key]: symbol;
    [TestStepKey.IsOverwritten]: boolean;
    [TestStepKey.IsGroup]: boolean;
    [TestStepKey.IsFailed]: boolean;
}

export interface ExecutionThreadToolCtx {
    assertViewResults: {
        add: (result: AssertViewResult) => void;
        hasFails: () => boolean;
        hasState: (stateName: string) => boolean;
        toRawObject: () => Array<AssertViewResult>;
        get: () => Array<AssertViewResult>;
    };
}

export interface ExecutionThreadCtx {
    browser: WebdriverIO.Browser;
    currentTest: Test;
    attempt: number;
}

export interface TestResult extends Test {
    assertViewResults: Array<AssertViewResult>;
    description?: string;
    duration: number;
    err?: TestError;
    testplaneCtx: ExecutionThreadToolCtx;
    /**
     * @deprecated Use `testplaneCtx` instead
     */
    hermioneCtx: ExecutionThreadToolCtx;
    /** @note history is not available for skipped tests */
    history?: TestStep[];
    meta: { [name: string]: unknown };
    sessionId: string;
    startTime: number;
}

export interface TestResultWithRetries extends TestResult {
    retriesLeft: number;
}

/**
 * @deprecated Use `TestplaneCtx` instead
 */
export interface HermioneCtx extends Record<string, unknown> {}

export interface TestplaneCtx extends HermioneCtx {}

export interface GlobalHelper {
    ctx: TestplaneCtx;
    skip: SkipController;
    only: OnlyController;
    also: AlsoController;
    browser: (browserName: string) => BrowserVersionController;
    config: ConfigController;
}

export interface AfterFileReadData {
    testplane: GlobalHelper;
    /**
     * @deprecated Use `testplane` instead
     */
    hermione: GlobalHelper;
    browser: string;
    file: string;
}

export interface BeforeFileReadData extends AfterFileReadData {
    testParser: TestParserAPI;
}

export interface BrowserHistory {
    runGroup: typeof runGroup;
}

export type SyncSessionEventCallback = (
    browser: WebdriverIO.Browser,
    browserInfo: { browserId: string; browserVersion: string },
) => void;

export interface TestContext {
    testPath: string[];
    browserId: string;
}

export interface SnapshotsData {
    rrwebSnapshots: RrwebEvent[];
}

export type MasterEventHandler<T extends BaseTestplane> = {
    (event: Events["INIT"], callback: () => Promise<void> | void): T;
    (event: Events["RUNNER_START"], callback: (runner: NodejsEnvRunner | BrowserEnvRunner) => Promise<void> | void): T;
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
    (event: Events["DOM_SNAPSHOTS"], callback: (context: TestContext, data: SnapshotsData) => void): T;

    (event: Events["CLI"], callback: (commander: commander.CommanderStatic) => void): T;
    (event: Events["BEGIN"], callback: () => void): T;
    (event: Events["END"], callback: () => void): T;
    (event: Events["BEFORE_FILE_READ"], callback: (data: BeforeFileReadData) => void): T;
    (event: Events["AFTER_FILE_READ"], callback: (data: AfterFileReadData) => void): T;
    (event: Events["AFTER_TESTS_READ"], callback: (collection: TestCollection) => void): T;
    (event: Events["INFO"], callback: () => void): T;
    (event: Events["WARNING"], callback: () => void): T;
    (event: Events["ERROR"], callback: (err: Error) => void): T;

    (event: Events["UPDATE_REFERENCE"], callback: (data: { state: string; refImg: RefImageInfo }) => void): T;
    (event: Events["NEW_BROWSER"], callback: SyncSessionEventCallback): T;
};

export type WorkerEventHandler<T extends BaseTestplane> = {
    (event: Events["INIT"], callback: () => Promise<void> | void): T;
    (event: Events["BEFORE_FILE_READ"], callback: (data: BeforeFileReadData) => void): T;
    (event: Events["AFTER_FILE_READ"], callback: (data: AfterFileReadData) => void): T;
    (event: Events["AFTER_TESTS_READ"], callback: (collection: TestCollection) => void): T;

    (event: Events["UPDATE_REFERENCE"], callback: (data: { state: string; refImg: RefImageInfo }) => void): T;
    (event: Events["NEW_BROWSER"], callback: SyncSessionEventCallback): T;
};

export type CookieSameSite = "Strict" | "Lax" | "None";
export type CookiePriority = "Low" | "Medium" | "High";
export type CookieSourceScheme = "Unset" | "NonSecure" | "Secure";

// copy from devtools-protocol/Protocol.Network.CookieParam
export type Cookie = {
    name: string;
    value: string;
    url?: string;
    domain?: string;
    path?: string;
    secure?: boolean;
    httpOnly?: boolean;
    sameSite?: CookieSameSite;
    expires?: number;
    priority?: CookiePriority;
    sameParty?: boolean;
    sourceScheme?: CookieSourceScheme;
    sourcePort?: number;
    partitionKey?: string;
};
