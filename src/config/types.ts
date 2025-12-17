import type { BrowserConfig } from "./browser-config";
import type { BrowserTestRunEnvOptions } from "../runner/browser-env/vite/types";
import type { Test } from "../types";
import type { ChildProcessWithoutNullStreams } from "child_process";
import type { RequestOptions } from "https";
import type { Config } from "./index";
import type { SelectivityCompressionType } from "../browser/cdp/selectivity/types";

export interface CompareOptsConfig {
    shouldCluster: boolean;
    clustersSize: number;
    stopOnFirstFail: boolean;
}

export interface BuildDiffOptsConfig {
    ignoreAntialiasing: boolean;
    ignoreCaret: boolean;
}

export interface AssertViewOpts {
    /**
     * DOM-node selectors which will be ignored (painted with a black rectangle) when comparing images.
     *
     * @defaultValue `[]`
     */
    ignoreElements?: string | Array<string>;
    /**
     * Ability to set capture element from the top area or from current position.
     *
     * @remarks
     * In the first case viewport will be scrolled to the top of the element.
     *
     * @defaultValue `true`
     */
    captureElementFromTop?: boolean;
    /**
     * Disables check that element is outside of the viewport left, top, right or bottom bounds.
     *
     * @remarks
     * By default Testplane throws an error if element is outside the viewport bounds.
     * This option disables check that element is outside of the viewport left, top, right or bottom bounds.
     * And in this case if browser option {@link https://github.com/gemini-testing/testplane#compositeimage compositeImage} set to `false`, then only visible part of the element will be captured.
     * But if {@link https://github.com/gemini-testing/testplane#compositeimage compositeImage} set to `true` (default), then in the resulting screenshot will appear the whole element with not visible parts outside of the bottom bounds of viewport.
     *
     * @defaultValue `false`
     */
    allowViewportOverflow?: boolean;
    /**
     * Maximum allowed difference between colors.
     * Overrides config {@link https://github.com/gemini-testing/testplane#browsers browsers}.{@link https://github.com/gemini-testing/testplane#tolerance tolerance} value.
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
     * Overrides config {@link https://github.com/gemini-testing/testplane#browsers browsers}.{@link https://github.com/gemini-testing/testplane#antialiasingTolerance antialiasingTolerance} value.
     *
     * @remarks
     * Read more about this option in {@link https://github.com/gemini-testing/looks-same#comparing-images-with-ignoring-antialiasing looks-same}
     *
     * @defaultValue `4`
     */
    antialiasingTolerance?: number;
    /**
     * Allows testing of regions which bottom bounds are outside of a viewport height.
     * Overrides config {@link https://github.com/gemini-testing/testplane#browsers browsers}.{@link https://github.com/gemini-testing/testplane#compositeImage compositeImage} value.
     *
     * @remarks
     * In the resulting screenshot the area which fits the viewport bounds will be joined with the area which is outside of the viewport height.
     *
     * @defaultValue `true`
     */
    compositeImage?: boolean;
    /**
     * Allows to specify a delay (in milliseconds) before making any screenshot.
     * Overrides config {@link https://github.com/gemini-testing/testplane#browsers browsers}.{@link https://github.com/gemini-testing/testplane#screenshotDelay screenshotDelay} value.
     *
     * @remarks
     * This is useful when the page has elements which are animated or if you do not want to screen a scrollbar.
     *
     * @defaultValue `0`
     */
    screenshotDelay?: number;
    /**
     * Ability to set DOM-node selector which should be scroll when the captured element does not completely fit on the screen.
     *
     * @remarks
     * Useful when you capture the modal (popup). In this case a duplicate of the modal appears on the screenshot.
     * That happens because we scroll the page using `window` selector, which scroll only the background of the modal, and the modal itself remains in place.
     * Default value is `undefined` (it means scroll relative to `window`). Works only when `compositeImage` is `true` (default).
     *
     * @defaultValue `undefined`
     */
    selectorToScroll?: string;
    /**
     * Ability to disable animations and transitions while making a screenshot
     *
     * @remarks
     * Usefull when you capture screenshot of a page, having animations and transitions.
     * Iframe animations are only disabled when using webdriver protocol.
     *
     * @defaultValue `true`
     */
    disableAnimation?: boolean;
    /**
     * Ability to ignore a small amount of different pixels to classify screenshots as being "identical"
     *
     * @example 5
     * @example '1.5%'
     *
     * @remarks
     * Useful when you encounter a few pixels difference that cannot be eliminated using the tolerance and antialiasingTolerance settings.
     *
     * @note
     * This should be considered a last resort and only used in small number of cases where necessary.
     *
     * @defaultValue `0`
     */
    ignoreDiffPixelCount?: `${number}%` | number;
    /**
     * Ability to wait for page to be fully ready before making screenshot.
     * This ensures (in following order):
     * - no script is running at the moment;
     * - fonts are no longer loading
     * - images are no longer loading
     * - external styles are loaded
     * - external scripts are no longer loading
     *
     * @remarks
     * If page is still not ready after non-zero timeout, there would only be a warning about it, no error is thrown.
     *
     * @note
     * Setting it to zero disables waiting for page to be ready.
     */
    waitForStaticToLoadTimeout?: number;
}

