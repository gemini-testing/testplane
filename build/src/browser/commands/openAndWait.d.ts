interface Browser {
    publicAPI: WebdriverIO.Browser;
    config: {
        desiredCapabilities: {
            browserName: string;
        };
        automationProtocol: "webdriver" | "devtools";
        pageLoadTimeout: number;
        openAndWaitOpts: {
            timeout?: number;
            waitNetworkIdle: boolean;
            waitNetworkIdleTimeout: number;
            failOnNetworkError: boolean;
            ignoreNetworkErrorsPatterns: Array<RegExp | string>;
        };
    };
}
declare const _default: (browser: Browser) => void;
export = _default;
