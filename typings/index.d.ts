/// <reference path='./global.d.ts' />
/// <reference path='./webdriverio/index.d.ts' />
/// <reference path='./mocha/index.d.ts' />
/// <reference path='./gemini-core/index.d.ts' />
/// <reference types='@gemini-testing/commander' />

class Hermione implements Hermione.Process {
    static create(configPath: string): Hermione;
    constructor(configPath: string);

    config: Hermione.Config;
    events: Hermione.EVENTS;
    errors: Hermione.Errors;

    isWorker(): false;
    intercept(event: Hermione.InterceptedEvent, handler: Hermione.InterceptHandler): this;
    extendCli(parser: commander.CommanderStatic): void;
    run(testPaths: Hermione.TestCollection | Array<string>, opts: Hermione.RunOpts): Promise<boolean>;
    addTestToRun(test: Hermione.Test, browserId: string): boolean;
    readTests(testPaths: Array<string>, opts: Hermione.ReadTestsOpts): Promise<Hermione.TestCollection>;
    isFailed(): boolean;
    halt<T extends Error>(err: T, timeout: number): void;

    on(event: Hermione.INIT_EVENT, callback: () => Promise<void> | void): this;
    on(event: Hermione.RUNNER_START_EVENT, callback: (runner: Hermione.MainRunner) => Promise<void> | void): this;
    on(event: Hermione.RUNNER_END_EVENT, callback: (result: Hermione.StatsResult) => Promise<void> | void): this;
    on(event: Hermione.SESSION_START_EVENT, callback: Hermione.AsyncSessionEventCallback): this;
    on(event: Hermione.SESSION_END_EVENT, callback: Hermione.AsyncSessionEventCallback): this;
    on(event: Hermione.EXIT_EVENT, callback: () => Promise<void> | void): this;

    on(event: Hermione.NEW_WORKER_PROCESS_EVENT, callback: (suite: Hermione.NewWorkerProcess) => void): this;
    on(event: Hermione.SUITE_BEGIN_EVENT, callback: (suite: Hermione.Suite) => void): this;
    on(event: Hermione.SUITE_END_EVENT, callback: (suite: Hermione.Suite) => void): this;
    on(event: Hermione.TEST_BEGIN_EVENT, callback: Hermione.TestEventCallback): this;
    on(event: Hermione.TEST_END_EVENT, callback: Hermione.TestEventCallback): this;
    on(event: Hermione.TEST_PASS_EVENT, callback: Hermione.TestEventCallback): this;
    on(event: Hermione.TEST_FAIL_EVENT, callback: Hermione.TestEventCallback): this;
    on(event: Hermione.TEST_PENDING_EVENT, callback: Hermione.TestEventCallback): this;
    on(event: Hermione.RETRY_EVENT, callback: (test: Hermione.TestWithRetriesLeft) => void): this;

    on(event: Hermione.CLI_EVENT, callback: (commander: commander.CommanderStatic) => void): this;
    on(event: Hermione.BEGIN_EVENT, callback: () => void): this;
    on(event: Hermione.END_EVENT, callback: () => void): this;
    on(event: Hermione.BEFORE_FILE_READ_EVENT, callback: (data: Hermione.BeforeFileReadData) => void): this;
    on(event: Hermione.AFTER_FILE_READ_EVENT, callback: (data: Hermione.AfterFileReadData) => void): this;
    on(event: Hermione.AFTER_TESTS_READ_EVENT, callback: (collection: Hermione.TestCollection) => void): this;
    on(event: Hermione.INFO_EVENT, callback: () => void): this;
    on(event: Hermione.WARNING_EVENT, callback: () => void): this;
    on(event: Hermione.ERROR_EVENT, callback: (err: Error) => void): this;

