import type { CommonOptions } from '../types/config';

export default class CommonConfig {
    constructor(protected commonOptions: CommonOptions) {}

    public get gridUrl(): CommonOptions['gridUrl'] {
        return this.commonOptions.gridUrl;
    }

    public get baseUrl(): CommonOptions['baseUrl'] {
        return this.commonOptions.baseUrl;
    }

    public get automationProtocol(): CommonOptions['automationProtocol'] {
        return this.commonOptions.automationProtocol;
    }

    public get sessionEnvFlags(): CommonOptions['sessionEnvFlags'] {
        return this.commonOptions.sessionEnvFlags;
    }

    public get sessionsPerBrowser(): CommonOptions['sessionsPerBrowser'] {
        return this.commonOptions.sessionsPerBrowser;
    }
    public get testsPerSession(): CommonOptions['testsPerSession'] {
        return this.commonOptions.testsPerSession;
    }

    public get retry(): CommonOptions['retry'] {
        return this.commonOptions.retry;
    }
    public get shouldRetry(): CommonOptions['shouldRetry'] {
        return this.commonOptions.shouldRetry;
    }

    public get httpTimeout(): CommonOptions['httpTimeout'] {
        return this.commonOptions.httpTimeout;
    }
    public get urlHttpTimeout(): CommonOptions['urlHttpTimeout'] {
        return this.commonOptions.urlHttpTimeout;
    }
    public get pageLoadTimeout(): CommonOptions['pageLoadTimeout'] {
        return this.commonOptions.pageLoadTimeout;
    }
    public get sessionRequestTimeout(): CommonOptions['sessionRequestTimeout'] {
        return this.commonOptions.sessionRequestTimeout;
    }
    public get sessionQuitTimeout(): CommonOptions['sessionQuitTimeout'] {
        return this.commonOptions.sessionQuitTimeout;
    }
    public get testTimeout(): CommonOptions['testTimeout'] {
        return this.commonOptions.testTimeout;
    }
    public get waitTimeout(): CommonOptions['waitTimeout'] {
        return this.commonOptions.waitTimeout;
    }
    public get waitInterval(): CommonOptions['waitInterval'] {
        return this.commonOptions.waitInterval;
    }
    public get saveHistory(): CommonOptions['saveHistory'] {
        return this.commonOptions.saveHistory;
    }

    public get screenshotOnReject(): CommonOptions['screenshotOnReject'] {
        return this.commonOptions.screenshotOnReject;
    }
    public get screenshotOnRejectTimeout(): CommonOptions['screenshotOnRejectTimeout'] {
        return this.commonOptions.screenshotOnRejectTimeout;
    }

    public get prepareBrowser(): CommonOptions['prepareBrowser'] {
        return this.commonOptions.prepareBrowser;
    }

    public get screenshotsDir(): CommonOptions['screenshotsDir'] {
        return this.commonOptions.screenshotsDir;
    }

    public get calibrate(): CommonOptions['calibrate'] {
        return this.commonOptions.calibrate;
    }

    public get compositeImage(): CommonOptions['compositeImage'] {
        return this.commonOptions.compositeImage;
    }

    public get strictTestsOrder(): CommonOptions['strictTestsOrder'] {
        return this.commonOptions.strictTestsOrder;
    }

    public get screenshotMode(): CommonOptions['screenshotMode'] {
        return this.commonOptions.screenshotMode;
    }

    public get screenshotDelay(): CommonOptions['screenshotDelay'] {
        return this.commonOptions.screenshotDelay;
    }

    public get tolerance(): CommonOptions['tolerance'] {
        return this.commonOptions.tolerance;
    }

    public get antialiasingTolerance(): CommonOptions['antialiasingTolerance'] {
        return this.commonOptions.antialiasingTolerance;
    }

    public get compareOpts(): CommonOptions['compareOpts'] {
        return this.commonOptions.compareOpts;
    }
    public get buildDiffOpts(): CommonOptions['buildDiffOpts'] {
        return this.commonOptions.buildDiffOpts;
    }

    public get assertViewOpts(): CommonOptions['assertViewOpts'] {
        return this.commonOptions.assertViewOpts;
    }

    public get meta(): CommonOptions['meta'] {
        return this.commonOptions.meta;
    }

    public get windowSize(): CommonOptions['windowSize'] {
        return this.commonOptions.windowSize;
    }

    public get orientation(): CommonOptions['orientation'] {
        return this.commonOptions.orientation;
    }

    public get waitOrientationChange(): CommonOptions['waitOrientationChange'] {
        return this.commonOptions.waitOrientationChange;
    }

    public get resetCursor(): CommonOptions['resetCursor'] {
        return this.commonOptions.resetCursor;
    }

    public get outputDir(): CommonOptions['outputDir'] {
        return this.commonOptions.outputDir;
    }

    public get agent(): CommonOptions['agent'] {
        return this.commonOptions.agent;
    }
    public get headers(): CommonOptions['headers'] {
        return this.commonOptions.headers;
    }
    public get transformRequest(): CommonOptions['transformRequest'] {
        return this.commonOptions.transformRequest;
    }
    public get transformResponse(): CommonOptions['transformResponse'] {
        return this.commonOptions.transformResponse;
    }
    public get strictSSL(): CommonOptions['strictSSL'] {
        return this.commonOptions.strictSSL;
    }

    public get user(): CommonOptions['user'] {
        return this.commonOptions.user;
    }
    public get key(): CommonOptions['key'] {
        return this.commonOptions.key;
    }
    public get region(): CommonOptions['region'] {
        return this.commonOptions.region;
    }
    public get headless(): CommonOptions['headless'] {
        return this.commonOptions.headless;
    }

    public get desiredCapabilities(): CommonOptions['desiredCapabilities'] {
        return this.commonOptions.desiredCapabilities;
    }
}
