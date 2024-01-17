import { WEBDRIVER_PROTOCOL } from "../constants/config";
export declare let baseUrl: string;
export declare let gridUrl: string;
export declare let browserWSEndpoint: null;
export declare let desiredCapabilities: null;
export { WEBDRIVER_PROTOCOL as automationProtocol };
export declare let sessionEnvFlags: {};
export declare let screenshotsDir: string;
export declare let diffColor: string;
export declare let tolerance: number;
export declare let antialiasingTolerance: number;
export declare let disableAnimation: boolean;
export declare namespace compareOpts {
    let shouldCluster: boolean;
    let clustersSize: number;
    let stopOnFirstFail: boolean;
}
export declare namespace buildDiffOpts {
    let ignoreAntialiasing: boolean;
    let ignoreCaret: boolean;
}
export declare namespace assertViewOpts {
    let ignoreElements: never[];
    let captureElementFromTop: boolean;
    let allowViewportOverflow: boolean;
}
export declare namespace openAndWaitOpts {
    let waitNetworkIdle: boolean;
    let waitNetworkIdleTimeout: number;
    let failOnNetworkError: boolean;
    let ignoreNetworkErrorsPatterns: never[];
}
export declare let calibrate: boolean;
export declare let screenshotMode: string;
export declare let screenshotDelay: number;
export declare let compositeImage: boolean;
export declare let prepareBrowser: null;
export declare let prepareEnvironment: null;
export declare let waitTimeout: number;
export declare let waitInterval: number;
export declare let httpTimeout: number;
export declare let urlHttpTimeout: null;
export declare let pageLoadTimeout: number;
export declare let sessionRequestTimeout: null;
export declare let sessionQuitTimeout: number;
export declare let testTimeout: null;
export declare namespace takeScreenshotOnFails {
    let testFail: boolean;
    let assertViewFail: boolean;
}
export declare let takeScreenshotOnFailsTimeout: number;
export declare let takeScreenshotOnFailsMode: string;
export declare let reporters: string[];
export declare let debug: boolean;
export declare let parallelLimit: number;
export declare let sessionsPerBrowser: number;
export declare let testsPerSession: number;
export declare let workers: number;
export declare let testsPerWorker: number;
export declare let retry: number;
export declare let shouldRetry: null;
export declare namespace mochaOpts {
    let slow: number;
    let timeout: number;
}
export declare namespace expectOpts {
    let wait: number;
    let interval: number;
}
export declare let patternsOnReject: never[];
export declare let meta: null;
export declare let windowSize: null;
export declare let tempDir: string;
export declare let orientation: null;
export declare let waitOrientationChange: boolean;
export declare let resetCursor: boolean;
export declare let strictTestsOrder: boolean;
export declare let saveHistoryMode: string;
export declare let fileExtensions: string[];
export declare let outputDir: null;
export declare let agent: null;
export declare let headers: null;
export declare let transformRequest: null;
export declare let transformResponse: null;
export declare let strictSSL: null;
export declare let user: null;
export declare let key: null;
export declare let region: null;
export declare let headless: null;
export declare let isolation: null;
export declare let configPaths: string[];
