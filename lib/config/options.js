'use strict';

const _ = require('lodash');
const configparser = require('gemini-configparser');
const browserOptions = require('./browser-options');
const defaults = require('./defaults');
const optionsBuilder = require('./options-builder');

const options = optionsBuilder(_.propertyOf(defaults));

const section = configparser.section;
const map = configparser.map;

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

        diffColor: options.hexString('diffColor'),

        tempDir: options.string('tempDir')
    }),

    plugins: options.anyObject(),

    sets: coreOptions.sets
}));

module.exports = configparser.root(rootSection, {envPrefix: ENV_PREFIX});
