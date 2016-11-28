'use strict';

const _ = require('lodash');
const configparser = require('gemini-configparser');
const browserOptions = require('./browser-options');
const defaults = require('./defaults');
const optionsBuilder = require('./options-builder');

const options = optionsBuilder(_.propertyOf(defaults));

const section = configparser.section;
const option = configparser.option;
const map = configparser.map;

const ENV_PREFIX = 'hermione_';

const rootSection = section(_.extend(browserOptions.getTopLevel(), {
    specs: option({
        defaultValue: defaults.specs,
        validate: (value) => {
            if (_.isEmpty(value)) {
                throw new Error('"specs" is the required option which should not be empty');
            } else if (!_.isArray(value)) {
                throw new Error('"specs" should be an array');
            }
        }
    }),

    browsers: map(section(browserOptions.getPerBrowser())),

    prepareEnvironment: options.optionalFunction('prepareEnvironment'),

    system: section({
        debug: options.boolean('debug'),

        mochaOpts: options.optionalObject('mochaOpts')
    }),

    plugins: options.anyObject()
}));

module.exports = configparser.root(rootSection, {envPrefix: ENV_PREFIX});
