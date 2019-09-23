'use strict';

const _ = require('lodash');
const configparser = require('gemini-configparser');
const browserOptions = require('./browser-options');
const defaults = require('./defaults');
const optionsBuilder = require('./options-builder');
const utils = require('./utils');

const options = optionsBuilder(_.propertyOf(defaults));

const section = configparser.section;
const map = configparser.map;
const is = utils.is;

const coreOptions = require('gemini-core').config.options;

const ENV_PREFIX = `${require('../../package').name}_`;

const rootSection = section(_.extend(browserOptions.getTopLevel(), {

    browsers: map(section(browserOptions.getPerBrowser())),

    prepareEnvironment: options.optionalFunction('prepareEnvironment'),

    system: section({
        debug: options.boolean('debug'),

        mochaOpts: options.optionalObject('mochaOpts'),

        ctx: options.anyObject(),

        patternsOnReject: options.optionalArray('patternsOnReject'),

        workers: options.positiveInteger('workers'),

        testsPerWorker: options.positiveIntegerOrInfinity('testsPerWorker'),

        diffColor: options.hexString('diffColor'),

        ignoreStyle: configparser.option({
            defaultValue: defaults.ignoreStyle,
            validate: (value) => {
                is('string', 'ignoreStyle')(value);

                if (!_.includes(['none', 'solid', 'border'], value)) {
                    throw new Error('"ignoreStyle" must be "none", "solid" or "border"');
                }
            }
        }),

        tempDir: options.string('tempDir'),

        parallelLimit: options.positiveIntegerOrInfinity('parallelLimit')
    }),

    plugins: options.anyObject(),

    sets: coreOptions.sets
}));

module.exports = configparser.root(rootSection, {envPrefix: ENV_PREFIX});