    once(event: Hermione.INIT_EVENT, callback: () => Promise<void> | void): this;
    once(event: Hermione.RUNNER_START_EVENT, callback: (runner: Hermione.MainRunner) => Promise<void> | void): this;
    once(event: Hermione.RUNNER_END_EVENT, callback: (result: Hermione.StatsResult) => Promise<void> | void): this;
    once(event: Hermione.SESSION_START_EVENT, callback: Hermione.AsyncSessionEventCallback): this;
    once(event: Hermione.SESSION_END_EVENT, callback: Hermione.AsyncSessionEventCallback): this;
    once(event: Hermione.EXIT_EVENT, callback: () => Promise<void> | void): this;

    once(event: Hermione.NEW_WORKER_PROCESS_EVENT, callback: (suite: Hermione.NewWorkerProcess) => void): this;
    once(event: Hermione.SUITE_BEGIN_EVENT, callback: (suite: Hermione.Suite) => void): this;
    once(event: Hermione.SUITE_END_EVENT, callback: (suite: Hermione.Suite) => void): this;
    once(event: Hermione.TEST_BEGIN_EVENT, callback: Hermione.TestEventCallback): this;
    once(event: Hermione.TEST_END_EVENT, callback: Hermione.TestEventCallback): this;
    once(event: Hermione.TEST_PASS_EVENT, callback: Hermione.TestEventCallback): this;
    once(event: Hermione.TEST_FAIL_EVENT, callback: Hermione.TestEventCallback): this;
    once(event: Hermione.TEST_PENDING_EVENT, callback: Hermione.TestEventCallback): this;
    once(event: Hermione.RETRY_EVENT, callback: (test: Hermione.TestWithRetriesLeft) => void): this;

    once(event: Hermione.CLI_EVENT, callback: (commander: commander.CommanderStatic) => void): this;
    once(event: Hermione.BEGIN_EVENT, callback: () => void): this;
    once(event: Hermione.END_EVENT, callback: () => void): this;
    once(event: Hermione.BEFORE_FILE_READ_EVENT, callback: (data: Hermione.BeforeFileReadData) => void): this;
    once(event: Hermione.AFTER_FILE_READ_EVENT, callback: (data: Hermione.AfterFileReadData) => void): this;
    once(event: Hermione.AFTER_TESTS_READ_EVENT, callback: (collection: Hermione.TestCollection) => void): this;
    once(event: Hermione.INFO_EVENT, callback: () => void): this;
    once(event: Hermione.WARNING_EVENT, callback: () => void): this;
    once(event: Hermione.ERROR_EVENT, callback: (err: Error) => void): this;
};

declare namespace Hermione {
    export interface Process extends GeminiCore.AsyncEmitter {
        config: Config;
        events: EVENTS;
        errors: Errors;

        isWorker(): boolean;
        intercept(event: InterceptedEvent, handler: InterceptHandler): this;

        on(event: INIT_EVENT, callback: () => Promise<void> | void): this;
        on(event: BEFORE_FILE_READ_EVENT, callback: (data: BeforeFileReadData) => void): this;
        on(event: AFTER_FILE_READ_EVENT, callback: (data: AfterFileReadData) => void): this;
        on(event: AFTER_TESTS_READ_EVENT, callback: (collection: TestCollection) => void): this;

        once(event: INIT_EVENT, callback: () => Promise<void> | void): this;
        once(event: BEFORE_FILE_READ_EVENT, callback: (data: BeforeFileReadData) => void): this;
        once(event: AFTER_FILE_READ_EVENT, callback: (data: AfterFileReadData) => void): this;
        once(event: AFTER_TESTS_READ_EVENT, callback: (collection: TestCollection) => void): this;
    };

    export interface Worker extends Process {
        init(): Promise<Array<unknown>>;
        runTest(fullTitle: string, opts: WorkerRunTestOpts): Promise<WorkerRunTestResult>;
        isWorker(): true;

        on(event: UPDATE_REFERENCE_EVENT, callback: (data: { state: string, refImg: ImageInfo }) => void): this;
        on(event: NEW_BROWSER_EVENT, callback: SyncSessionEventCallback): this;

