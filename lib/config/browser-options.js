'use strict';

const _ = require('lodash');
const option = require('gemini-configparser').option;
const defaults = require('./defaults');
const optionsBuilder = require('./options-builder');
const utils = require('./utils');

const is = utils.is;

exports.getTopLevel = () => {
    const provideDefault = _.propertyOf(defaults);

    return buildBrowserOptions(provideDefault, {
        desiredCapabilities: optionsBuilder(provideDefault).optionalObject('desiredCapabilities')
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
                    utils.assertOptionalObject(value, 'desiredCapabilities');
                }
            },
            map: (value, config) => _.extend({}, config.desiredCapabilities, value)
        })
    });
};

function provideTopLevelDefault(name) {
    return (config) => {
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
        gridUrl: options.string('gridUrl'),

        baseUrl: option({
            defaultValue: defaultFactory('baseUrl'),
            validate: is('string', 'baseUrl'),
            map: (value, config) => {
                return config.baseUrl && !value.match(/^https?:\/\//)
                    ? [config.baseUrl.replace(/\/$/, ''), value.replace(/^\//, '')].join('/')
                    : value;
            }
        }),

        automationProtocol: option({
            defaultValue: defaultFactory('automationProtocol'),
            validate: (value) => {
                is('string', 'automationProtocol')(value);

                if (value !== 'webdriver' && value !== 'devtools') {
                    throw new Error('"automationProtocol" must be "webdriver" or "devtools"');
                }
            }
        }),

        sessionEnvFlags: option({
            defaultValue: defaultFactory('sessionEnvFlags'),
            validate: (value) => {
                if (!_.isPlainObject(value)) {
                    throw new Error('"sessionEnvFlags" must be an object');
                }

                if (_.isEmpty(value)) {
                    return;
                }

                const availableSessionEnvFlags = [
                    'isW3C', 'isChrome', 'isMobile', 'isIOS', 'isAndroid', 'isSauce', 'isSeleniumStandalone'
                ];

                Object.keys(value).forEach((key) => {
                    if (!availableSessionEnvFlags.includes(key)) {
                        throw new Error(`keys of "sessionEnvFlags" must be one of: ${availableSessionEnvFlags.join(', ')}`);
                    }

                    if (!_.isBoolean(value[key])) {
                        throw new Error('values of "sessionEnvFlags" must be boolean');
                    }
                });
            }
        }),

        sessionsPerBrowser: options.positiveInteger('sessionsPerBrowser'),
        testsPerSession: options.positiveIntegerOrInfinity('testsPerSession'),

        retry: options.nonNegativeInteger('retry'),
        shouldRetry: options.optionalFunction('shouldRetry'),

        httpTimeout: options.nonNegativeInteger('httpTimeout'),
        urlHttpTimeout: options.optionalNonNegativeInteger('urlHttpTimeout'),
        pageLoadTimeout: options.optionalNonNegativeInteger('pageLoadTimeout'),
        sessionRequestTimeout: options.optionalNonNegativeInteger('sessionRequestTimeout'),
        sessionQuitTimeout: options.optionalNonNegativeInteger('sessionQuitTimeout'),
        testTimeout: options.optionalNonNegativeInteger('testTimeout'),
        waitTimeout: options.positiveInteger('waitTimeout'),
        waitInterval: options.positiveInteger('waitInterval'),
        saveHistory: options.boolean('saveHistory'),

        screenshotOnReject: options.boolean('screenshotOnReject'),
        screenshotOnAssertViewFail: options.boolean('screenshotOnAssertViewFail'),
        screenshotOnRejectTimeout: options.optionalNonNegativeInteger('screenshotOnRejectTimeout'),
        screenshotOnRejectMode: option({
            defaultValue: defaultFactory('screenshotOnRejectMode'),
            validate: (value) => {
                is('string', 'screenshotOnRejectMode')(value);

                if (!_.includes(['fullpage', 'viewport'], value)) {
                    throw new Error('"screenshotOnRejectMode" must be "fullpage" or "viewport"');
                }
            }
        }),

        prepareBrowser: options.optionalFunction('prepareBrowser'),

        screenshotsDir: options.stringOrFunction('screenshotsDir'),

        calibrate: options.boolean('calibrate'),

        compositeImage: options.boolean('compositeImage'),

        strictTestsOrder: options.boolean('strictTestsOrder'),

        screenshotMode: option({
            defaultValue: defaultFactory('screenshotMode'),
            validate: (value) => {
                is('string', 'screenshotMode')(value);

                if (!_.includes(['fullpage', 'viewport', 'auto'], value)) {
                    throw new Error('"screenshotMode" must be "fullpage", "viewport" or "auto"');
                }
            },
            map: (value, config, currentNode) => {
                if (value !== defaults.screenshotMode) {
                    return value;
                }

                // Chrome mobile returns screenshots that are larger than visible viewport due to a bug:
                // https://bugs.chromium.org/p/chromedriver/issues/detail?id=2853
                // Due to this, screenshot is cropped incorrectly.
                const capabilities = _.get(currentNode, 'desiredCapabilities');

                const isAndroid = capabilities && Boolean(
                    (capabilities.platformName && capabilities.platformName.match(/Android/i)) ||
                    (capabilities.browserName && capabilities.browserName.match(/Android/i))
                );

                return isAndroid ? 'viewport' : value;
            }
        }),

        screenshotDelay: options.nonNegativeInteger('screenshotDelay'),

        tolerance: option({
            defaultValue: defaultFactory('tolerance'),
            parseEnv: Number,
            parseCli: Number,
            validate: (value) => utils.assertNonNegativeNumber(value, 'tolerance')
        }),

        antialiasingTolerance: option({
            defaultValue: defaultFactory('antialiasingTolerance'),
            parseEnv: Number,
            parseCli: Number,
            validate: (value) => utils.assertNonNegativeNumber(value, 'antialiasingTolerance')
        }),

        compareOpts: options.optionalObject('compareOpts'),

        buildDiffOpts: options.optionalObject('buildDiffOpts'),

        assertViewOpts: option({
            defaultValue: defaultFactory('assertViewOpts'),
            parseEnv: JSON.parse,
            parseCli: JSON.parse,
            validate: (value) => utils.assertOptionalObject(value, 'assertViewOpts'),
            map: (value) => {
                return value === defaults.assertViewOpts
                    ? value
                    : {...defaults.assertViewOpts, ...value};
            }
        }),

        meta: options.optionalObject('meta'),

        windowSize: option({
            defaultValue: defaultFactory('windowSize'),
            validate: (value) => {
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
            map: (value) => {
                if (_.isNull(value) || _.isObject(value)) {
                    return value;
                }

                const [width, height] = value.split('x').map((v) => parseInt(v, 10));

                return {width, height};
            }
        }),

        orientation: option({
            defaultValue: defaultFactory('orientation'),
            validate: (value) => {
                if (_.isNull(value)) {
                    return;
                }

                is('string', 'orientation')(value);

                if (value !== 'landscape' && value !== 'portrait') {
                    throw new Error('"orientation" must be "landscape" or "portrait"');
                }
            }
        }),

        waitOrientationChange: options.boolean('waitOrientationChange'),

        resetCursor: options.boolean('resetCursor'),

        outputDir: options.optionalString('outputDir'),

        agent: options.optionalObject('agent'),
        headers: options.optionalObject('headers'),
        transformRequest: options.optionalFunction('transformRequest'),
        transformResponse: options.optionalFunction('transformResponse'),
        strictSSL: options.optionalBoolean('strictSSL'),

        user: options.optionalString('user'),
        key: options.optionalString('key'),
        region: options.optionalString('region'),
        headless: options.optionalBoolean('headless')
    });
}
