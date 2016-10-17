'use strict';

const url = require('url');
const _ = require('lodash');
const option = require('gemini-configparser').option;
const defaults = require('./defaults');
const util = require('./util');

const is = util.is;
const isOptionalFunction = util.isOptionalFunction;
const isOptionalObject = util.isOptionalObject;
const positiveIntegerOption = util.positiveIntegerOption;

exports.getTopLevel = () => {
    const provideDefault = _.propertyOf(defaults);

    return buildBrowserOptions(provideDefault, {
        desiredCapabilities: option({
            defaultValue: defaults.desiredCapabilities,
            parseEnv: JSON.parse,
            parseCli: JSON.parse,
            validate: (value) => {
                if (!isOptionalObject(value)) {
                    throw new Error('Top-level desiredCapabilities should be null or object');
                }
            }
        })
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
                    throw new Error('Browser must have desired capabilities option');
                } else if (!isOptionalObject(value)) {
                    throw new Error('desiredCapabilities should be null or object');
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
            throw new Error(`${name} should be set at top level or per-browser option`);
        }

        return value;
    };
}

function buildBrowserOptions(defaultFactory, extra) {
    return _.extend(extra, {
        baseUrl: option({
            defaultValue: defaultFactory('baseUrl'),
            validate: is('string'),
            map: (value, config) => {
                return config.baseUrl && !value.match(/^https?:\/\//)
                    ? url.resolve(config.baseUrl, value.replace(/^\//, ''))
                    : value;
            }
        }),

        gridUrl: option({
            defaultValue: defaultFactory('gridUrl'),
            validate: is('string')
        }),

        prepareBrowser: option({
            defaultValue: defaultFactory('prepareBrowser'),
            validate: (value) => {
                if (!isOptionalFunction(value)) {
                    throw new Error('"prepareBrowser" should be null or function');
                }
            }
        }),

        screenshotPath: option({
            defaultValue: defaultFactory('screenshotPath'),
            validate: (value) => {
                if (!_.isNull(value) && !_.isString(value)) {
                    throw new Error('"screenshotPath" should be null or string');
                }
            },
            map: util.resolveWithProjectDir
        }),

        screenshotOnReject: option({
            defaultValue: defaultFactory('screenshotOnReject'),
            validate: (value) => {
                if (!_.isBoolean(value) && !_.isPlainObject(value)) {
                    throw new Error('"screenshotOnReject" should be boolean or object');
                }
            }
        }),

        sessionsPerBrowser: positiveIntegerOption(defaultFactory('sessionsPerBrowser')),

        retry: option({
            defaultValue: defaultFactory('retry'),
            parseEnv: Number,
            parseCli: Number,
            validate: (value) => {
                is('number')(value);
                if (value < 0) {
                    throw new Error('"retry" should be non-negative');
                }
            }
        }),

        waitTimeout: positiveIntegerOption(defaultFactory('waitTimeout'))
    });
}