        once(event: UPDATE_REFERENCE_EVENT, callback: (data: { state: string, refImg: ImageInfo }) => void): this;
        once(event: NEW_BROWSER_EVENT, callback: SyncSessionEventCallback): this;
    };

    export interface WorkerRunTestResult {
        meta: { [name: string]: unknown };
        hermioneCtx: WorkerRuntTestHermioneCtx;
    };

    export interface WorkerRuntTestHermioneCtx {
        assertViewResults: Array<AssertViewResultsSuccess>;
    };

    export interface AssertViewResultsSuccess {
        stateName: string;
        refImg: ImageInfo;
    };

    export interface ImageInfo {
        path: string;
        size: ImageSize;
    };

    export interface ImageSize {
        width: number;
        height: number;
    }

    export interface WorkerRunTestOpts {
        browserId: string;
        file: string;
        sessionId: string;
    };

    type InterceptHandler = (arg: InterceptHandlerArg) => InterceptHandlerArg | void;

    export interface InterceptHandlerArg {
        event?: InterceptedEvent;
        data?: unknown;
    };

    export interface RunOpts {
        browsers?: Array<string>;
        sets?: Array<string>;
        grep?: string | RegExp;
        updateRefs?: boolean;
        reporters?: Array<string>;
        inspectMode?: InspectMode;
    };

    export interface ReadTestsOpts {
        browsers?: Array<string>;
        sets?: Array<string>;
        grep?: string | RegExp;
        silent?: boolean;
        ignore?: string | Array<string>;
    };

    type InspectMode = {
        inpect: boolean | string;
        inspectBrk: boolean | string;
    };

    export interface Context {
        currentTest: Test;
    };

    export interface Suite extends Hermione.MochaSuite {
        id(): string;
        browserId: string;
        file: string;
        parent: Suite;
        pending: boolean;
        root: boolean;
        suites: Array<Suite>;
        tests: Array<Test>;
    };

    export interface RootSuite extends Suite {
        root: true;
    };

    export interface Hook extends Hermione.MochaRunnable {
        type: 'hook';
        parent?: Suite;
        ctx: Context;
        file: string;
        body: string;
    };

    export interface Test extends Hermione.MochaTest {
        id(): string;
        browserId: string;
        sessionId: string;
        err?: Error;
        file: string;
        body: string;
    };

    export interface TestWithRetriesLeft extends Test {
        retriesLeft: number;
    };

    export interface TestDefinition {
        (expectation: string, callback?: TestDefinitionCallback): Test;
    };

    type TestDefinitionCallback = (this: { browser: WebdriverIO.Client<void> }, done: TestDone) => any;

    interface TestDone {
        (error?: any): any;
    };

    export interface AfterFileReadData {
        hermione: GlobalHelper;
        browser: string;
        file: string;
    };

    export interface BeforeFileReadData extends AfterFileReadData {
        testParser: TestParserAPI;
    };

    export interface TestParserAPI {
        events: TEST_PARSER_API_EVENTS;

        setController(name: string, methods: { [method: string]: (...args: Array<unknown>) => void }): void;

        on(event: TEST_EVENT, callback: (test: Test) => void): this;
        on(event: SUITE_EVENT, callback: (suite: Suite) => void): this;
        on(event: HOOK_EVENT, callback: (hook: Hook) => void): this;

        once(event: TEST_EVENT, callback: (test: Test) => void): this;
        once(event: SUITE_EVENT, callback: (suite: Suite) => void): this;
        once(event: HOOK_EVENT, callback: (hook: Hook) => void): this;
    };

    export interface MainRunner extends GeminiCore.AsyncEmitter {
        init(): void;
        run(testCollection: TestCollection, stats: Stats): Promise<void>;
        addTestToRun(test: Test, browserId: string): boolean;
        cancel(): void;
        registerWorkers: RegisterWorkers;
    };

    export type RegisterWorkers = <T extends string>(workerFilepath: string, exportedMethods: ReadonlyArray<T>) => {
        [K in typeof exportedMethods[number]]: (...args: Array<unknown>) => Promise<unknown> | unknown
    };