export interface ExpectOptsConfig {
    wait: number;
    interval: number;
}

// copied from Mocha.MochaOptions (cannot be used directly so that there are no conflicts in global variables)
export interface MochaOpts {
    /** Propagate uncaught errors? */
    allowUncaught?: boolean;

    /** Force `done` callback or promise? */
    asyncOnly?: boolean;

    /** bail on the first test failure. */
    bail?: boolean;

    /** Check for global variable leaks? */
    checkLeaks?: boolean;

    /** Color TTY output from reporter */
    color?: boolean;

    /** Delay root suite execution? */
    delay?: boolean;

    /** Show diff on failure? */
    diff?: boolean;

    /** Report tests without running them? */
    dryRun?: boolean;

    /** Test filter given string. */
    fgrep?: string;

    /** Tests marked `only` fail the suite? */
    forbidOnly?: boolean;

    /** Pending tests fail the suite? */
    forbidPending?: boolean;

    /** Full stacktrace upon failure? */
    fullTrace?: boolean;

    /** Variables expected in global scope. */
    globals?: string[];

    /** Test filter given regular expression. */
    grep?: string | RegExp;

    /** Enable desktop notifications? */
    growl?: boolean;

    /** Display inline diffs? */
    inlineDiffs?: boolean;

    /** Invert test filter matches? */
    invert?: boolean;

    /** Disable syntax highlighting? */
    noHighlighting?: boolean;

    /** Reporter name or constructor. */
    reporter?: string;

    /** Reporter settings object. */
    reporterOptions?: unknown;

    /** Number of times to retry failed tests. */
    retries?: number;

    /** Slow threshold value. */
    slow?: number;

    /** Timeout threshold value. */
    timeout?: number | string;

    /** Run jobs in parallel */
    parallel?: boolean;

    /** Max number of worker processes for parallel runs. */
    jobs?: number;

    /** Hooks to bootstrap the root suite with. */
    rootHooks?: unknown;

    /** Pathname of `rootHooks` plugin for parallel runs. */
    require?: string[];

    /** Should be `true` if `Mocha` process is running in a worker process. */
    isWorker?: boolean;

    /** Interface name or path to file with custom interface implementation. */
    ui?: string | ((suite: unknown) => void);
}

export interface SystemConfig {
    debug: boolean;
    mochaOpts: MochaOpts;
    expectOpts: ExpectOptsConfig;
    ctx: { [name: string]: unknown };
    patternsOnReject: Array<string | RegExp>;
    workers: number;
    testsPerWorker: number;
    diffColor: string;
    tempDir: string;
    parallelLimit: number;
    fileExtensions: Array<string>;
    testRunEnv: "nodejs" | "browser" | ["browser", BrowserTestRunEnvOptions];
}

type ReadinessProbeIsReadyFn = (response: Awaited<ReturnType<typeof globalThis.fetch>>) => boolean | Promise<boolean>;

type ReadinessProbeFn = (childProcess: ChildProcessWithoutNullStreams) => Promise<void>;

type ReadinessProbeObj = {
    url: string | null;
    isReady: ReadinessProbeIsReadyFn | null;
    timeouts: {
        waitServerTimeout: number;
        probeRequestTimeout: number;
        probeRequestInterval: number;
    };
};

type ReadinessProbe = ReadinessProbeFn | ReadinessProbeObj;

export enum TimeTravelMode {
    // Record and save all test runs
    On = "on",
    // Do not record any test runs
    Off = "off",
    // Record and save all retries
    RetriesOnly = "retries-only",
    // Record all test runs, but save only last failed run
    LastFailedRun = "last-failed-run",
}

export interface TimeTravelConfig {
    mode: TimeTravelMode;
}

/**
 * @param {Object} dependency - Object with dependency scope and posix relative path
 * @param {"browser"|"testplane"|string} dependency.scope - Dependency scope
 * @param {string} dependency.relativePath - POSIX relative path
 * @returns {string|void} Updated POSIX relative path or falsy value, if dependency should be ignored.
 */
type SelectivityMapDependencyRelativePathFn = (dependency: {
    scope: "browser" | "testplane" | (string & NonNullable<unknown>);
    relativePath: string;
}) => string | void;

