'use strict';

const path = require('path');

const _ = require('lodash');
const configparser = require('gemini-configparser');

const browserOptions = require('./browser-options');
const defaults = require('./defaults');
const util = require('./util');

const root = configparser.root;
const section = configparser.section;
const option = configparser.option;
const map = configparser.map;

const is = util.is;
const booleanOption = util.booleanOption;
const resolveWithProjectRoot = util.resolveWithProjectRoot;
const anyObject = util.anyObject;

const ENV_PREFIX = 'hermione_';

const isOptionalFunction = (value) => _.isNull(value) || _.isFunction(value);

const isOptionalObject = (value) => _.isNull(value) || _.isPlainObject(value);

const rootSection = section(_.extend(browserOptions.getTopLevel(), {
    conf: option({
        defaultValue: defaults.conf,
        validate: is('string'),
        map: resolveWithProjectRoot
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

    projectRoot: option({
        map: _.ary(path.resolve, 1)
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
        defaultValue: null,
        validate: (value) => {
            if (_.isEmpty(value)) {
                throw new Error('"specs" is required option and should not be empty');
            } else if (!_.isArray(value)) {
                throw new Error('"specs" should be an array');
            }
        }
    })
}));

module.exports = root(rootSection, {envPrefix: ENV_PREFIX});
