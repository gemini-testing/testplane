"use strict";

const path = require("path");
const proxyquire = require("proxyquire").noCallThru();
const defaults = require("src/config/defaults");
const { BrowserConfig } = require("src/config/browser-config");

describe("config", () => {
    const sandbox = sinon.createSandbox();

    let parseOptions;

    const initConfig = async opts => {
        opts = opts || {};
        parseOptions = sandbox.stub().returns(opts.configParserReturns);
        const config = Object.prototype.hasOwnProperty.call(opts, "config") ? opts.config : "some-config-path";
        const stubs = {
            "./options": parseOptions,
            ...(opts.stubs ?? {}),
        };

        if (typeof config === "string") {
            const resolvedConfigPath = path.resolve(process.cwd(), config);
            stubs[resolvedConfigPath] = opts.requireConfigReturns || {};
        }
        const Config = proxyquire("../../../src/config", stubs).Config;

        return Config.create(config, opts.allowOverrides);
    };

    afterEach(() => sandbox.restore());

    describe("constructor", () => {
        it("should parse options", async () => {
            await initConfig({ configParserReturns: {} });

            assert.calledOnce(parseOptions);
        });

        it("should parse config from file", async () => {
            await initConfig({ configParserReturns: {}, requireConfigReturns: "some-options" });

            assert.calledWithMatch(parseOptions, { options: "some-options", env: process.env, argv: process.argv });
        });

        it("should support default export", async () => {
            await initConfig({
                configParserReturns: {},
                requireConfigReturns: { __esModule: true, default: { foo: "bar" } },
            });

            assert.calledWithMatch(parseOptions, { options: { foo: "bar" }, env: process.env, argv: process.argv });
        });

        it("should resolve async config function export", async () => {
            await initConfig({
                configParserReturns: {},
                requireConfigReturns: async () => ({ async: "value" }),
            });

            assert.calledWithMatch(parseOptions, {
                options: { async: "value" },
                env: process.env,
                argv: process.argv,
            });
        });

        it("should resolve sync config function export", async () => {
            await initConfig({
                configParserReturns: {},
                requireConfigReturns: () => ({ sync: "value" }),
            });

            assert.calledWithMatch(parseOptions, {
                options: { sync: "value" },
                env: process.env,
                argv: process.argv,
            });
        });

        it("should resolve config function passed directly", async () => {
            await initConfig({
                configParserReturns: {},
                config: async () => ({ direct: "value" }),
            });

            assert.calledWithMatch(parseOptions, {
                options: { direct: "value" },
                env: process.env,
                argv: process.argv,
            });
        });

        it("should parse config from object", async () => {
            await initConfig({ configParserReturns: {}, config: { someOption: "some-value" } });

            assert.calledWithMatch(parseOptions, {
                options: { someOption: "some-value" },
                env: process.env,
                argv: process.argv,
            });
        });

        it("should create config", async () => {
            assert.include(await initConfig({ configParserReturns: { some: "option" } }), { some: "option" });
        });

        it("should extend config with a config path", async () => {
            assert.include(await initConfig({ configParserReturns: {}, config: "config-path" }), {
                configPath: "config-path",
            });
        });

        it('should wrap browser config with "BrowserConfig" instance', async () => {
            const config = await initConfig({
                configParserReturns: {
                    browsers: {
                        bro1: {},
                    },
                },
            });

            assert.instanceOf(config.forBrowser("bro1"), BrowserConfig);
        });

        it("should extend browser config with its id", async () => {
            const config = await initConfig({ configParserReturns: { browsers: { bro: { some: "option" } } } });

            assert.include(config.forBrowser("bro"), { id: "bro" });
        });

        for (const configPath of defaults.configPaths) {
            it(`should look for ${configPath} by default`, async () => {
                const config = await initConfig({
                    config: null,
                    configParserReturns: {
                        system: { fileExtensions: [] },
                    },
                    stubs: {
                        [path.resolve(configPath)]: {},
                    },
                });

                assert.equal(config.configPath, path.resolve(configPath));
            });
        }
    });

    describe("forBrowser", () => {
        it("should get config for a browser", async () => {
            const config = await initConfig({ configParserReturns: { browsers: { bro: { some: "option" } } } });

            assert.include(config.forBrowser("bro"), { some: "option" });
        });
    });

    describe("getBrowserIds", () => {
        it("should get browser ids", async () => {
            const config = await initConfig({ configParserReturns: { browsers: { bro1: {}, bro2: {} } } });

            assert.deepEqual(config.getBrowserIds(), ["bro1", "bro2"]);
        });
    });

    describe("serialize", () => {
        it("should delegate browsers serialization to browser config", async () => {
            const config = await initConfig({
                configParserReturns: {
                    browsers: {
                        bro: {},
                    },
                    configPath: "foo/bar/baz",
                },
            });
            sandbox.stub(BrowserConfig.prototype, "serialize").returns({ foo: "bar" });

            const result = config.serialize();

            assert.deepEqual(result, {
                browsers: {
                    bro: { foo: "bar" },
                },
                configPath: "foo/bar/baz",
            });
        });
    });

    describe("mergeWith", () => {
        it("should deeply merge config with another one", async () => {
            const config = await initConfig({ configParserReturns: { some: { deep: { option: "foo" } } } });

            config.mergeWith({ some: { deep: { option: "bar" } } });

            assert.deepInclude(config, { some: { deep: { option: "bar" } } });
        });

        it("should not merge values of different types", async () => {
            const config = await initConfig({ configParserReturns: { option: 100500 } });

            config.mergeWith({ option: "100500" });

            assert.deepInclude(config, { option: 100500 });
        });
    });
});
