import { WEBDRIVER_PROTOCOL } from "../constants/config";
export declare const baseUrl: string;
export declare const gridUrl: string;
export declare const browserWSEndpoint: null;
export declare const desiredCapabilities: null;
export { WEBDRIVER_PROTOCOL as automationProtocol };
export declare const sessionEnvFlags: {};
export declare const screenshotsDir: string;
export declare const diffColor: string;
export declare const tolerance: number;
export declare const antialiasingTolerance: number;
export declare const disableAnimation: boolean;
export declare namespace compareOpts {
    const shouldCluster: boolean;
    const clustersSize: number;
    const stopOnFirstFail: boolean;
}
export declare namespace buildDiffOpts {
    const ignoreAntialiasing: boolean;
    const ignoreCaret: boolean;
}
export declare namespace assertViewOpts {
    const ignoreElements: never[];
    const captureElementFromTop: boolean;
    const allowViewportOverflow: boolean;
}
export declare const calibrate: boolean;
export declare const screenshotMode: string;
export declare const screenshotDelay: number;
export declare const compositeImage: boolean;
export declare const prepareBrowser: null;
export declare const prepareEnvironment: null;
export declare const waitTimeout: number;
export declare const waitInterval: number;
export declare const httpTimeout: number;
export declare const urlHttpTimeout: null;
export declare const pageLoadTimeout: number;
export declare const sessionRequestTimeout: null;
export declare const sessionQuitTimeout: number;
export declare const testTimeout: null;
export declare namespace takeScreenshotOnFails {
    const testFail: boolean;
    const assertViewFail: boolean;
}
export declare const takeScreenshotOnFailsTimeout: number;
export declare const takeScreenshotOnFailsMode: string;
export declare const reporters: string[];
export declare const debug: boolean;
export declare const parallelLimit: number;
export declare const sessionsPerBrowser: number;
export declare const testsPerSession: number;
export declare const workers: number;
export declare const testsPerWorker: number;
export declare const retry: number;
export declare const shouldRetry: null;
export declare namespace mochaOpts {
    const slow: number;
    const timeout: number;
}
export declare namespace expectOpts {
    const wait: number;
    const interval: number;
}
export declare const patternsOnReject: never[];
export declare const meta: null;
export declare const windowSize: null;
export declare const tempDir: string;
export declare const orientation: null;
export declare const waitOrientationChange: boolean;
export declare const resetCursor: boolean;
export declare const strictTestsOrder: boolean;
export declare const saveHistoryMode: string;
export declare const fileExtensions: string[];
export declare const outputDir: null;
export declare const agent: null;
export declare const headers: null;
export declare const transformRequest: null;
export declare const transformResponse: null;
export declare const strictSSL: null;
export declare const user: null;
export declare const key: null;
export declare const region: null;
export declare const headless: null;
export declare const isolation: boolean;
export declare const configPaths: string[];