    export interface Stats {
        addPassed(test: Test): void;
        addFailed(test: Test): void;
        addSkipped(test: Test): void;
        addRetries(test: Test): void;

        getResult(): StatsResult;
    };

    export interface StatsResult {
        total: number;
        updated: number;
        passed: number;
        failed: number;
        retries: number;
        skipped: number;
        perBrowser: Omit<StatsResult, 'perBrowser'>;
    };

    export interface NewWorkerProcess {
        send(...args: Array<unknown>): boolean;
    };

    export interface GlobalHelper {
        ctx: { [name: string]: unknown };
        skip: SkipBuilder;
        only: OnlyBuilder;
        browser: (browserName: string) => BrowserConfigurator
        config: ConfigController;
    };

    export interface SkipBuilder {
        in(browserMatcher: string | RegExp | Array<string | RegExp>, comment?: string, opts?: SkipOpts): SkipBuilder;
        notIn(browserMatcher: string | RegExp | Array<string | RegExp>, comment?: string, opts?: SkipOpts): SkipBuilder;
    };

    export interface OnlyBuilder {
        in(browserMatcher: string | RegExp | Array<string | RegExp>): OnlyBuilder;
        notIn(browserMatcher: string | RegExp | Array<string | RegExp>): OnlyBuilder;
    };

    export interface BrowserConfigurator {
        version(browserVersion: string): BrowserConfigurator;
    };

    export interface SkipOpts {
        negate?: boolean;
        silent?: boolean;
    };

    export interface ConfigController {
        testTimeout(timeout: number): void;
    };

    export interface CommonConfig {
        configPath: string;
        desiredCapabilities: WebdriverIO.DesiredCapabilities | null;
        gridUrl: string;
        baseUrl: string;
        sessionsPerBrowser: number;
        testsPerSession: number;
        retry: number;
        shouldRetry(testInfo: {ctx: Test, retriesLeft: number }): boolean | null;
        httpTimeout: number;
        urlHttpTimeout: number | null;
        pageLoadTimeout: number | null;
        sessionRequestTimeout: number | null;
        sessionQuitTimeout: number | null;
        testTimeout: number | null;
        waitTimeout: number;
        saveHistoryOnTestTimeout: boolean;
        saveHistoryOnError: boolean;
        screenshotOnReject: boolean;
        screenshotOnRejectTimeout: number | null;
        prepareBrowser(browser: WebdriverIO.Client<void>): void | null;
        screenshotPath: string | null;
        screenshotsDir(test: Test): string;
        calibrate: boolean;
        compositeImage: boolean;
        strictTestsOrder: boolean;
        screenshotMode: 'fullpage' | 'viewport' | 'auto';
        screenshotDelay: number;
        tolerance: number;
        antialiasingTolerance: number;
        compareOpts: CompareOptsConfig;
        buildDiffOpts: BuildDiffOptsConfig;
        assertViewOpts: AssertViewOptsConfig;
        meta: { [name: string]: unknown };
        windowSize: string | { width: number, height: number } | null;
        orientation: 'landscape' | 'portrait' | null;
        resetCursor: boolean;

        system: SystemConfig;
    };

    export interface CompareOptsConfig {
        shouldCluster: boolean;
        clustersSize: number;
        stopOnFirstFail: boolean;
    };

    export interface BuildDiffOptsConfig {
        ignoreAntialiasing: boolean;
        ignoreCaret: boolean;
    };

    export interface AssertViewOptsConfig {
        /**
         * DOM-node selectors which will be ignored (painted with a black rectangle) when comparing images.
         *
         * @defaultValue `[]`
         */
        ignoreElements: string | Array<string>;
        /**
         * Ability to set capture element from the top area or from current position.
         *
         * @remarks
         * In the first case viewport will be scrolled to the top of the element.
         *
         * @defaultValue `true`
         */
        captureElementFromTop: boolean;
        /**
         * Disables check that element is outside of the viewport left, top, right or bottom bounds.
         *
         * @remarks
         * By default Hermione throws an error if element is outside the viewport bounds. This option disables this behaviour.
         * If option set to `true` then only visible part of the element will be captured.
         * But if set browser option {@link https://github.com/gemini-testing/hermione#compositeimage compositeImage} with `true` value,
         * then in the resulting screenshot will appear the whole element with not visible parts outside of the viewport bottom bound.
         *
         * @defaultValue `false`
         */
        allowViewportOverflow: boolean;
    };