export interface CommonConfig {
    configPath?: string;
    automationProtocol: "webdriver" | "devtools";
    desiredCapabilities: WebdriverIO.Capabilities | null;
    sessionEnvFlags: Record<
        "isW3C" | "isChrome" | "isMobile" | "isIOS" | "isAndroid" | "isSauce" | "isSeleniumStandalone",
        boolean
    >;
    gridUrl: string;
    baseUrl: string;
    sessionsPerBrowser: number;
    testsPerSession: number;
    retry: number;
    shouldRetry(testInfo: { ctx: Test; retriesLeft: number }): boolean | null;
    httpTimeout: number;
    urlHttpTimeout: number | null;
    pageLoadTimeout: number | null;
    sessionRequestTimeout: number | null;
    sessionQuitTimeout: number | null;
    testTimeout: number | null;
    waitTimeout: number;
    waitInterval: number;
    saveHistoryMode: "all" | "none" | "onlyFailed";
    takeScreenshotOnFails: {
        testFail: boolean;
        assertViewFail: boolean;
    };
    takeScreenshotOnFailsTimeout: number | null;
    takeScreenshotOnFailsMode: "fullpage" | "viewport";
    prepareBrowser(browser: WebdriverIO.Browser): void | null;
    screenshotPath: string | null;
    screenshotsDir(test: Test): string;
    calibrate: boolean;
    compositeImage: boolean;
    strictTestsOrder: boolean;
    screenshotMode: "fullpage" | "viewport" | "auto";
    screenshotDelay: number;
    tolerance: number;
    antialiasingTolerance: number;
    compareOpts: CompareOptsConfig;
    buildDiffOpts: BuildDiffOptsConfig;
    assertViewOpts: AssertViewOpts;
    expectOpts: ExpectOptsConfig;
    meta: { [name: string]: unknown };
    windowSize: { width: number; height: number } | `${number}x${number}` | null;
    orientation: "landscape" | "portrait" | null;
    resetCursor: boolean;
    headers: Record<string, string> | null;

    transformRequest: (req: RequestOptions) => RequestOptions;
    transformResponse: (res: Response, req: RequestOptions) => Response;

    strictSSL: boolean | null;
    user: string | null;
    key: string | null;
    region: string | null;

    system: SystemConfig;
    headless: "old" | "new" | boolean | null;
    isolation: boolean;
    passive: boolean;

    lastFailed: {
        only: boolean;
        input: string | Array<string>;
        output: string;
    };

    openAndWaitOpts: {
        timeout?: number;
        waitNetworkIdle: boolean;
        waitNetworkIdleTimeout: number;
        failOnNetworkError: boolean;
        ignoreNetworkErrorsPatterns: Array<RegExp | string>;
    };

    devServer: {
        command: string | null;
        cwd: string | null;
        env: Record<string, string>;
        args: Array<string>;
        logs: boolean;
        readinessProbe: ReadinessProbe;
        reuseExisting: boolean;
    };

    selectivity: {
        enabled: boolean;
        sourceRoot: string;
        testDependenciesPath: string;
        compression: SelectivityCompressionType;
        disableSelectivityPatterns: string[];
        mapDependencyRelativePath: null | SelectivityMapDependencyRelativePathFn;
    };

    timeTravel: TimeTravelConfig;
}

export interface SetsConfig {
    files: string | Array<string>;
    ignoreFiles?: Array<string>;
    browsers?: Array<string>;
}

export interface SetsConfigParsed {
    files: Array<string>;
    ignoreFiles: Array<string>;
    browsers: Array<string>;
}

type PartialCommonConfig = Partial<
    Omit<
        CommonConfig,
        | "system"
        | "timeTravel"
        | "takeScreenshotOnFails"
        | "lastFailed"
        | "openAndWaitOpts"
        | "devServer"
        | "selectivity"
    >
> & {
    system?: Partial<SystemConfig>;
    timeTravel?: TimeTravelMode | TimeTravelConfig;
    takeScreenshotOnFails?: Partial<CommonConfig["takeScreenshotOnFails"]>;
    lastFailed?: Partial<CommonConfig["lastFailed"]>;
    openAndWaitOpts?: Partial<CommonConfig["openAndWaitOpts"]>;
    devServer?: Omit<Partial<CommonConfig["devServer"]>, "readinessProbe"> & {
        readinessProbe?: Partial<CommonConfig["devServer"]["readinessProbe"]>;
    };
    selectivity?: Partial<CommonConfig["selectivity"]>;
};

export type HookType = (params: { config: Config }) => Promise<void> | undefined;

// Only browsers desiredCapabilities are required in input config
export type ConfigInput = Partial<PartialCommonConfig> & {
    browsers: Record<string, PartialCommonConfig & { desiredCapabilities: WebdriverIO.Capabilities }>;
    plugins?: Record<string, unknown>;
    sets?: Record<string, SetsConfig>;
    prepareEnvironment?: () => void | null;
    beforeAll?: HookType;
    afterAll?: HookType;
};

export interface ConfigParsed extends CommonConfig {
    browsers: Record<string, BrowserConfig>;
    plugins: Record<string, Record<string, unknown>>;
    sets: Record<string, SetsConfigParsed>;
    prepareEnvironment?: () => void | null;
    beforeAll?: HookType;
    afterAll?: HookType;
}

export interface RuntimeConfig {
    extend: (data: unknown) => this;
    [key: string]: unknown;
}

declare module "." {
    export interface Config extends ConfigParsed {}
}

declare module "./browser-config" {
    export interface BrowserConfig extends CommonConfig {
        id: string;
    }
}
