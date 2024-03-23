import _ from "lodash";
import { root, section, map, option } from "gemini-configparser";
import * as browserOptions from "./browser-options.js";
import defaults from "./defaults.js";
import optionsBuilder from "./options-builder.js";
import pkg from "../../package.json" assert { type: "json" };

const options = optionsBuilder(_.propertyOf(defaults));
const ENV_PREFIX = `${pkg.name}_`;

const rootSection = section(
    _.extend(browserOptions.getTopLevel(), {
        browsers: map(section(browserOptions.getPerBrowser())),

        prepareEnvironment: options.optionalFunction("prepareEnvironment"),

        system: section({
            debug: options.boolean("debug"),

            mochaOpts: options.optionalObject("mochaOpts"),

            expectOpts: options.optionalObject("expectOpts"),

            ctx: options.anyObject(),

            patternsOnReject: options.optionalArray("patternsOnReject"),

            workers: options.positiveInteger("workers"),

            testsPerWorker: options.positiveIntegerOrInfinity("testsPerWorker"),

            diffColor: options.hexString("diffColor"),

            tempDir: options.string("tempDir"),

            parallelLimit: options.positiveIntegerOrInfinity("parallelLimit"),

            fileExtensions: option({
                parseEnv: JSON.parse,
                parseCli: JSON.parse,
                defaultValue: defaults.fileExtensions,
                validate: value => {
                    if (!(_.isArray(value) && value.every(_.isString))) {
                        throw new Error(
                            `"fileExtensions" must be an array of strings but got ${JSON.stringify(value)}`,
                        );
                    }

                    if (value.some(v => !v.startsWith("."))) {
                        throw new Error(
                            `Each extension from "fileExtensions" must start with dot symbol but got ${JSON.stringify(
                                value,
                            )}`,
                        );
                    }
                },
            }),
        }),

        plugins: options.anyObject(),

        sets: map(
            section({
                files: option({
                    validate: value => {
                        if (!_.isArray(value) && !_.isString(value)) {
                            throw new Error('"sets.files" must be an array or string');
                        }

                        if (_.isArray(value) && !_.every(value, _.isString)) {
                            throw new Error('"sets.files" must be an array of strings');
                        }
                    },
                    map: val => [].concat(val),
                }),
                ignoreFiles: option({
                    defaultValue: [],
                    validate: value => {
                        if (!_.isArray(value) || !_.every(value, _.isString)) {
                            throw new Error('"sets.ignoreFiles" must be an array of strings');
                        }
                    },
                }),
                browsers: option({
                    defaultValue: config => _.keys(config.browsers),
                    validate: (value, config) => {
                        if (!_.isArray(value)) {
                            throw new Error('"sets.browsers" must be an array');
                        }

                        const unknownBrowsers = _.difference(value, _.keys(config.browsers));
                        if (!_.isEmpty(unknownBrowsers)) {
                            throw new Error(`Unknown browsers for "sets.browsers": ${unknownBrowsers.join(", ")}`);
                        }
                    },
                }),
            }),
            {
                "": { files: [] }, // Use `all` set with default values if sets were not specified in a config
            },
        ),
    }),
);

export default root(rootSection, { envPrefix: ENV_PREFIX });