    export interface AssertViewOpts extends Partial<AssertViewOptsConfig> {
        /**
         * Maximum allowed difference between colors.
         * Overrides config {@link https://github.com/gemini-testing/hermione#browsers browsers}.{@link https://github.com/gemini-testing/hermione#tolerance tolerance} value.
         *
         * @remarks
         * Indicates maximum allowed CIEDE2000 difference between colors. Used only in non-strict mode.
         * Increasing global default is not recommended, prefer changing tolerance for particular suites or states instead.
         * By default it's 2.3 which should be enough for the most cases.
         *
         * @defaultValue `2.3`
         */
        tolerance?: number;
        /**
         * Minimum difference in brightness (zero by default) between the darkest/lightest pixel (which is adjacent to the antialiasing pixel) and theirs adjacent pixels.
         * Overrides config {@link https://github.com/gemini-testing/hermione#browsers browsers}.{@link https://github.com/gemini-testing/hermione#antialiasingTolerance antialiasingTolerance} value.
         *
         * @remarks
         * Read more about this option in {@link https://github.com/gemini-testing/looks-same#comparing-images-with-ignoring-antialiasing looks-same}
         *
         * @defaultValue `0`
         */
        antialiasingTolerance?: number;
        /**
         * Allows testing of regions which bottom bounds are outside of a viewport height.
         * Overrides config {@link https://github.com/gemini-testing/hermione#browsers browsers}.{@link https://github.com/gemini-testing/hermione#compositeImage compositeImage} value.
         *
         * @remarks
         * In the resulting screenshot the area which fits the viewport bounds will be joined with the area which is outside of the viewport height.
         *
         * @defaultValue `false`
         */
        compositeImage?: boolean;
        /**
         * Allows to specify a delay (in milliseconds) before making any screenshot.
         * Overrides config {@link https://github.com/gemini-testing/hermione#browsers browsers}.{@link https://github.com/gemini-testing/hermione#screenshotDelay screenshotDelay} value.
         *
         * @remarks
         * This is useful when the page has elements which are animated or if you do not want to screen a scrollbar.
         *
         * @defaultValue `0`
         */
        screenshotDelay?: number;
    };

    export interface SystemConfig {
        debug: boolean;
        mochaOpts: MochaOpts;
        ctx: { [name: string]: unknown };
        patternsOnReject: Array<string>;
        workers: number;
        testsPerWorker: number;
        diffColor: string;
        tempDir: string;
        parallelLimit: number;
        fileExtensions: Array<string>;
    };

    export interface MochaOpts {
        /** milliseconds to wait before considering a test slow. */
        slow?: number;

        /** timeout in milliseconds or time string like '1s'. */
        timeout?: number;

        /** string or regexp to filter tests with. */
        grep?: string | RegExp;
    };

    export interface Config extends CommonConfig {
        browsers: { [name: string]: BrowserConfig };
        plugins: { [name: string]: unknown };
        sets: SetsConfig;

        prepareEnvironment(): void | null;
        forBrowser(id: string): BrowserConfig;
        getBrowserIds(): Array<string>;
        serialize(): Omit<Config, 'system'>;
        mergeWith(config: Config): void;
    };

    export interface SetsConfig {
        files: string | Array<string>;
        ignoreFiles: Array<string>;
        browsers: Array<string>;
    };

    export interface BrowserConfig extends CommonConfig {
        id: string;
        getScreenshotPath(test: Test, stateName: string): string;
        serialize(): Omit<BrowserConfig, 'system'>;
    };

