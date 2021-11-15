import _ from 'lodash';

import { root, section, map, option } from 'gemini-configparser';
import { config as coreConfig } from 'gemini-core';

import * as browserOptions from './browser-options';
import defaults from './defaults';
import optionsBuilder from './options-builder';

import type { Config } from '../types/config';

const options = optionsBuilder(_.propertyOf(defaults));

const coreOptions = coreConfig.options;

const ENV_PREFIX = `${require('../../package').name}_`;

const rootSection = section<Config>(_.extend(browserOptions.getTopLevel(), {

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

export default root(rootSection, {envPrefix: ENV_PREFIX});
