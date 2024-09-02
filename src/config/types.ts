import type { BrowserConfig } from "./browser-config";
import type { BrowserTestRunEnvOptions } from "../runner/browser-env/vite/types";
import type { Test } from "../types";
import type { ChildProcessWithoutNullStreams } from "child_process";
import { RequestOptions } from "https";

export interface CompareOptsConfig {
    shouldCluster: boolean;
    clustersSize: number;
    stopOnFirstFail: boolean;
}

export interface BuildDiffOptsConfig {
    ignoreAntialiasing: boolean;
    ignoreCaret: boolean;
}

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
     * By default Testplane throws an error if element is outside the viewport bounds.
     * This option disables check that element is outside of the viewport left, top, right or bottom bounds.
     * And in this case if browser option {@link https://github.com/gemini-testing/testplane#compositeimage compositeImage} set to `false`, then only visible part of the element will be captured.
     * But if {@link https://github.com/gemini-testing/testplane#compositeimage compositeImage} set to `true` (default), then in the resulting screenshot will appear the whole element with not visible parts outside of the bottom bounds of viewport.
     *
     * @defaultValue `false`
     */
    allowViewportOverflow: boolean;
}

export interface ExpectOptsConfig {
    wait: number;
    interval: number;
}

export interface MochaOpts {
    /** milliseconds to wait before considering a test slow. */
    slow?: number;

    /** timeout in milliseconds or time string like '1s'. */
    timeout?: number;

    /** string or regexp to filter tests with. */
    grep?: string | RegExp;
}

export interface SystemConfig {
    debug: boolean;
    mochaOpts: MochaOpts;
    expectOpts: ExpectOptsConfig;
    ctx: { [name: string]: unknown };
    patternsOnReject: Array<string>;
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
    assertViewOpts: AssertViewOptsConfig;
    expectOpts: ExpectOptsConfig;
    meta: { [name: string]: unknown };
    windowSize: string | { width: number; height: number } | null;
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
    };
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

// Only browsers desiredCapabilities are required in input config
export type ConfigInput = Partial<CommonConfig> & {
    browsers: Record<string, Partial<CommonConfig> & { desiredCapabilities: WebdriverIO.Capabilities }>;
    plugins?: Record<string, unknown>;
    sets?: Record<string, SetsConfig>;
    prepareEnvironment?: () => void | null;
};

export interface RuntimeConfig {
    extend: (data: unknown) => this;
    [key: string]: unknown;
}

declare module "." {
    export interface Config extends CommonConfig {
        browsers: Record<string, BrowserConfig>;
        plugins: Record<string, Record<string, unknown>>;
        sets: Record<string, SetsConfigParsed>;
        prepareEnvironment?: () => void | null;
    }
}

declare module "./browser-config" {
    export interface BrowserConfig extends CommonConfig {
        id: string;
    }
}