    // async events
    export type INIT_EVENT = 'init';
    export type RUNNER_START_EVENT = 'startRunner';
    export type RUNNER_END_EVENT = 'endRunner';
    export type SESSION_START_EVENT = 'startSession';
    export type SESSION_END_EVENT = 'endSession';
    export type EXIT_EVENT = 'exit';

    // sync events
    export type CLI_EVENT = 'cli';
    export type BEGIN_EVENT = 'begin';
    export type END_EVENT = 'end';
    export type BEFORE_FILE_READ_EVENT = 'beforeFileRead';
    export type AFTER_FILE_READ_EVENT = 'afterFileRead';
    export type AFTER_TESTS_READ_EVENT = 'afterTestsRead';
    export type INFO_EVENT = 'info';
    export type WARNING_EVENT = 'warning';
    export type ERROR_EVENT = 'err';

    // runner sync events
    export type NEW_WORKER_PROCESS_EVENT = 'newWorkerProcess';
    export type SUITE_BEGIN_EVENT = 'beginSuite';
    export type SUITE_END_EVENT = 'endSuite';
    export type TEST_BEGIN_EVENT = 'beginTest';
    export type TEST_END_EVENT = 'endTest';
    export type TEST_PASS_EVENT = 'passTest';
    export type TEST_FAIL_EVENT = 'failTest';
    export type TEST_PENDING_EVENT = 'pendingTest';
    export type RETRY_EVENT = 'retry';
    export type NEW_BROWSER_EVENT = 'newBrowser';
    export type UPDATE_REFERENCE_EVENT = 'updateReference';

    // test parser api events
    export type TEST_EVENT = 'test';
    export type SUITE_EVENT = 'suite';
    export type HOOK_EVENT = 'hook';

    export interface EVENTS {
        INIT: INIT_EVENT;
        RUNNER_START: RUNNER_START_EVENT;
        RUNNER_END: RUNNER_END_EVENT;
        SESSION_START: SESSION_START_EVENT;
        SESSION_END: SESSION_END_EVENT;
        EXIT: EXIT_EVENT;
        NEW_WORKER_PROCESS: NEW_WORKER_PROCESS_EVENT;
        SUITE_BEGIN: SUITE_BEGIN_EVENT;
        SUITE_END: SUITE_END_EVENT;
        TEST_BEGIN: TEST_BEGIN_EVENT;
        TEST_END: TEST_END_EVENT;
        TEST_PASS: TEST_PASS_EVENT;
        TEST_FAIL: TEST_FAIL_EVENT;
        TEST_PENDING: TEST_PENDING_EVENT;
        RETRY: RETRY_EVENT;
        CLI: CLI_EVENT;
        BEGIN: BEGIN_EVENT;
        END: END_EVENT;
        BEFORE_FILE_READ: BEFORE_FILE_READ_EVENT;
        AFTER_FILE_READ: AFTER_FILE_READ_EVENT;
        AFTER_TESTS_READ: AFTER_TESTS_READ_EVENT;
        INFO: INFO_EVENT;
        WARNING: WARNING_EVENT;
        ERROR: ERROR_EVENT;
        UPDATE_REFERENCE: UPDATE_REFERENCE_EVENT;
        NEW_BROWSER: NEW_BROWSER_EVENT;
    };

    export interface TEST_PARSER_API_EVENTS {
        TEST: TEST_EVENT;
        SUITE: SUITE_EVENT;
        HOOK: HOOK_EVENT;
    };

    export type MasterEvent =
        | INIT_EVENT
        | RUNNER_START_EVENT
        | RUNNER_END_EVENT
        | SESSION_START_EVENT
        | SESSION_END_EVENT
        | EXIT_EVENT
        | NEW_WORKER_PROCESS_EVENT
        | SUITE_BEGIN_EVENT
        | SUITE_END_EVENT
        | TEST_BEGIN_EVENT
        | TEST_END_EVENT
        | TEST_PASS_EVENT
        | TEST_FAIL_EVENT
        | TEST_PENDING_EVENT
        | RETRY_EVENT
        | CLI_EVENT
        | BEGIN_EVENT
        | END_EVENT
        | BEFORE_FILE_READ_EVENT
        | AFTER_FILE_READ_EVENT
        | AFTER_TESTS_READ_EVENT
        | INFO_EVENT
        | WARNING_EVENT
        | ERROR_EVENT;

