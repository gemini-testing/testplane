"use strict";

const _ = require("lodash");
const fs = require("fs-extra");
const option = require("gemini-configparser").option;
const defaults = require("./defaults");
const optionsBuilder = require("./options-builder");
const utils = require("./utils");
const { WEBDRIVER_PROTOCOL, DEVTOOLS_PROTOCOL, SAVE_HISTORY_MODE } = require("../constants/config");
const { isSupportIsolation } = require("../utils/browser");

const is = utils.is;

function provideRootDefault(name) {
    return () => defaults[name];
}

exports.getTopLevel = () => {
    return buildBrowserOptions(provideRootDefault, {
        desiredCapabilities: optionsBuilder(provideRootDefault).optionalObject("desiredCapabilities"),
    });
};

exports.getPerBrowser = () => {
    return buildBrowserOptions(provideTopLevelDefault, {
        desiredCapabilities: option({
            defaultValue: defaults.desiredCapabilities,
            parseEnv: JSON.parse,
            parseCli: JSON.parse,
            validate: (value, config) => {
                if (_.isNull(value) && _.isNull(config.desiredCapabilities)) {
                    throw new Error('Each browser must have "desiredCapabilities" option');
                } else {
                    utils.assertOptionalObject(value, "desiredCapabilities");
                }
            },
            map: (value, config) => _.extend({}, config.desiredCapabilities, value),
        }),
    });
};

function provideTopLevelDefault(name) {
    return config => {
        const value = config[name];

        if (_.isUndefined(value)) {
            throw new Error(`"${name}" should be set at the top level or per-browser option`);
        }

        return value;
    };
}

