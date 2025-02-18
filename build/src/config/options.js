"use strict";
const _ = require("lodash");
const { root, section, map, option } = require("gemini-configparser");
const browserOptions = require("./browser-options");
const defaults = require("./defaults");
const optionsBuilder = require("./options-builder");
const { NODEJS_TEST_RUN_ENV, BROWSER_TEST_RUN_ENV } = require("../constants/config");
const options = optionsBuilder(_.propertyOf(defaults));
const ENV_PREFIXES = ["testplane_", "hermione_"];
const rootSection = section(_.extend(browserOptions.getTopLevel(), {
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
                    throw new Error(`"fileExtensions" must be an array of strings but got ${JSON.stringify(value)}`);
                }
                if (value.some(v => !v.startsWith("."))) {
                    throw new Error(`Each extension from "fileExtensions" must start with dot symbol but got ${JSON.stringify(value)}`);
                }
            },
        }),
        testRunEnv: option({
            defaultValue: defaults.testRunEnv,
            validate: value => {
                if (!_.isArray(value) && !_.isString(value)) {
                    throw new Error(`"testRunEnv" must be an array or string but got ${JSON.stringify(value)}`);
                }
                if (_.isString(value)) {
                    if (value !== NODEJS_TEST_RUN_ENV && value !== BROWSER_TEST_RUN_ENV) {
                        throw new Error(`"testRunEnv" specified as string must be "${NODEJS_TEST_RUN_ENV}" or "${BROWSER_TEST_RUN_ENV}" but got "${value}"`);
                    }
                    return;
                }
                const [testRunEnv, options] = value;
                if (testRunEnv === NODEJS_TEST_RUN_ENV) {
                    throw new Error(`"testRunEnv" with "${NODEJS_TEST_RUN_ENV}" value must be specified as string but got ${JSON.stringify(value)}`);
                }
                if (testRunEnv === BROWSER_TEST_RUN_ENV && !options) {
                    throw new Error(`"testRunEnv" specified as array must also contain options as second argument but got ${JSON.stringify(value)}`);
                }
                if (testRunEnv !== BROWSER_TEST_RUN_ENV) {
                    throw new Error(`"testRunEnv" specified as array must be in format ["${BROWSER_TEST_RUN_ENV}", <options>] but got ${JSON.stringify(value)}`);
                }
            },
        }),
    }),
    plugins: options.anyObject(),
    lastFailed: section({
        only: options.boolean("lastFailed.only"),
        input: option({
            defaultValue: defaults.lastFailed.input,
            validate: value => {
                if (!_.isString(value) && !_.isArray(value)) {
                    throw new Error('"lastFailed.input" must be a string or an array');
                }
                if (!_.isArray(value) && !value.endsWith(".json")) {
                    throw new Error('"lastFailed.input" must have .json extension');
                }
                if (_.isArray(value) && value.filter(v => !v.endsWith(".json")).length) {
                    throw new Error('"lastFailed.input" elements must have .json extension');
                }
            },
        }),
        output: option({
            defaultValue: defaults.lastFailed.output,
            validate: value => {
                if (!_.isString(value)) {
                    throw new Error('"lastFailed.output" must be a string');
                }
                if (!value.endsWith(".json")) {
                    throw new Error('"lastFailed.output" must have .json extension');
                }
            },
        }),
    }),
    sets: map(section({
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
    }), {
        "": { files: [] }, // Use `all` set with default values if sets were not specified in a config
    }),
    devServer: section({
        command: options.optionalString("devServer.command"),
        env: options.optionalObject("devServer.env"),
        args: options.optionalArray("devServer.args"),
        cwd: options.optionalString("devServer.cwd"),
        logs: options.optionalBoolean("devServer.logs"),
        readinessProbe: option({
            defaultValue: defaults.devServer.readinessProbe,
            validate: value => {
                if (typeof value === "function" || value === null) {
                    return;
                }
                if (!_.isPlainObject(value)) {
                    throw new Error('"devServer.readinessProbe" must be a function, object or null');
                }
                if (!_.isUndefined(value.url) && typeof value.url !== "string" && value.url !== null) {
                    throw new Error('"devServer.readinessProbe.url" must be a string or null');
                }
                if (!_.isUndefined(value.isReady) &&
                    typeof value.isReady !== "function" &&
                    value.isReady !== null) {
                    throw new Error('"devServer.readinessProbe.isReady" must be a function or null');
                }
                if (!_.isUndefined(value.timeouts) && !_.isPlainObject(value.timeouts)) {
                    throw new Error('"devServer.readinessProbe.timeouts" must be an object');
                }
                if (value.timeouts) {
                    ["waitServerTimeout", "probeRequestTimeout", "probeRequestInterval"].forEach(name => {
                        if (!_.isUndefined(value.timeouts[name]) && typeof value.timeouts[name] !== "number") {
                            throw new Error(`"devServer.readinessProbe.timeouts.${name}" must be a number`);
                        }
                    });
                }
            },
            map: value => typeof value === "function"
                ? value
                : {
                    ...defaults.devServer.readinessProbe,
                    ...(value || {}),
                    timeouts: {
                        ...defaults.devServer.readinessProbe.timeouts,
                        ...((value && value.timeouts) || {}),
                    },
                },
        }),
    }),
}));
module.exports = root(rootSection, { envPrefix: ENV_PREFIXES });
//# sourceMappingURL=options.js.map