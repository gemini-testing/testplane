'use strict';

const _ = require('lodash');
const configparser = require('gemini-configparser');

const section = configparser.section;
const option = configparser.option;
const map = configparser.map;

module.exports = {
    sets: map(section({
        files: option({
            validate: (value) => {
                if (!_.isArray(value) && !_.isString(value)) {
                    throw new Error('"sets.files" must be an array or string');
                }

                if (_.isArray(value) && !_.every(value, _.isString)) {
                    throw new Error('"sets.files" must be an array of strings');
                }
            },
            map: (val) => [].concat(val)
        }),
        ignoreFiles: option({
            defaultValue: [],
            validate: (value) => {
                if (!_.isArray(value) || !_.every(value, _.isString)) {
                    throw new Error('"sets.ignoreFiles" must be an array of strings');
                }
            }
        }),
        browsers: option({
            defaultValue: (config) => _.keys(config.browsers),
            validate: (value, config) => {
                if (!_.isArray(value)) {
                    throw new Error('"sets.browsers" must be an array');
                }

                const unknownBrowsers = _.difference(value, _.keys(config.browsers));
                if (!_.isEmpty(unknownBrowsers)) {
                    throw new Error(`Unknown browsers for "sets.browsers": ${unknownBrowsers.join(', ')}`);
                }
            }
        })
    }), {
        '': {files: []} // Use `all` set with default values if sets were not specified in a config
    })
};
