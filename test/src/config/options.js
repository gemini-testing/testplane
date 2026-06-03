"use strict";

const _ = require("lodash");
const { MissingOptionError } = require("gemini-configparser");
const { Config } = require("src/config");
const defaults = require("src/config/defaults");
const parser = require("src/config/options");
const { NODEJS_TEST_RUN_ENV, BROWSER_TEST_RUN_ENV } = require("src/constants/config");

describe("config options", () => {
    const sandbox = sinon.createSandbox();

    const createConfig = () => Config.create("some-config-path");

    const parse_ = (opts = {}) => parser({ env: {}, argv: [], ...opts });

    beforeEach(() => sandbox.stub(Config, "read").returns({}));

    afterEach(() => sandbox.restore());

    describe("system", () => {
        describe("debug", () => {
            it("should throw error if debug is not a boolean", async () => {
                const readConfig = _.set({}, "system.debug", "String");

                Config.read.returns(readConfig);

                await assert.isRejected(createConfig(), '"debug" must be a boolean');
            });

            it("should set default debug option if it does not set in config file", async () => {
                const config = await createConfig();

                assert.equal(config.system.debug, defaults.debug);
            });

            it("should override debug option", async () => {
                const readConfig = _.set({}, "system.debug", true);
                Config.read.returns(readConfig);

                const config = await createConfig();

                assert.equal(config.system.debug, true);
            });
        });

        [
            { optionName: "mochaOpts", subOptionName: "slow" },
            { optionName: "expectOpts", subOptionName: "wait" },
        ].forEach(async ({ optionName, subOptionName }) => {
            describe(`${optionName}`, () => {
                it("should throw error if option is not a null or object", async () => {
                    const readConfig = _.set({}, `system.${optionName}`, ["Array"]);

                    Config.read.returns(readConfig);

                    await assert.isRejected(createConfig(), `"${optionName}" must be an object`);
                });

                it("should set default option if it does not set in config file", async () => {
                    const config = await createConfig();

                    assert.deepEqual(config.system[optionName], defaults[optionName]);
                });

                it("should override option", async () => {
                    const readConfig = _.set({}, `system.${optionName}.${subOptionName}`, 100500);
                    Config.read.returns(readConfig);

                    const config = await createConfig();

                    assert.deepEqual(config.system[optionName][subOptionName], 100500);
                });

                it("should parse option from environment", async () => {
                    const result = parse_({
                        options: { system: { [optionName]: {} } },
                        // prettier-ignore
                        env: {[`testplane_system_${_.snakeCase(optionName)}`]: '{"some": "opts"}'},
                    });

                    assert.deepEqual(result.system[optionName], { some: "opts" });
                });

                it("should prefer existing environment option with testplane_ prefix", async () => {
                    const result = parse_({
                        options: { system: { [optionName]: {} } },
                        env: {
                            [`hermione_system_${_.snakeCase(optionName)}`]: '{"foo": "bar"}',
                            [`testplane_system_${_.snakeCase(optionName)}`]: '{"baz": "qux"}',
                        },
                    });

                    assert.deepEqual(result.system[optionName], { baz: "qux" });
                });

                it("should parse option from cli", async () => {
                    const result = parse_({
                        options: { system: { [optionName]: {} } },
                        argv: [`--system-${_.kebabCase(optionName)}`, '{"some": "opts"}'],
                    });

                    assert.deepEqual(result.system[optionName], { some: "opts" });
                });
            });
        });

        describe("ctx", () => {
            it("should be empty by default", async () => {
                const config = await createConfig();

                assert.deepEqual(config.system.ctx, {});
            });

            it("should override ctx option", async () => {
                const readConfig = _.set({}, "system.ctx", { some: "ctx" });
                Config.read.returns(readConfig);

                const config = await createConfig();

                assert.deepEqual(config.system.ctx, { some: "ctx" });
            });
        });

        describe("patternsOnReject", () => {
            it("should be empty by default", async () => {
                const config = await createConfig();

                assert.deepEqual(config.system.patternsOnReject, []);
            });

            it('should throw error if "patternsOnReject" is not an array', async () => {
                const readConfig = _.set({}, "system.patternsOnReject", {});

                Config.read.returns(readConfig);

                await assert.isRejected(createConfig(), '"patternsOnReject" must be an array');
            });

            it('should override "patternsOnReject" option', async () => {
                const readConfig = _.set({}, "system.patternsOnReject", ["some-pattern"]);
                Config.read.returns(readConfig);

                const config = await createConfig();

                assert.deepEqual(config.system.patternsOnReject, ["some-pattern"]);
            });

            it('should parse "patternsOnReject" option from environment', async () => {
                const result = parse_({
                    options: { system: { patternsOnReject: [] } },
                    // prettier-ignore
                    env: {'testplane_system_patterns_on_reject': '["some-pattern"]'},
                });

                assert.deepEqual(result.system.patternsOnReject, ["some-pattern"]);
            });

            it('should parse "patternsOnReject" options from cli', async () => {
                const result = parse_({
                    options: { system: { patternsOnReject: [] } },
                    argv: ["--system-patterns-on-reject", '["some-pattern"]'],
                });

                assert.deepEqual(result.system.patternsOnReject, ["some-pattern"]);
            });
        });

        describe("workers", () => {
            it("should throw in case of not positive integer", async () => {
                [0, -1, "string", { foo: "bar" }].forEach(async workers => {
                    Config.read.returns({ system: { workers } });

                    await assert.isRejected(createConfig(), '"workers" must be a positive integer');
                });
            });

            it("should equal one by default", async () => {
                const config = await createConfig();

                assert.equal(config.system.workers, 1);
            });

            it("should be overridden from a config", async () => {
                Config.read.returns({ system: { workers: 100500 } });

                const config = await createConfig();

                assert.equal(config.system.workers, 100500);
            });
        });

        describe("diffColor", () => {
            it("should be #ff00ff by default", async () => {
                const config = await createConfig();

                assert.deepEqual(config.system.diffColor, "#ff00ff");
            });

            it("should override diffColor option", async () => {
                const readConfig = _.set({}, "system.diffColor", "#f5f5f5");
                Config.read.returns(readConfig);

                const config = await createConfig();

                assert.equal(config.system.diffColor, "#f5f5f5");
            });

            it("should throw an error if option is not a string", async () => {
                const readConfig = _.set({}, "system.diffColor", 1);

                Config.read.returns(readConfig);

                await assert.isRejected(createConfig(), '"diffColor" must be a string');
            });

            it("should throw an error if option is not a hexadecimal value", async () => {
                const readConfig = _.set({}, "system.diffColor", "#gggggg");

                Config.read.returns(readConfig);

                await assert.isRejected(createConfig(), /"diffColor" must be a hexadecimal/);
            });
        });

        describe("tempDir", () => {
            it("should set default option if it does not set in config file", async () => {
                const config = await createConfig();

                assert.deepEqual(config.system.tempDir, defaults.tempDir);
            });

            it("should override tempDir option", async () => {
                const readConfig = _.set({}, "system.tempDir", "/def/path");
                Config.read.returns(readConfig);

                const config = await createConfig();

                assert.equal(config.system.tempDir, "/def/path");
            });

            it("should throw an error if option is not a string", async () => {
                const readConfig = _.set({}, "system.tempDir", 1);

                Config.read.returns(readConfig);

                await assert.isRejected(createConfig(), '"tempDir" must be a string');
            });
        });

        describe("parallelLimit", () => {
            it("should throw error in case of not positive integer", async () => {
                [0, -1, "10", 10.15, { foo: "bar" }].forEach(async parallelLimit => {
                    Config.read.returns({ system: { parallelLimit } });

                    await assert.isRejected(createConfig(), '"parallelLimit" must be a positive integer');
                });
            });

            it("should be able to pass value is Infinity", async () => {
                Config.read.returns({ system: { parallelLimit: Infinity } });

                const config = await createConfig();

                assert.equal(config.system.parallelLimit, Infinity);
            });

            it("should set default parallelLimit option if it does not set in config file", async () => {
                const config = await createConfig();

                assert.equal(config.system.parallelLimit, defaults.parallelLimit);
            });

            it("should be overridden from a config", async () => {
                Config.read.returns({ system: { parallelLimit: 5 } });

                const config = await createConfig();

                assert.equal(config.system.parallelLimit, 5);
            });

            it("should parse option from environment", async () => {
                const result = parse_({
                    options: { system: { mochaOpts: {} } },
                    // prettier-ignore
                    env: {'testplane_system_parallel_limit': 10},
                });

                assert.equal(result.system.parallelLimit, 10);
            });

            it("should parse option from cli", async () => {
                const result = parse_({
                    options: { system: { parallelLimit: 1 } },
                    argv: ["--system-parallel-limit", "15"],
                });

                assert.equal(result.system.parallelLimit, 15);
            });
        });

        describe("fileExtensions", () => {
            it("should set default extension", async () => {
                const config = await createConfig();

                assert.deepEqual(config.system.fileExtensions, defaults.fileExtensions);
            });

            describe('should throw error if "fileExtensions" option', () => {
                it("is not an array", async () => {
                    const value = {};
                    const readConfig = _.set({}, "system.fileExtensions", value);

                    Config.read.returns(readConfig);

                    await assert.isRejected(
                        createConfig(),
                        `"fileExtensions" must be an array of strings but got ${JSON.stringify(value)}`,
                    );
                });

                it("is not an array of strings", async () => {
                    const value = ["string", 100500];
                    const readConfig = _.set({}, "system.fileExtensions", value);

                    Config.read.returns(readConfig);

                    await assert.isRejected(
                        createConfig(),
                        `fileExtensions" must be an array of strings but got ${JSON.stringify(value)}`,
                    );
                });

                it("has strings that do not start with dot symbol", async () => {
                    const value = [".foo", "bar"];
                    const readConfig = _.set({}, "system.fileExtensions", value);

                    Config.read.returns(readConfig);

                    await assert.isRejected(
                        createConfig(),
                        `Each extension from "fileExtensions" must start with dot symbol but got ${JSON.stringify(
                            value,
                        )}`,
                    );
                });
            });

            it('should set "fileExtensions" option', async () => {
                const fileExtensions = [".foo", ".bar"];
                const readConfig = _.set({}, "system.fileExtensions", fileExtensions);
                Config.read.returns(readConfig);

                const config = await createConfig();

                assert.deepEqual(config.system.fileExtensions, fileExtensions);
            });
        });

        describe("testRunEnv", () => {
            it("should set default test run environment", async () => {
                const config = await createConfig();

                assert.deepEqual(config.system.testRunEnv, defaults.testRunEnv);
            });

            describe('should throw error if "testRunEnv" option', () => {
                it("is not string or array", async () => {
                    const value = 123;
                    const readConfig = _.set({}, "system.testRunEnv", value);
                    Config.read.returns(readConfig);

                    await assert.isRejected(
                        createConfig(),
                        `"testRunEnv" must be an array or string but got ${JSON.stringify(value)}`,
                    );
                });

                it(`is string but not "${NODEJS_TEST_RUN_ENV}" or "${BROWSER_TEST_RUN_ENV}"`, async () => {
                    const readConfig = _.set({}, "system.testRunEnv", "foo");
                    Config.read.returns(readConfig);

                    await assert.isRejected(
                        createConfig(),
                        `"testRunEnv" specified as string must be "${NODEJS_TEST_RUN_ENV}" or "${BROWSER_TEST_RUN_ENV}" but got "foo"`,
                    );
                });

                it(`is array with "${NODEJS_TEST_RUN_ENV}" value`, async () => {
                    const value = [NODEJS_TEST_RUN_ENV];
                    const readConfig = _.set({}, "system.testRunEnv", value);
                    Config.read.returns(readConfig);

                    await assert.isRejected(
                        createConfig(),
                        `"testRunEnv" with "${NODEJS_TEST_RUN_ENV}" value must be specified as string but got ${JSON.stringify(
                            value,
                        )}`,
                    );
                });

                it(`is array with "${BROWSER_TEST_RUN_ENV}" but without options as second element`, async () => {
                    const value = [BROWSER_TEST_RUN_ENV];
                    const readConfig = _.set({}, "system.testRunEnv", value);
                    Config.read.returns(readConfig);

                    await assert.isRejected(
                        createConfig(),
                        `"testRunEnv" specified as array must also contain options as second argument but got ${JSON.stringify(
                            value,
                        )}`,
                    );
                });

                it(`is array without "${BROWSER_TEST_RUN_ENV}" as first element`, async () => {
                    const value = ["foo"];
                    const readConfig = _.set({}, "system.testRunEnv", value);
                    Config.read.returns(readConfig);

                    await assert.isRejected(
                        createConfig(),
                        `"testRunEnv" specified as array must be in format ["${BROWSER_TEST_RUN_ENV}", <options>] but got ${JSON.stringify(
                            value,
                        )}`,
                    );
                });
            });

            it(`should set "testRunEnv" option with ${NODEJS_TEST_RUN_ENV}`, async () => {
                const readConfig = _.set({}, "system.testRunEnv", NODEJS_TEST_RUN_ENV);
                Config.read.returns(readConfig);

                const config = await createConfig();

                assert.deepEqual(config.system.testRunEnv, NODEJS_TEST_RUN_ENV);
            });

            it(`should set "testRunEnv" option with ${BROWSER_TEST_RUN_ENV}`, async () => {
                const readConfig = _.set({}, "system.testRunEnv", BROWSER_TEST_RUN_ENV);
                Config.read.returns(readConfig);

                const config = await createConfig();

                assert.deepEqual(config.system.testRunEnv, BROWSER_TEST_RUN_ENV);
            });

            it(`should set "testRunEnv" option with ${BROWSER_TEST_RUN_ENV} and options`, async () => {
                const readConfig = _.set({}, "system.testRunEnv", [BROWSER_TEST_RUN_ENV, {}]);
                Config.read.returns(readConfig);

                const config = await createConfig();

                assert.deepEqual(config.system.testRunEnv, [BROWSER_TEST_RUN_ENV, {}]);
            });
        });
    });

    describe("lastFailed", () => {
        describe("only", () => {
            it("should throw error if only is not a boolean", async () => {
                const readConfig = {
                    lastFailed: {
                        only: "String",
                    },
                };

                Config.read.returns(readConfig);

                await assert.isRejected(createConfig(), '"lastFailed.only" must be a boolean');
            });
        });

        describe("input", () => {
            it("should throw error if input is not a string", async () => {
                const readConfig = {
                    lastFailed: {
                        input: false,
                    },
                };

                Config.read.returns(readConfig);

                await assert.isRejected(createConfig(), '"lastFailed.input" must be a string or an array');
            });

            it("should throw error if input is a string without .json at the end", async () => {
                const readConfig = {
                    lastFailed: {
                        input: "string",
                    },
                };

                Config.read.returns(readConfig);

                await assert.isRejected(createConfig(), '"lastFailed.input" must have .json extension');
            });

            it("should not throw error if input is a string with .json at the end", async () => {
                const readConfig = {
                    lastFailed: {
                        input: "string.json",
                    },
                };

                Config.read.returns(readConfig);

                await assert.isFulfilled(createConfig());
            });

            it("should throw error if input is an array that contains a string without .json at the end", async () => {
                const readConfig = {
                    lastFailed: {
                        input: ["string.json", "string"],
                    },
                };

                Config.read.returns(readConfig);

                await assert.isRejected(createConfig(), '"lastFailed.input" elements must have .json extension');
            });

            it("should not throw error if input is an array that contains only strings with .json at the end", async () => {
                const readConfig = {
                    lastFailed: {
                        input: ["string.json"],
                    },
                };

                Config.read.returns(readConfig);

                await assert.isFulfilled(createConfig());
            });
        });

        describe("output", () => {
            it("should throw error if output is not a string", async () => {
                const readConfig = {
                    lastFailed: {
                        output: false,
                    },
                };

                Config.read.returns(readConfig);

                await assert.isRejected(createConfig(), '"lastFailed.output" must be a string');
            });

            it("should throw error if output is a string without .json at the end", async () => {
                const readConfig = {
                    lastFailed: {
                        output: "string",
                    },
                };

                Config.read.returns(readConfig);

                await assert.isRejected(createConfig(), '"lastFailed.output" must have .json extension');
            });

            it("should not throw error if output is a string with .json at the end", async () => {
                const readConfig = {
                    lastFailed: {
                        output: "string.json",
                    },
                };

                Config.read.returns(readConfig);

                await assert.isFulfilled(createConfig());
            });
        });

        it("should set default lastFailed option if it does not set in config file", async () => {
            const config = await createConfig();

            assert.deepEqual(config.lastFailed, defaults.lastFailed);
        });

        it("should override lastFailed option", async () => {
            const newValue = {
                input: "some-path.json",
                output: "some-path.json",
                only: true,
            };
            const readConfig = { lastFailed: newValue };

            Config.read.returns(readConfig);

            const config = await createConfig();

            assert.deepEqual(config.lastFailed, newValue);
        });
    });

    describe("prepareEnvironment", () => {
        it("should throw error if prepareEnvironment is not a null or function", async () => {
            const readConfig = { prepareEnvironment: "String" };

            Config.read.returns(readConfig);

            await assert.isRejected(createConfig(), '"prepareEnvironment" must be a function');
        });

        it("should set default prepareEnvironment option if it does not set in config file", async () => {
            const config = await createConfig();

            assert.equal(config.prepareEnvironment, defaults.prepareEnvironment);
        });

        it("should override prepareEnvironment option", async () => {
            const newFunc = () => {};
            const readConfig = { prepareEnvironment: newFunc };

            Config.read.returns(readConfig);

            const config = await createConfig();

            assert.deepEqual(config.prepareEnvironment, newFunc);
        });
    });

    describe("hooks beforeAll/afterAll", () => {
        it("should throw error if beforeAll is not a null or function", async () => {
            const readConfig = { beforeAll: "String" };

            Config.read.returns(readConfig);

            await assert.isRejected(createConfig(), '"beforeAll" must be a function');
        });

        it("should set default beforeAll option if it does not set in config file", async () => {
            const config = await createConfig();

            assert.equal(config.beforeAll, defaults.beforeAll);
        });

        it("should override beforeAll option", async () => {
            const newFunc = () => {};
            const readConfig = { beforeAll: newFunc };

            Config.read.returns(readConfig);

            const config = await createConfig();

            assert.deepEqual(config.beforeAll, newFunc);
        });

        it("should throw error if afterAll is not a null or function", async () => {
            const readConfig = { afterAll: "String" };

            Config.read.returns(readConfig);

            await assert.isRejected(createConfig(), '"afterAll" must be a function');
        });

        it("should set default afterAll option if it does not set in config file", async () => {
            const config = await createConfig();

            assert.equal(config.afterAll, defaults.afterAll);
        });

        it("should override afterAll option", async () => {
            const newFunc = () => {};
            const readConfig = { afterAll: newFunc };

            Config.read.returns(readConfig);

            const config = await createConfig();

            assert.deepEqual(config.afterAll, newFunc);
        });
    });

    describe("plugins", () => {
        it("should parse boolean value from environment", async () => {
            const result = parse_({
                options: { plugins: { foo: {} } },
                // prettier-ignore
                env: {'testplane_plugins_foo': 'true'},
            });

            assert.strictEqual(result.plugins.foo, true);
        });

        it("should parse object value from environment", async () => {
            const result = parse_({
                options: { plugins: { foo: {} } },
                // prettier-ignore
                env: {'testplane_plugins_foo': '{"opt": 1}'},
            });

            assert.deepEqual(result.plugins.foo, { opt: 1 });
        });

        it("should throw error on invalid values from environment", async () => {
            assert.throws(
                () =>
                    parse_({
                        options: { plugins: { foo: {} } },
                        // prettier-ignore
                        env: {'testplane_plugins_foo': '{key: 1}'},
                    }),
                "a value must be a primitive type",
            );
        });

        it("should parse boolean value from cli", async () => {
            const result = parse_({
                options: { plugins: { foo: {} } },
                argv: ["--plugins-foo", "true"],
            });

            assert.strictEqual(result.plugins.foo, true);
        });

        it("should parse object value from cli", async () => {
            const result = parse_({
                options: { plugins: { foo: {} } },
                argv: ["--plugins-foo", '{"opt": 1}'],
            });

            assert.deepEqual(result.plugins.foo, { opt: 1 });
        });

        it("should throw error on invalid values from cli", async () => {
            assert.throws(
                () =>
                    parse_({
                        options: { plugins: { foo: {} } },
                        argv: ["--plugins-foo", "{key: 1}"],
                    }),
                "a value must be a primitive type",
            );
        });
    });

    describe("shouldRetry", () => {
        it("should throw error if shouldRetry is not a function", async () => {
            const readConfig = _.set({}, "shouldRetry", "shouldRetry");

            Config.read.returns(readConfig);

            await assert.isRejected(createConfig(), '"shouldRetry" must be a function');
        });

        it("should set default shouldRetry option if it does not set in config file", async () => {
            const config = await createConfig();

            assert.equal(config.shouldRetry, null);
        });

        it("should override shouldRetry option", async () => {
            const shouldRetry = () => {};
            const readConfig = _.set({}, "shouldRetry", shouldRetry);
            Config.read.returns(readConfig);

            const config = await createConfig();

            assert.equal(config.shouldRetry, shouldRetry);
        });
    });

    describe("sets", () => {
        const parseOpts_ = (options = {}) => {
            options.browsers = _.mapValues(options.browsers, broConfig => ({ desiredCapabilities: {}, ...broConfig }));
            return parse_({ options });
        };

        describe("files", () => {
            it("should throw an error if files are not specified", async () => {
                assert.throws(() => {
                    parseOpts_({
                        sets: {
                            someSet: {},
                        },
                    });
                }, MissingOptionError);
            });

            it("should convert string to array of strings", async () => {
                const config = parseOpts_({
                    sets: {
                        someSet: {
                            files: "some/path",
                        },
                    },
                });

                assert.deepEqual(config.sets.someSet.files, ["some/path"]);
            });

            it("should throw an error if files are specified as non-string array", async () => {
                assert.throws(
                    () => {
                        parseOpts_({
                            sets: {
                                someSet: {
                                    files: [100500],
                                },
                            },
                        });
                    },
                    Error,
                    /"sets.files" must be an array of strings/,
                );
            });

            it("should accept array with strings", async () => {
                const config = parseOpts_({
                    sets: {
                        someSet: {
                            files: ["some/path", "other/path"],
                        },
                    },
                });

                assert.deepEqual(config.sets.someSet.files, ["some/path", "other/path"]);
            });
        });

        describe("ignoreFiles", () => {
            it("should accept array with strings", async () => {
                const config = parseOpts_({
                    sets: {
                        someSet: {
                            files: ["foo"],
                            ignoreFiles: ["foo/bar", "baz"],
                        },
                    },
                });

                assert.deepEqual(config.sets.someSet.ignoreFiles, ["foo/bar", "baz"]);
            });

            describe("should throw an error", () => {
                const errorMask = /"sets.ignoreFiles" must be an array of strings/;

                it('if "ignoreFiles" is not array', async () => {
                    assert.throws(
                        () => {
                            parseOpts_({
                                sets: {
                                    someSet: {
                                        files: ["foo"],
                                        ignoreFiles: 100500,
                                    },
                                },
                            });
                        },
                        Error,
                        errorMask,
                    );
                });

                it('if "ignoreFiles" are specified as non-string array', async () => {
                    assert.throws(
                        () => {
                            parseOpts_({
                                sets: {
                                    someSet: {
                                        files: ["foo"],
                                        ignoreFiles: [100, 500],
                                    },
                                },
                            });
                        },
                        Error,
                        errorMask,
                    );
                });
            });
        });

        describe("browsers", () => {
            it("should contain all browsers from config by default", async () => {
                const config = parseOpts_({
                    browsers: {
                        b1: {},
                        b2: {},
                    },
                    sets: {
                        someSet: {
                            files: ["some/path"],
                        },
                    },
                });

                assert.deepEqual(config.sets.someSet.browsers, ["b1", "b2"]);
            });

            it("should throw an error if browsers are not specified as array", async () => {
                const config = {
                    sets: {
                        someSet: {
                            files: ["some/path"],
                            browsers: "something",
                        },
                    },
                };

                assert.throws(() => parseOpts_(config), Error, /"sets.browsers" must be an array/);
            });

            it("should throw an error if sets contain unknown browsers", async () => {
                assert.throws(
                    () => {
                        parseOpts_({
                            browsers: {
                                b1: {},
                                b2: {},
                            },
                            sets: {
                                someSet: {
                                    files: ["some/path"],
                                    browsers: ["b3"],
                                },
                            },
                        });
                    },
                    Error,
                    /Unknown browsers for "sets.browsers": b3/,
                );
            });

            it("should use browsers which are specified in config", async () => {
                const config = parseOpts_({
                    browsers: {
                        b1: {},
                        b2: {},
                    },
                    sets: {
                        set1: {
                            files: ["some/path"],
                            browsers: ["b1"],
                        },
                        set2: {
                            files: ["other/path"],
                            browsers: ["b2"],
                        },
                    },
                });

                assert.deepEqual(config.sets.set1.browsers, ["b1"]);
                assert.deepEqual(config.sets.set2.browsers, ["b2"]);
            });
        });

        it("should have default set with empty files and all browsers if sets are not specified", async () => {
            const config = parseOpts_({
                browsers: {
                    b1: {},
                    b2: {},
                },
            });

            assert.deepEqual(config.sets, { "": { files: [], browsers: ["b1", "b2"], ignoreFiles: [] } });
        });
    });

    describe("devServer.readinessProbe", () => {
        const assertReadinessProbeThrows = (readinessProbe, errorMessage) => {
            return assert.throws(() => {
                parse_({
                    options: {
                        devServer: {
                            readinessProbe,
                        },
                    },
                });
            }, errorMessage);
        };

        it("could be a function", async () => {
            const config = parse_({
                options: {
                    devServer: {
                        readinessProbe: () => {},
                    },
                },
            });

            assert.isFunction(config.devServer.readinessProbe);
        });

        it("could be empty", async () => {
            const config = parse_({
                options: {
                    devServer: {
                        readinessProbe: {},
                    },
                },
            });

            assert.deepEqual(config.devServer.readinessProbe, defaults.devServer.readinessProbe);
        });

        it("could have string url", async () => {
            const config = parse_({
                options: {
                    devServer: {
                        readinessProbe: {
                            url: "foo",
                        },
                    },
                },
            });

            assert.deepEqual(config.devServer.readinessProbe.url, "foo");
        });

        it("could have custom isReady function", async () => {
            const config = parse_({
                options: {
                    devServer: {
                        readinessProbe: {
                            isReady: () => {},
                        },
                    },
                },
            });

            assert.isFunction(config.devServer.readinessProbe.isReady);
        });

        it("could have overwritted timeouts", async () => {
            const config = parse_({
                options: {
                    devServer: {
                        readinessProbe: {
                            timeouts: {
                                probeRequestTimeout: 100500,
                            },
                        },
                    },
                },
            });

            assert.equal(config.devServer.readinessProbe.timeouts.probeRequestTimeout, 100500);
            assert.equal(
                config.devServer.readinessProbe.timeouts.waitServerTimeout,
                defaults.devServer.readinessProbe.timeouts.waitServerTimeout,
            );
            assert.equal(
                config.devServer.readinessProbe.timeouts.probeRequestInterval,
                defaults.devServer.readinessProbe.timeouts.probeRequestInterval,
            );
        });

        it("should be a function or object", async () => {
            assertReadinessProbeThrows("foo", '"devServer.readinessProbe" must be a function, object or null');
        });

        it("url property should be a string", async () => {
            assertReadinessProbeThrows({ url: {} }, '"devServer.readinessProbe.url" must be a string or null');
        });

        it("isReady property should be a function", async () => {
            assertReadinessProbeThrows(
                { isReady: {} },
                '"devServer.readinessProbe.isReady" must be a function or null',
            );
        });

        it("timeouts property should be an object", async () => {
            assertReadinessProbeThrows({ timeouts: () => {} }, '"devServer.readinessProbe.timeouts" must be an object');
        });

        ["waitServerTimeout", "probeRequestTimeout", "probeRequestInterval"].forEach(timeoutName => {
            it(`timeouts.${timeoutName} should be a number`, async () => {
                assertReadinessProbeThrows(
                    { timeouts: { [timeoutName]: "foo" } },
                    `"devServer.readinessProbe.timeouts.${timeoutName}" must be a number`,
                );
            });
        });
    });
});
