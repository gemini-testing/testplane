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

const rootSection = section(_.extend(browserOptions.getTopLevel(), {
    conf: option({
        defaultValue: defaults.conf,
        validate: is('string'),
        map: resolveWithProjectRoot
    }),

    debug: booleanOption(defaults.debug),

    mochaOpts: anyObject(defaults.mochaOpts),

    prepareBrowser: option({
        defaultValue: null,
        validate: (value) => {
            if (!_.isFunction(value)) {
                throw new Error('"prepareBrowser" should be a function');
            }
        }
    }),

    prepareEnvironment: option({
        defaultValue: null,
        validate: (value) => {
            if (!_.isFunction(value)) {
                throw new Error('"prepareEnvironment" should be a function');
            }
        }
    }),

    projectRoot: option({
        validate: is('string'),
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
        defaultValue: [],
        validate: (value) => {
            if (!_.isArray(value)) {
                throw new Error('"specs" should be an array');
            }
        }
    })
}));

module.exports = root(rootSection, ENV_PREFIX);
