'use strict';

const _ = require('lodash');
const {root, section, map, option} = require('gemini-configparser');
const browserOptions = require('./browser-options');
const defaults = require('./defaults');
const optionsBuilder = require('./options-builder');

const options = optionsBuilder(_.propertyOf(defaults));

const coreOptions = require('../core/config/options').default;

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

        tempDir: options.string('tempDir'),

        parallelLimit: options.positiveIntegerOrInfinity('parallelLimit'),

        fileExtensions: option({
            parseEnv: JSON.parse,
            parseCli: JSON.parse,
            defaultValue: defaults.fileExtensions,
            validate: (value) => {
                if (!(_.isArray(value) && value.every(_.isString))) {
                    throw new Error(`"fileExtensions" must be an array of strings but got ${JSON.stringify(value)}`);
                }

                if (value.some((v) => !v.startsWith('.'))) {
                    throw new Error(`Each extension from "fileExtensions" must start with dot symbol but got ${JSON.stringify(value)}`);
                }
            }
        })
    }),

    plugins: options.anyObject(),

    sets: coreOptions.sets
}));

module.exports = root(rootSection, {envPrefix: ENV_PREFIX});
