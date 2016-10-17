'use strict';

const _ = require('lodash');
const configparser = require('gemini-configparser');
const browserOptions = require('./browser-options');
const defaults = require('./defaults');
const util = require('./util');

const section = configparser.section;
const option = configparser.option;
const map = configparser.map;

const booleanOption = util.booleanOption;
const isOptionalFunction = util.isOptionalFunction;
const isOptionalObject = util.isOptionalObject;
const anyObject = util.anyObject;

const ENV_PREFIX = 'hermione_';

const rootSection = section(_.extend(browserOptions.getTopLevel(), {
    system: section({
        debug: booleanOption(defaults.debug),

        mochaOpts: option({
            defaultValue: defaults.mochaOpts,
            validate: (value) => {
                if (!isOptionalObject(value)) {
                    throw new Error('"mochaOpts" should be null or object');
                }
            }
        })
    }),

    prepareEnvironment: option({
        defaultValue: defaults.prepareEnvironment,
        validate: (value) => {
            if (!isOptionalFunction(value)) {
                throw new Error('"prepareEnvironment" should be null or function');
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
