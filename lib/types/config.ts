import type * as LooksSame from 'looks-same';
import type { SetsConfig } from 'gemini-core/build/lib/config/options';
import type {ScreenshotMode} from 'gemini-core/build/lib/browser/camera/constants';
import type Mocha from '@gemini-testing/mocha';
import type { Capabilities } from '@wdio/types';

type PositiveInteger = number;
type NonNegativeInteger = number;
type OptionalNonNegativeInteger = NonNegativeInteger | null;
type PositiveIntegerOrInfinity = PositiveInteger;
type OptionalFunction = (...args: any[]) => any | null;
type StringOrFunction = string | ((...args: any[]) => any);
type AnyObject = object;
type OptionalObject = AnyObject | null;
type OptionalString = string | null;
type OptionalBoolean = boolean | null;

export type CommonOptions = {
    gridUrl: string;

    baseUrl: string;

    automationProtocol: 'webdriver' | 'devtools';

    sessionEnvFlags: {
        isW3C?: boolean;
        isChrome?: boolean;
        isMobile?: boolean;
        isIOS?: boolean;
        isAndroid?: boolean;
        isSauce?: boolean;
        isSeleniumStandalone?: boolean;
    };

    sessionsPerBrowser: PositiveInteger;
    testsPerSession: PositiveIntegerOrInfinity;

    retry: NonNegativeInteger;
    shouldRetry: OptionalFunction;

    httpTimeout: NonNegativeInteger;
    urlHttpTimeout: OptionalNonNegativeInteger;
    pageLoadTimeout: OptionalNonNegativeInteger;
    sessionRequestTimeout: OptionalNonNegativeInteger;
    sessionQuitTimeout: OptionalNonNegativeInteger;
    testTimeout: OptionalNonNegativeInteger;
    waitTimeout: PositiveInteger;
    waitInterval: PositiveInteger;
    saveHistory: boolean;

    screenshotOnReject: boolean;
    screenshotOnRejectTimeout: OptionalNonNegativeInteger;

    prepareBrowser: OptionalFunction;

    screenshotsDir: StringOrFunction;

    calibrate: boolean;

    compositeImage: boolean;

    strictTestsOrder: boolean;

    screenshotMode: ScreenshotMode;

    screenshotDelay: NonNegativeInteger;

    tolerance: NonNegativeInteger;

    antialiasingTolerance: NonNegativeInteger;

    compareOpts: LooksSame.LooksSameOptions;
    buildDiffOpts: Omit<LooksSame.CreateDiffOptions, 'reference' | 'current' | 'highlightColor' | 'diff'>;

    assertViewOpts: {
        ignoreElements?: string | Array<string>;
        tolerance?: number;
        antialiasingTolerance?: number;
        allowViewportOverflow?: boolean;
        captureElementFromTop?: boolean;
        compositeImage?: boolean;
        screenshotDelay?: number;
        selectorToScroll?: number;
    };

    meta: OptionalObject;

    windowSize: {
        width: number;
        height: number;
    } | null;

    orientation: 'landscape' | 'portrait';

    waitOrientationChange: boolean;

    resetCursor: boolean;

    outputDir: OptionalString;

    agent: null | {
        http?: any;
        https?: any;
        http2?: any;
    };
    headers: OptionalObject;
    transformRequest: OptionalFunction;
    transformResponse: OptionalFunction;
    strictSSL: OptionalBoolean;

    user: OptionalString;
    key: OptionalString;
    region: OptionalString;
    headless: OptionalBoolean;

    desiredCapabilities: Capabilities.DesiredCapabilities;
};

export type Config = CommonOptions & {
    browsers: {
        [browserId: string]: CommonOptions;
    };

    prepareEnvironment: OptionalFunction;

    system: {
        debug: boolean;
        mochaOpts: Mocha.MochaOptions | null;
        ctx: AnyObject;
        patternsOnReject: Array<string>;
        workers: PositiveInteger;
        testsPerWorker: PositiveIntegerOrInfinity;
        diffColor: string;
        tempDir: string;
        parallelLimit: PositiveIntegerOrInfinity;
        fileExtensions: Array<string>;
    };

    plugins: AnyObject;

    sets: SetsConfig;
};