    export type WorkerEvent =
        | INIT_EVENT
        | BEFORE_FILE_READ_EVENT
        | AFTER_FILE_READ_EVENT
        | AFTER_TESTS_READ_EVENT
        | NEW_BROWSER_EVENT
        | UPDATE_REFERENCE_EVENT;

    export type InterceptedEvent =
        | SUITE_BEGIN_EVENT
        | SUITE_END_EVENT
        | TEST_END_EVENT
        | TEST_END_EVENT
        | TEST_PASS_EVENT
        | TEST_FAIL_EVENT
        | RETRY_EVENT;

    export type TestParserAPIEvent =
        | TEST_EVENT
        | SUITE_EVENT
        | HOOK_EVENT;

    export interface Errors {
        AssertViewError: AssertViewError;
        ImageDiffError: ImageDiffError;
        NoRefImageError: NoRefImageError;
    };

    export class AssertViewError extends Error {
        constructor(message: string);
    };

    export class ImageDiffError {
        static create(stateName: string, currImg: ImageInfo, refImg: ImageInfo, diffOpts: unknown, diffAreas: unknown): ImageDiffError; // TODO: export types from looks-same
        static fromObject(data: { stateName: string, currImg: ImageInfo, refImg: ImageInfo, diffOpts: unknown, diffAreas: unknown }): ImageDiffError;
        constructor(stateName: string, currImg: ImageInfo, refImg: ImageInfo, diffOpts: unknown, diffAreas: unknown);

        saveDiffTo(diffPath: string): void;
    };

    export class NoRefImageError {
        static create(stateName: string, currImg: ImageInfo, refImg: ImageInfo): NoRefImageError;
        static fromObject(data: { stateName: string, currImg: ImageInfo, refImg: ImageInfo }): NoRefImageError;
        constructor(stateName: string, currImg: ImageInfo, refImg: ImageInfo);
    };

    export interface TestCollection {
        getRootSuite(browserId: string): RootSuite;
        eachRootSuite(callback: (root: RootSuite, browserId: string) => void): void;

        getBrowsers(): string[];

        mapTests<T extends unknown>(callback: TestsCallback<T>): Array<T>;
        mapTests<T extends unknown>(browserId: string, callback: TestsCallback<T>): Array<T>;

        sortTests(callback: SortTestsCallback): TestCollection;
        sortTests(browserId: string, callback: SortTestsCallback): TestCollection;

        eachTest(callback: TestsCallback<void>): void;
        eachTest(browserId: string, callback: TestsCallback<void>): void;

        eachTestByVersions(browserId: string, callback: (test: Test, browserId: string, browserVersion: string) => void): void;

        disableAll(browserId: string): TestCollection;
        disableTest(fullTitle: string, browserId?: string): TestCollection;

        enableAll(browserId?: string): TestCollection;
        enableTest(fullTitle: string, browserId?: string): TestCollection;
    };

    export type TestsCallback<T extends unknown> = (test: Test, browserId: string) => T;
    export type SortTestsCallback = (test1: Test, test2: Test) => boolean;

    export interface BrowserMeta {
        pid: number;
        browserVersion: string,
        [name: string]: unknown;
    };

    export interface BrowserInfo {
        browserId: string;
        sessionId: string;
    };

    export type AsyncSessionEventCallback = (browser: WebdriverIO.Client<void>, browserInfo: BrowserInfo) => Promise<void> | void;
    export type SyncSessionEventCallback = (browser: WebdriverIO.Client<void>, browserInfo: { browserId: string, browserVersion: string}) => void;
    export type TestEventCallback = (test: Test) => void;
};

declare module "hermione" {
    export = Hermione;
}
