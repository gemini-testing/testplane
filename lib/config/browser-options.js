'use strict';

const url = require('url');

const _ = require('lodash');
const option = require('gemini-configparser').option;

const defaults = require('./defaults');
const util = require('./util');

const is = util.is;
const resolveWithProjectRoot = util.resolveWithProjectRoot;
const positiveIntegerOption = util.positiveIntegerOption;

const isOptionalObject = (value) => value === null || _.isPlainObject(value);

const getTopLevel = () => {
    const provideDefault = (key) => defaults[key];

    return buildBrowserOptions(provideDefault, {
        desiredCapabilities: option({
            defaultValue: null,
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

const provideTopLevelDefault = (name) => {
    return (config) => {
        const value = config[name];

        if (_.isUndefined(value)) {
            throw new Error(`${name} should be set at top level or per-browser option`);
        }

        return value;
    };
};

const getPerBrowser = () => {
    return buildBrowserOptions(provideTopLevelDefault, {
        desiredCapabilities: option({
            defaultValue: null,
            parseEnv: JSON.parse,
            parseCli: JSON.parse,
            validate: (value, config) => {
                if (value === null && config.desiredCapabilities === null) {
                    throw new Error('Browser must have desired capabilities set');
                } else if (!isOptionalObject(value)) {
                    throw new Error('desiredCapabilities should be null or object');
                }
            },
            map: (value, config) => _.extend({}, config.desiredCapabilities, value)
        })
    });
};

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

        grid: option({
            defaultValue: defaultFactory('grid'),
            validate: is('string')
        }),

        screenshotPath: option({
            defaultValue: defaultFactory('screenshotPath'),
            validate: (value) => {
                if (!_.isNull(value) && !_.isString(value)) {
                    throw new Error('"screenshotPath" should be null or string');
                }
            },
            map: resolveWithProjectRoot
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

exports.getTopLevel = getTopLevel;
exports.getPerBrowser = getPerBrowser;
