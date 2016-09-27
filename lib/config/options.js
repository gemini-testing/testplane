'use strict';

const _ = require('lodash');
const configparser = require('gemini-configparser');
const browserOptions = require('./browser-options');
const defaults = require('./defaults');
const util = require('./util');

const section = configparser.section;
const option = configparser.option;
const map = configparser.map;

const is = util.is;
const booleanOption = util.booleanOption;
const resolveWithProjectDir = util.resolveWithProjectDir;
const anyObject = util.anyObject;

const ENV_PREFIX = 'hermione_';

const isOptionalFunction = (value) => _.isNull(value) || _.isFunction(value);
const isOptionalObject = (value) => _.isNull(value) || _.isPlainObject(value);

const rootSection = section(_.extend(browserOptions.getTopLevel(), {
    config: option({
        defaultValue: defaults.config,
        validate: is('string'),
        map: resolveWithProjectDir
    }),

    debug: booleanOption(defaults.debug),

    mochaOpts: option({
        defaultValue: defaults.mochaOpts,
        validate: (value) => {
            if (!isOptionalObject(value)) {
                throw new Error('"mochaOpts" should be null or object');
            }
        }
    }),

    prepareBrowser: option({
        defaultValue: defaults.prepareBrowser,
        validate: (value) => {
            if (!isOptionalFunction(value)) {
                throw new Error('"prepareBrowser" should be null or function');
            }
        }
    }),

    prepareEnvironment: option({
        defaultValue: defaults.prepareEnvironment,
        validate: (value) => {
            if (!isOptionalFunction(value)) {
                throw new Error('"prepareEnvironment" should be null or function');
            }
        }
    }),

    reporters: option({
        defaultValue: defaults.reporters,
        validate: (value) => {
            if (!_.isArray(value)) {
                throw new Error('"reporters" should be an array');
            }
        }
    }),

    browsers: map(section(browserOptions.getPerBrowser())),

    plugins: anyObject(),

    specs: option({
        defaultValue: defaults.specs,
        validate: (value) => {
            if (_.isEmpty(value)) {
                throw new Error('"specs" is required option and should not be empty');
            } else if (!_.isArray(value)) {
                throw new Error('"specs" should be an array');
            }
        }
    })
}));

module.exports = configparser.root(rootSection, {envPrefix: ENV_PREFIX});