function buildBrowserOptions(defaultFactory, extra) {
    const options = optionsBuilder(defaultFactory);

    return _.extend(extra, {
        gridUrl: options.string("gridUrl"),

        baseUrl: option({
            defaultValue: defaultFactory("baseUrl"),
            validate: is("string", "baseUrl"),
            map: (value, config) => {
                return config.baseUrl && !value.match(/^https?:\/\//)
                    ? [config.baseUrl.replace(/\/$/, ""), value.replace(/^\//, "")].join("/")
                    : value;
            },
        }),

        browserWSEndpoint: option({
            defaultValue: defaultFactory("browserWSEndpoint"),
            validate: value => {
                if (_.isNull(value)) {
                    return;
                }

                is("string", "browserWSEndpoint")(value);

                if (!/wss?:\/\//.test(value)) {
                    throw new Error(`"browserWSEndpoint" must start with "ws://" or "wss://" prefix`);
                }
            },
        }),

        automationProtocol: option({
            defaultValue: defaultFactory("automationProtocol"),
            validate: value => {
                is("string", "automationProtocol")(value);

                if (value !== WEBDRIVER_PROTOCOL && value !== DEVTOOLS_PROTOCOL) {
                    throw new Error(`"automationProtocol" must be "${WEBDRIVER_PROTOCOL}" or "${DEVTOOLS_PROTOCOL}"`);
                }
            },
        }),

        sessionEnvFlags: option({
            defaultValue: defaultFactory("sessionEnvFlags"),
            validate: value => {
                if (!_.isPlainObject(value)) {
                    throw new Error('"sessionEnvFlags" must be an object');
                }

                if (_.isEmpty(value)) {
                    return;
                }

                const availableSessionEnvFlags = [
                    "isW3C",
                    "isChrome",
                    "isMobile",
                    "isIOS",
                    "isAndroid",
                    "isSauce",
                    "isSeleniumStandalone",
                ];

                Object.keys(value).forEach(key => {
                    if (!availableSessionEnvFlags.includes(key)) {
                        throw new Error(
                            `keys of "sessionEnvFlags" must be one of: ${availableSessionEnvFlags.join(", ")}`,
                        );
                    }

                    if (!_.isBoolean(value[key])) {
                        throw new Error('values of "sessionEnvFlags" must be boolean');
                    }
                });
            },
        }),

        sessionsPerBrowser: options.positiveInteger("sessionsPerBrowser"),
        testsPerSession: options.positiveIntegerOrInfinity("testsPerSession"),

        retry: options.nonNegativeInteger("retry"),
        shouldRetry: options.optionalFunction("shouldRetry"),

        httpTimeout: options.nonNegativeInteger("httpTimeout"),
        urlHttpTimeout: options.optionalNonNegativeInteger("urlHttpTimeout"),
        pageLoadTimeout: options.optionalNonNegativeInteger("pageLoadTimeout"),
        sessionRequestTimeout: options.optionalNonNegativeInteger("sessionRequestTimeout"),
        sessionQuitTimeout: options.optionalNonNegativeInteger("sessionQuitTimeout"),
        testTimeout: options.optionalNonNegativeInteger("testTimeout"),
        waitTimeout: options.positiveInteger("waitTimeout"),
        waitInterval: options.positiveInteger("waitInterval"),

        saveHistoryMode: option({
            defaultValue: defaultFactory("saveHistoryMode"),
            validate: value => {
                const availableValues = Object.values(SAVE_HISTORY_MODE);

                if (!availableValues.includes(value)) {
                    throw new Error(`"saveHistoryMode" must be one of: ${availableValues.join(", ")}`);
                }
            },
        }),

        takeScreenshotOnFails: option({
            defaultValue: defaultFactory("takeScreenshotOnFails"),
            parseEnv: JSON.parse,
            parseCli: JSON.parse,
            validate: value => {
                if (!_.isPlainObject(value)) {
                    throw new Error('"takeScreenshotOnFails" must be an object');
                }

                const allowedProps = ["assertViewFail", "testFail"];
                const unknownProps = _.keys(value).filter(prop => !allowedProps.includes(prop));

                if (unknownProps.length) {
                    throw new Error(
                        `"takeScreenshotOnFails" contains unknown properties: ${unknownProps}. Allowed: ${allowedProps}.`,
                    );
                }
            },
            map: (value, config) => ({
                ...defaultFactory("takeScreenshotOnFails")(config),
                ...value,
            }),
        }),
        takeScreenshotOnFailsTimeout: options.optionalNonNegativeInteger("takeScreenshotOnFailsTimeout"),
        takeScreenshotOnFailsMode: options.enumeration("takeScreenshotOnFailsMode", ["fullpage", "viewport"]),

        prepareBrowser: options.optionalFunction("prepareBrowser"),

        screenshotsDir: option({
            defaultValue: defaultFactory("screenshotsDir"),
            validate: value => {
                if (!_.isString(value) && !_.isFunction(value)) {
                    throw new Error('"screenshotsDir" must be a string or function');
                }
            },
            map: (value, config, __, { isSetByUser }) => {
                if (isSetByUser) {
                    return value;
                }

                const topLevelScreenshotsDir = _.get(config, "screenshotsDir");
                if (topLevelScreenshotsDir) {
                    return topLevelScreenshotsDir;
                }

                const deprecatedScreensPath = "hermione/screens";

                return fs.existsSync(deprecatedScreensPath) && !fs.existsSync(value) ? deprecatedScreensPath : value;
            },
        }),

        calibrate: options.boolean("calibrate"),

        compositeImage: options.boolean("compositeImage"),

        strictTestsOrder: options.boolean("strictTestsOrder"),

        screenshotMode: options.enumeration("screenshotMode", ["fullpage", "viewport", "auto"], {
            map: (value, config, currentNode) => {
                if (value !== defaults.screenshotMode) {
                    return value;
                }

                // Chrome mobile returns screenshots that are larger than visible viewport due to a bug:
                // https://bugs.chromium.org/p/chromedriver/issues/detail?id=2853
                // Due to this, screenshot is cropped incorrectly.
                const capabilities = _.get(currentNode, "desiredCapabilities");

                const isAndroid =
                    capabilities &&
                    Boolean(
                        (capabilities.platformName && capabilities.platformName.match(/Android/i)) ||
                            (capabilities.browserName && capabilities.browserName.match(/Android/i)),
                    );

                return isAndroid ? "viewport" : value;
            },
        }),

        screenshotDelay: options.nonNegativeInteger("screenshotDelay"),

        tolerance: option({
            defaultValue: defaultFactory("tolerance"),
            parseEnv: Number,
            parseCli: Number,
            validate: value => utils.assertNonNegativeNumber(value, "tolerance"),
        }),

        antialiasingTolerance: option({
            defaultValue: defaultFactory("antialiasingTolerance"),
            parseEnv: Number,
            parseCli: Number,
            validate: value => utils.assertNonNegativeNumber(value, "antialiasingTolerance"),
        }),

        disableAnimation: options.boolean("disableAnimation"),

        compareOpts: options.optionalObject("compareOpts"),

        buildDiffOpts: options.optionalObject("buildDiffOpts"),

        assertViewOpts: option({
            defaultValue: defaultFactory("assertViewOpts"),
            parseEnv: JSON.parse,
            parseCli: JSON.parse,
            validate: value => utils.assertOptionalObject(value, "assertViewOpts"),
            map: value => {
                return value === defaults.assertViewOpts ? value : { ...defaults.assertViewOpts, ...value };
            },
        }),

        openAndWaitOpts: option({
            defaultValue: defaultFactory("openAndWaitOpts"),
            parseEnv: JSON.parse,
            parseCli: JSON.parse,
            validate: value => utils.assertOptionalObject(value, "openAndWaitOpts"),
            map: value => ({ ...defaults.openAndWaitOpts, ...value }),
        }),

        meta: options.optionalObject("meta"),

        windowSize: option({
            defaultValue: defaultFactory("windowSize"),
            validate: value => {
                if (_.isNull(value)) {
                    return;
                }
                if (_.isObject(value)) {
                    if (_.isNumber(value.width) && _.isNumber(value.height)) {
                        return;
                    } else {
                        throw new Error('"windowSize" must be an object with "width" and "height" keys');
                    }
                }
                if (!_.isString(value)) {
                    throw new Error('"windowSize" must be string, object or null');
                } else if (!/^\d+x\d+$/.test(value)) {
                    throw new Error('"windowSize" should have form of <width>x<height> (i.e. 1600x1200)');
                }
            },
            map: value => {
                if (_.isNull(value) || _.isObject(value)) {
                    return value;
                }

                const [width, height] = value.split("x").map(v => parseInt(v, 10));

                return { width, height };
            },
        }),

        orientation: option({
            defaultValue: defaultFactory("orientation"),
            validate: value => {
                if (_.isNull(value)) {
                    return;
                }

                is("string", "orientation")(value);

                if (value !== "landscape" && value !== "portrait") {
                    throw new Error('"orientation" must be "landscape" or "portrait"');
                }
            },
        }),

        waitOrientationChange: options.boolean("waitOrientationChange"),

        resetCursor: options.boolean("resetCursor"),

        outputDir: options.optionalString("outputDir"),

        agent: options.optionalObject("agent"),
        headers: options.optionalObject("headers"),
        transformRequest: options.optionalFunction("transformRequest"),
        transformResponse: options.optionalFunction("transformResponse"),
        strictSSL: options.optionalBoolean("strictSSL"),

        user: options.optionalString("user"),
        key: options.optionalString("key"),
        region: options.optionalString("region"),
        headless: option({
            defaultValue: defaultFactory("headless"),
            validate: value => {
                if (_.isNull(value) || _.isBoolean(value)) {
                    return;
                }

                if (typeof value !== "string") {
                    throw new Error('"headless" option should be boolean or string with "new" or "old" values');
                }

                if (value !== "old" && value !== "new") {
                    throw new Error(`"headless" option should be "new" or "old", but got "${value}"`);
                }
            },
        }),

        isolation: option({
            defaultValue: defaultFactory("isolation"),
            parseCli: value => utils.parseBoolean(value, "isolation"),
            parseEnv: value => utils.parseBoolean(value, "isolation"),
            validate: value => _.isNull(value) || is("boolean", "isolation")(value),
            map: (value, config, currentNode, meta) => {
                if (meta.isSetByUser || !_.isNull(value)) {
                    return value;
                }

                const caps = _.get(currentNode, "desiredCapabilities");

                return caps ? isSupportIsolation(caps.browserName, caps.browserVersion) : value;
            },
        }),

        passive: options.boolean("passive"),
    });
}
