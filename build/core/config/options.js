"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const lodash_1 = __importDefault(require("lodash"));
const gemini_configparser_1 = require("gemini-configparser");
exports.default = {
    sets: (0, gemini_configparser_1.map)((0, gemini_configparser_1.section)({
        files: (0, gemini_configparser_1.option)({
            defaultValue: [],
            validate: (value) => {
                if (!lodash_1.default.isArray(value) && !lodash_1.default.isString(value)) {
                    throw new Error('"sets.files" must be an array or string');
                }
                if (lodash_1.default.isArray(value) && !lodash_1.default.every(value, lodash_1.default.isString)) {
                    throw new Error('"sets.files" must be an array of strings');
                }
            },
            map: (val) => [].concat(val)
        }),
        ignoreFiles: (0, gemini_configparser_1.option)({
            defaultValue: [],
            validate: (value) => {
                if (!lodash_1.default.isArray(value) || !lodash_1.default.every(value, lodash_1.default.isString)) {
                    throw new Error('"sets.ignoreFiles" must be an array of strings');
                }
            }
        }),
        browsers: (0, gemini_configparser_1.option)({
            defaultValue: (config) => lodash_1.default.keys(config.browsers),
            validate: (value, config) => {
                if (!lodash_1.default.isArray(value)) {
                    throw new Error('"sets.browsers" must be an array');
                }
                const unknownBrowsers = lodash_1.default.difference(value, lodash_1.default.keys(config.browsers));
                if (!lodash_1.default.isEmpty(unknownBrowsers)) {
                    throw new Error(`Unknown browsers for "sets.browsers": ${unknownBrowsers.join(', ')}`);
                }
            }
        })
    }), {
        '': { files: [], ignoreFiles: [] } // Use `all` set with default values if sets were not specified in a config
    })
};
