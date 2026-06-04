"use strict";

const _ = require("lodash");
const fs = require("fs-extra");

const { Config, TimeTravelMode } = require("src/config");
const defaults = require("src/config/defaults");
const { WEBDRIVER_PROTOCOL, DEVTOOLS_PROTOCOL, SAVE_HISTORY_MODE } = require("src/constants/config");
const { BROWSERS_SUPPORT_BIDI } = require("src/constants/browser");

describe("config browser-options", () => {
    const sandbox = sinon.createSandbox();

    const mkBrowser_ = opts => {
        return _.defaults(opts || {}, {
            desiredCapabilities: {},
        });
    };

    const createConfig = () => Config.create("some-config-path");

    beforeEach(() => {
        sandbox.stub(Config, "read").returns({});
        sandbox.stub(console, "warn").returns();
    });

    afterEach(() => sandbox.restore());

    describe("desiredCapabilities", () => {
        describe("should throw error if desiredCapabilities", () => {
            it("is missing", async () => {
                const readConfig = {
                    browsers: {
                        b1: {},
                    },
                };

                Config.read.resolves(readConfig);

                await assert.isRejected(createConfig(), 'Each browser must have "desiredCapabilities" option');
            });

            it("is not an object or null", async () => {
                const readConfig = {
                    browsers: {
                        b1: {
                            desiredCapabilities: "chrome",
                        },
                    },
                };

                Config.read.resolves(readConfig);

                await assert.isRejected(createConfig(), '"desiredCapabilities" must be an object');
            });
        });

        describe("BiDi protocol", () => {
            BROWSERS_SUPPORT_BIDI.forEach(async ({ name: browserName, minVersion }) => {
                describe(browserName, () => {
                    it("should throw error if browser not support protocol", async () => {
                        const browserVersion = `${minVersion - 1}.0`;
                        const readConfig = {
                            browsers: {
                                b1: {
                                    desiredCapabilities: {
                                        browserName,
                                        browserVersion,
                                        webSocketUrl: true,
                                    },
                                },
                            },
                        };

                        Config.read.resolves(readConfig);

                        await assert.isRejected(
                            createConfig(),
                            `BiDi protocol is not supported in ${browserName}@${browserVersion}, use ${browserName}@${minVersion}.0 and higher`,
                        );
                    });

                    it("should not throw if browser support protocol", async () => {
                        const readConfig = {
                            browsers: {
                                b1: {
                                    desiredCapabilities: {
                                        browserName,
                                        browserVersion: `${minVersion}.0`,
                                        webSocketUrl: true,
                                    },
                                },
                            },
                        };

                        Config.read.resolves(readConfig);

                        await assert.isFulfilled(createConfig());
                    });

                    it('should not throw if "browserVersion" is not specified', async () => {
                        const readConfig = {
                            browsers: {
                                b1: {
                                    desiredCapabilities: {
                                        browserName,
                                        webSocketUrl: true,
                                    },
                                },
                            },
                        };

                        Config.read.resolves(readConfig);

                        await assert.isFulfilled(createConfig());
                    });
                });
            });
        });

        it("should set desiredCapabilities", async () => {
            const readConfig = {
                browsers: {
                    b1: {
                        desiredCapabilities: {
                            browserName: "yabro",
                        },
                    },
                },
            };

            Config.read.resolves(readConfig);

            const config = await createConfig();

            assert.deepEqual(config.browsers.b1.desiredCapabilities, { browserName: "yabro" });
        });
    });

    describe("baseUrl", () => {
        it("should throw error if baseUrl is not a string", async () => {
            const readConfig = {
                browsers: {
                    b1: mkBrowser_({ baseUrl: ["Array"] }),
                },
            };

            Config.read.resolves(readConfig);

            await assert.isRejected(createConfig(), '"baseUrl" must be a string');
        });

        it("should set baseUrl to all browsers", async () => {
            const baseUrl = "http://default.com";
            const readConfig = {
                baseUrl,
                browsers: {
                    b1: mkBrowser_(),
                    b2: mkBrowser_(),
                },
            };

            Config.read.resolves(readConfig);

            const config = await createConfig();

            assert.equal(config.browsers.b1.baseUrl, baseUrl);
            assert.equal(config.browsers.b2.baseUrl, baseUrl);
        });

        it("should override baseUrl option if protocol is set", async () => {
            const baseUrl = "http://default.com";
            const readConfig = {
                baseUrl,
                browsers: {
                    b1: mkBrowser_(),
                    b2: mkBrowser_({ baseUrl: "http://foo.com" }),
                },
            };

            Config.read.resolves(readConfig);

            const config = await createConfig();

            assert.equal(config.browsers.b1.baseUrl, baseUrl);
            assert.equal(config.browsers.b2.baseUrl, "http://foo.com");
        });

        it("should resolve baseUrl option relative to top level baseUrl", async () => {
            const baseUrl = "http://default.com";
            const readConfig = {
                baseUrl,
                browsers: {
                    b1: mkBrowser_(),
                    b2: mkBrowser_({ baseUrl: "/test" }),
                },
            };

            Config.read.resolves(readConfig);

            const config = await createConfig();

            assert.equal(config.browsers.b1.baseUrl, baseUrl);
            assert.equal(config.browsers.b2.baseUrl, "http://default.com/test");
        });

        it("should resolve baseUrl option relative to top level baseUrl with path", async () => {
            const baseUrl = "http://default.com/search/";
            const readConfig = {
                baseUrl,
                browsers: {
                    b1: mkBrowser_(),
                    b2: mkBrowser_({ baseUrl: "/test" }),
                },
            };

            Config.read.resolves(readConfig);

            const config = await createConfig();

            assert.equal(config.browsers.b1.baseUrl, baseUrl);
            assert.equal(config.browsers.b2.baseUrl, "http://default.com/search/test");
        });
    });

    [
        { optionName: "gridUrl", uriScheme: "http" },
        { optionName: "browserWSEndpoint", uriScheme: "ws" },
    ].forEach(async ({ optionName, uriScheme }) => {
        describe(optionName, () => {
            it("should throw error if option is not a string", async () => {
                const readConfig = {
                    browsers: {
                        b1: mkBrowser_({ [optionName]: /regExp/ }),
                    },
                };

                Config.read.resolves(readConfig);

                await assert.isRejected(createConfig(), `"${optionName}" must be a string`);
            });

            it("should set option to all browsers", async () => {
                const optionValue = `${uriScheme}://default.com`;
                const readConfig = {
                    [optionName]: optionValue,
                    browsers: {
                        b1: mkBrowser_(),
                        b2: mkBrowser_(),
                    },
                };

                Config.read.resolves(readConfig);

                const config = await createConfig();

                assert.equal(config.browsers.b1[optionName], optionValue);
                assert.equal(config.browsers.b2[optionName], optionValue);
            });

            it("should override option", async () => {
                const optionValue = `${uriScheme}://default.com`;
                const readConfig = {
                    [optionName]: optionValue,
                    browsers: {
                        b1: mkBrowser_(),
                        b2: mkBrowser_({ [optionName]: `${uriScheme}://bar.com` }),
                    },
                };

                Config.read.resolves(readConfig);

                const config = await createConfig();

                assert.equal(config.browsers.b1[optionName], optionValue);
                assert.equal(config.browsers.b2[optionName], `${uriScheme}://bar.com`);
            });
        });
    });

    describe("browserWSEndpoint", () => {
        it("should throw an error if option value does not start with WebSocket protocol", async () => {
            const readConfig = {
                browsers: {
                    b1: mkBrowser_({ browserWSEndpoint: "http://endpoint.com" }),
                },
            };

            Config.read.resolves(readConfig);

            await assert.isRejected(
                createConfig(),
                /"browserWSEndpoint" must start with "ws:\/\/" or "wss:\/\/" prefix/,
            );
        });

        describe("should not throw an error if option value start with", () => {
            ["ws", "wss"].forEach(async protocol => {
                it(protocol, async () => {
                    const readConfig = {
                        browsers: {
                            b1: mkBrowser_({ browserWSEndpoint: `${protocol}://endpoint.com` }),
                        },
                    };

                    Config.read.resolves(readConfig);

                    await assert.isFulfilled(createConfig());
                });
            });
        });
    });

    describe("automationProtocol", () => {
        it("should throw an error if option value is not string", async () => {
            const readConfig = {
                browsers: {
                    b1: mkBrowser_({ automationProtocol: { not: "string" } }),
                },
            };

            Config.read.resolves(readConfig);

            await assert.isRejected(createConfig(), /"automationProtocol" must be a string/);
        });

        it(`should throw an error if option value is not "${WEBDRIVER_PROTOCOL}" or "${DEVTOOLS_PROTOCOL}"`, async () => {
            const readConfig = {
                browsers: {
                    b1: mkBrowser_({ automationProtocol: "foo bar" }),
                },
            };

            Config.read.resolves(readConfig);

            await assert.isRejected(
                createConfig(),
                new RegExp(`"automationProtocol" must be "${WEBDRIVER_PROTOCOL}" or "${DEVTOOLS_PROTOCOL}"`),
            );
        });

        describe("should not throw an error if option value is", () => {
            [WEBDRIVER_PROTOCOL, DEVTOOLS_PROTOCOL].forEach(async value => {
                it(`${value}`, async () => {
                    const readConfig = {
                        browsers: {
                            b1: mkBrowser_({ automationProtocol: value }),
                        },
                    };

                    Config.read.resolves(readConfig);

                    await assert.isFulfilled(createConfig());
                });
            });
        });

        it("should set a default value if it is not set in config", async () => {
            const readConfig = {
                browsers: {
                    b1: mkBrowser_(),
                },
            };

            Config.read.resolves(readConfig);

            const config = await createConfig();

            assert.equal(config.automationProtocol, defaults.automationProtocol);
        });

        it("should override option for browser", async () => {
            const readConfig = {
                automationProtocol: WEBDRIVER_PROTOCOL,
                browsers: {
                    b1: mkBrowser_(),
                    b2: mkBrowser_({ automationProtocol: DEVTOOLS_PROTOCOL }),
                },
            };

            Config.read.resolves(readConfig);

            const config = await createConfig();

            assert.equal(config.browsers.b1.automationProtocol, WEBDRIVER_PROTOCOL);
            assert.equal(config.browsers.b2.automationProtocol, DEVTOOLS_PROTOCOL);
        });
    });

    describe("sessionEnvFlags", () => {
        it("should throw an error if option value is not an object", async () => {
            const readConfig = {
                browsers: {
                    b1: mkBrowser_({ sessionEnvFlags: "string" }),
                },
            };

            Config.read.resolves(readConfig);

            await assert.isRejected(createConfig(), /"sessionEnvFlags" must be an object/);
        });

        it("should throw an error if option value is not available", async () => {
            const readConfig = {
                browsers: {
                    b1: mkBrowser_({ sessionEnvFlags: { a: "b" } }),
                },
            };

            Config.read.resolves(readConfig);

            await assert.isRejected(createConfig(), /keys of "sessionEnvFlags" must be one of:/);
        });

        it("should throw an error if value inside available option is not boolean", async () => {
            const readConfig = {
                browsers: {
                    b1: mkBrowser_({ sessionEnvFlags: { isW3C: "string" } }),
                },
            };

            Config.read.resolves(readConfig);

            await assert.isRejected(createConfig(), /values of "sessionEnvFlags" must be boolean/);
        });

        describe("should not throw an error if option key is", () => {
            ["isW3C", "isChrome", "isMobile", "isIOS", "isAndroid", "isSauce", "isSeleniumStandalone"].forEach(
                async key => {
                    it(`"${key}" and value is boolean`, async () => {
                        const readConfig = {
                            browsers: {
                                b1: mkBrowser_({ sessionEnvFlags: { [key]: true } }),
                            },
                        };

                        Config.read.resolves(readConfig);

                        await assert.isFulfilled(createConfig());
                    });
                },
            );
        });

        it("should set a default value if it is not set in config", async () => {
            const readConfig = {
                browsers: {
                    b1: mkBrowser_(),
                },
            };

            Config.read.resolves(readConfig);

            const config = await createConfig();

            assert.deepEqual(config.sessionEnvFlags, defaults.sessionEnvFlags);
        });

        it("should override option for browser", async () => {
            const readConfig = {
                sessionEnvFlags: { isW3C: true },
                browsers: {
                    b1: mkBrowser_(),
                    b2: mkBrowser_({ sessionEnvFlags: { isW3C: false } }),
                },
            };

            Config.read.resolves(readConfig);

            const config = await createConfig();

            assert.deepEqual(config.browsers.b1.sessionEnvFlags, { isW3C: true });
            assert.deepEqual(config.browsers.b2.sessionEnvFlags, { isW3C: false });
        });
    });

    describe("prepareBrowser", () => {
        it("should throw error if prepareBrowser is not a null or function", async () => {
            const readConfig = {
                browsers: {
                    b1: mkBrowser_({ prepareBrowser: "String" }),
                },
            };

            Config.read.resolves(readConfig);

            await assert.isRejected(createConfig(), '"prepareBrowser" must be a function');
        });

        it("should set prepareBrowser to all browsers", async () => {
            const prepareBrowser = () => {};
            const readConfig = {
                prepareBrowser,
                browsers: {
                    b1: mkBrowser_(),
                    b2: mkBrowser_(),
                },
            };

            Config.read.resolves(readConfig);

            const config = await createConfig();

            assert.equal(config.browsers.b1.prepareBrowser, prepareBrowser);
            assert.equal(config.browsers.b2.prepareBrowser, prepareBrowser);
        });

        it("should override prepareBrowser option", async () => {
            const prepareBrowser = () => {};
            const newFunc = () => {};

            const readConfig = {
                prepareBrowser,
                browsers: {
                    b1: mkBrowser_(),
                    b2: mkBrowser_({ prepareBrowser: newFunc }),
                },
            };

            Config.read.resolves(readConfig);

            const config = await createConfig();

            assert.equal(config.browsers.b1.prepareBrowser, prepareBrowser);
            assert.equal(config.browsers.b2.prepareBrowser, newFunc);
        });
    });

    describe("screenshotsDir", () => {
        it("should set a default screenshotsDir option if it is not set in config", async () => {
            const config = await createConfig();

            assert.equal(config.screenshotsDir, defaults.screenshotsDir);
        });

        it("should throw an error if a value is not a string or function", async () => {
            const readConfig = {
                browsers: {
                    b1: mkBrowser_({ screenshotsDir: ["Array"] }),
                },
            };

            Config.read.resolves(readConfig);

            await assert.isRejected(createConfig(), '"screenshotsDir" must be a string or function');
        });

        it("should does not throw if a value is a function", async () => {
            const readConfig = {
                screenshotsDir: () => {},
                browsers: {
                    b1: mkBrowser_(),
                },
            };

            Config.read.resolves(readConfig);

            await assert.isFulfilled(createConfig());
        });

        it("should set screenshotsDir option to all browsers", async () => {
            const screenshotsDir = "/some/dir";
            const readConfig = {
                screenshotsDir,
                browsers: {
                    b1: mkBrowser_(),
                    b2: mkBrowser_(),
                },
            };

            Config.read.resolves(readConfig);

            const config = await createConfig();

            assert.equal(config.browsers.b1.screenshotsDir, "/some/dir");
            assert.equal(config.browsers.b2.screenshotsDir, "/some/dir");
        });

        it("should override screenshotsDir option per browser", async () => {
            const screenshotsDir = "/some/dir";
            const readConfig = {
                screenshotsDir,
                browsers: {
                    b1: mkBrowser_(),
                    b2: mkBrowser_({ screenshotsDir: "/screens" }),
                },
            };

            Config.read.resolves(readConfig);

            const config = await createConfig();

            assert.equal(config.browsers.b1.screenshotsDir, "/some/dir");
            assert.equal(config.browsers.b2.screenshotsDir, "/screens");
        });

        it("should fallback default value to hermione/screens, if it exists and default dir not exists", async () => {
            const readConfig = {
                browsers: {
                    b1: mkBrowser_(),
                },
            };
            Config.read.resolves(readConfig);
            sandbox
                .stub(fs, "existsSync")
                .withArgs("hermione/screens")
                .returns(true)
                .withArgs("testplane/screens")
                .returns(false);

            const config = await createConfig();

            assert.equal(config.screenshotsDir, "hermione/screens");
            assert.equal(config.browsers.b1.screenshotsDir, "hermione/screens");
        });

        it("should use default testplane/screens if both hermione/screens and testplane/screens exists", async () => {
            const readConfig = {
                browsers: {
                    b1: mkBrowser_(),
                },
            };
            Config.read.resolves(readConfig);
            sandbox
                .stub(fs, "existsSync")
                .withArgs("hermione/screens")
                .returns(true)
                .withArgs("testplane/screens")
                .returns(true);

            const config = await createConfig();

            assert.equal(config.screenshotsDir, "testplane/screens");
            assert.equal(config.browsers.b1.screenshotsDir, "testplane/screens");
        });

        it("should not fallback default value to hermione/screens, if not exists", async () => {
            const readConfig = {
                browsers: {
                    b1: mkBrowser_(),
                },
            };
            Config.read.resolves(readConfig);
            sandbox
                .stub(fs, "existsSync")
                .withArgs("hermione/screens")
                .returns(false)
                .withArgs("testplane/screens")
                .returns(false);

            const config = await createConfig();

            assert.equal(config.screenshotsDir, "testplane/screens");
            assert.equal(config.browsers.b1.screenshotsDir, "testplane/screens");
        });

        it("should not fallback value to hermione/screens, if defined", async () => {
            const readConfig = {
                screenshotsDir: "some/dir",
                browsers: {
                    b1: mkBrowser_({ screenshotsDir: "another/dir" }),
                },
            };
            Config.read.resolves(readConfig);
            sandbox
                .stub(fs, "existsSync")
                .withArgs("hermione/screens")
                .returns(true)
                .withArgs("testplane/screens")
                .returns(false);

            const config = await createConfig();

            assert.equal(config.screenshotsDir, "some/dir");
            assert.equal(config.browsers.b1.screenshotsDir, "another/dir");
        });
    });

    ["sessionsPerBrowser", "waitTimeout"].forEach(async option => {
        describe(`${option}`, () => {
            describe(`should throw error if ${option}`, () => {
                it("is not a number", async () => {
                    const readConfig = {
                        browsers: {
                            b1: mkBrowser_({ [option]: "10" }),
                        },
                    };

                    Config.read.resolves(readConfig);

                    await assert.isRejected(createConfig(), `"${option}" must be a positive integer`);
                });

                it("is negative number", async () => {
                    const readConfig = {
                        browsers: {
                            b1: mkBrowser_({ [option]: -5 }),
                        },
                    };

                    Config.read.resolves(readConfig);

                    await assert.isRejected(createConfig(), `"${option}" must be a positive integer`);
                });

                it("is float number", async () => {
                    const readConfig = {
                        browsers: {
                            b1: mkBrowser_({ [option]: 15.5 }),
                        },
                    };

                    Config.read.resolves(readConfig);

                    await assert.isRejected(createConfig(), `"${option}" must be a positive integer`);
                });
            });

            it(`should set ${option} to all browsers`, async () => {
                const readConfig = {
                    [option]: 666,
                    browsers: {
                        b1: mkBrowser_(),
                        b2: mkBrowser_(),
                    },
                };

                Config.read.resolves(readConfig);

                const config = await createConfig();

                assert.equal(config.browsers.b1[option], 666);
                assert.equal(config.browsers.b2[option], 666);
            });

            it(`should override ${option} option`, async () => {
                const readConfig = {
                    [option]: 666,
                    browsers: {
                        b1: mkBrowser_(),
                        b2: mkBrowser_(_.set({}, option, 13)),
                    },
                };

                Config.read.resolves(readConfig);

                const config = await createConfig();

                assert.equal(config.browsers.b1[option], 666);
                assert.equal(config.browsers.b2[option], 13);
            });
        });
    });

    describe("testsPerSession", () => {
        describe('should throw error if "testsPerSession"', () => {
            it("is not a number", async () => {
                const readConfig = {
                    browsers: {
                        b1: mkBrowser_({ testsPerSession: "10" }),
                    },
                };

                Config.read.resolves(readConfig);

                await assert.isRejected(createConfig(), '"testsPerSession" must be a positive integer or Infinity');
            });

            it("is a negative number", async () => {
                const readConfig = {
                    browsers: {
                        b1: mkBrowser_({ testsPerSession: -5 }),
                    },
                };

                Config.read.resolves(readConfig);

                await assert.isRejected(createConfig(), '"testsPerSession" must be a positive integer or Infinity');
            });

            it("is a float number", async () => {
                const readConfig = {
                    browsers: {
                        b1: mkBrowser_({ testsPerSession: 15.5 }),
                    },
                };

                Config.read.resolves(readConfig);

                await assert.isRejected(createConfig(), '"testsPerSession" must be a positive integer or Infinity');
            });
        });

        it('should set "testsPerSession" to all browsers', async () => {
            const readConfig = {
                testsPerSession: 666,
                browsers: {
                    b1: mkBrowser_(),
                    b2: mkBrowser_(),
                },
            };

            Config.read.resolves(readConfig);

            const config = await createConfig();

            assert.equal(config.browsers.b1.testsPerSession, 666);
            assert.equal(config.browsers.b2.testsPerSession, 666);
        });

        it('should override "testsPerSession option"', async () => {
            const readConfig = {
                testsPerSession: 666,
                browsers: {
                    b1: mkBrowser_(),
                    b2: mkBrowser_({ testsPerSession: 13 }),
                },
            };

            Config.read.resolves(readConfig);

            const config = await createConfig();

            assert.equal(config.browsers.b1.testsPerSession, 666);
            assert.equal(config.browsers.b2.testsPerSession, 13);
        });
    });

    function testNonNegativeIntegerOption(option) {
        it(`should throw error if ${option} is not a number`, async () => {
            const readConfig = {
                browsers: {
                    b1: mkBrowser_({ [option]: "100500" }),
                },
            };

            Config.read.resolves(readConfig);

            await assert.isRejected(createConfig(), `"${option}" must be a non-negative integer`);
        });

        it(`should throw error if ${option} is negative`, async () => {
            const readConfig = {
                browsers: {
                    b1: mkBrowser_({ [option]: -7 }),
                },
            };

            Config.read.resolves(readConfig);

            await assert.isRejected(createConfig(), `"${option}" must be a non-negative integer`);
        });

        it(`should set ${option} option to all browsers`, async () => {
            const readConfig = {
                [option]: 100500,
                browsers: {
                    b1: mkBrowser_(),
                    b2: mkBrowser_(),
                },
            };

            Config.read.resolves(readConfig);

            const config = await createConfig();

            assert.equal(config.browsers.b1[option], 100500);
            assert.equal(config.browsers.b2[option], 100500);
        });

        it(`should override ${option} option`, async () => {
            const readConfig = {
                [option]: 100500,
                browsers: {
                    b1: mkBrowser_(),
                    b2: mkBrowser_({ [option]: 500100 }),
                },
            };

            Config.read.resolves(readConfig);

            const config = await createConfig();

            assert.equal(config.browsers.b1[option], 100500);
            assert.equal(config.browsers.b2[option], 500100);
        });
    }

    ["retry", "httpTimeout", "screenshotDelay"].forEach(option =>
        describe(option, () => testNonNegativeIntegerOption(option)),
    );

    function testOptionalNonNegativeIntegerOption(option) {
        testNonNegativeIntegerOption(option);

        it(`should does not throw an error if ${option} is null`, async () => {
            const readConfig = {
                browsers: {
                    b1: mkBrowser_({ [option]: null }),
                },
            };

            Config.read.resolves(readConfig);

            await assert.isFulfilled(createConfig());
        });
    }

    [
        "sessionRequestTimeout",
        "sessionQuitTimeout",
        "pageLoadTimeout",
        "testTimeout",
        "urlHttpTimeout",
        "takeScreenshotOnFailsTimeout",
    ].forEach(option => describe(option, () => testOptionalNonNegativeIntegerOption(option)));

    describe("meta", () => {
        it('should throw error if "meta" is not a object', async () => {
            const readConfig = {
                browsers: {
                    b1: mkBrowser_({ meta: "meta-string" }),
                },
            };

            Config.read.resolves(readConfig);

            await assert.isRejected(createConfig(), '"meta" must be an object');
        });

        it("should set null by default", async () => {
            const readConfig = {
                browsers: {
                    b1: mkBrowser_({}),
                },
            };

            Config.read.resolves(readConfig);

            const config = await createConfig();

            assert.equal(config.browsers.b1.meta, null);
        });

        it("should set provided value", async () => {
            const readConfig = {
                browsers: {
                    b1: mkBrowser_({ meta: { k1: "v1", k2: "v2" } }),
                },
            };

            Config.read.resolves(readConfig);

            const config = await createConfig();

            assert.deepEqual(config.browsers.b1.meta, { k1: "v1", k2: "v2" });
        });
    });

    describe("windowSize", () => {
        describe('should throw error if "windowSize" is', () => {
            it("not object, string or null", async () => {
                const readConfig = {
                    browsers: {
                        b1: mkBrowser_({ windowSize: 1 }),
                    },
                };

                Config.read.resolves(readConfig);

                await assert.isRejected(createConfig(), '"windowSize" must be string, object or null');
            });

            it('object without "width" or "height" keys', async () => {
                const readConfig = {
                    browsers: {
                        b1: mkBrowser_({ windowSize: { width: 1 } }),
                    },
                };

                Config.read.resolves(readConfig);

                await assert.isRejected(
                    createConfig(),
                    '"windowSize" must be an object with "width" and "height" keys',
                );
            });

            it('object with "width" or "height" keys that are not numbers', async () => {
                const readConfig = {
                    browsers: {
                        b1: mkBrowser_({ windowSize: { width: 1, height: "2" } }),
                    },
                };

                Config.read.resolves(readConfig);

                await assert.isRejected(
                    createConfig(),
                    '"windowSize" must be an object with "width" and "height" keys',
                );
            });

            it("string with wrong pattern", async () => {
                const readConfig = {
                    browsers: {
                        b1: mkBrowser_({ windowSize: "some_size" }),
                    },
                };

                Config.read.resolves(readConfig);

                await assert.isRejected(
                    createConfig(),
                    '"windowSize" should have form of <width>x<height> (i.e. 1600x1200)',
                );
            });
        });

        it('should be "null" by default', async () => {
            const readConfig = {
                browsers: {
                    b1: mkBrowser_(),
                },
            };

            Config.read.resolves(readConfig);

            const config = await createConfig();

            assert.equal(config.browsers.b1.windowSize, null);
        });

        it("should accept string value", async () => {
            const readConfig = {
                browsers: {
                    b1: mkBrowser_({ windowSize: "1x2" }),
                },
            };

            Config.read.resolves(readConfig);

            const config = await createConfig();

            assert.deepEqual(config.browsers.b1.windowSize, { width: 1, height: 2 });
        });

        it('should pass object with "width" and "height" keys as is', async () => {
            const size = { width: 1, height: 2, check: true };
            const readConfig = {
                browsers: {
                    b1: mkBrowser_({ windowSize: size }),
                },
            };

            Config.read.resolves(readConfig);

            const config = await createConfig();

            assert.deepEqual(config.browsers.b1.windowSize, size);
        });

        it("should set option to all browsers", async () => {
            const readConfig = {
                windowSize: "1x2",
                browsers: {
                    b1: mkBrowser_(),
                    b2: mkBrowser_(),
                },
            };

            Config.read.resolves(readConfig);

            const config = await createConfig();

            assert.deepEqual(config.browsers.b1.windowSize, { width: 1, height: 2 });
            assert.deepEqual(config.browsers.b2.windowSize, { width: 1, height: 2 });
        });

        it("should override option for browser", async () => {
            const readConfig = {
                windowSize: "1x2",
                browsers: {
                    b1: mkBrowser_(),
                    b2: mkBrowser_({ windowSize: "5x5" }),
                },
            };

            Config.read.resolves(readConfig);

            const config = await createConfig();

            assert.deepEqual(config.browsers.b1.windowSize, { width: 1, height: 2 });
            assert.deepEqual(config.browsers.b2.windowSize, { width: 5, height: 5 });
        });
    });

    ["tolerance", "antialiasingTolerance"].forEach(async option => {
        describe(`${option}`, () => {
            describe("should throw an error", () => {
                it("if value is not number", async () => {
                    const readConfig = {
                        browsers: {
                            b1: mkBrowser_({ [option]: [] }),
                        },
                    };

                    Config.read.resolves(readConfig);

                    await assert.isRejected(createConfig(), `"${option}" must be a number`);
                });

                it("if value is negative", async () => {
                    const readConfig = {
                        browsers: {
                            b1: mkBrowser_({ [option]: -1 }),
                        },
                    };

                    Config.read.resolves(readConfig);

                    await assert.isRejected(createConfig(), `"${option}" must be non-negative`);
                });
            });

            it("should set a default value if it is not set in config", async () => {
                const readConfig = {
                    browsers: {
                        b1: mkBrowser_(),
                    },
                };

                Config.read.resolves(readConfig);

                const config = await createConfig();

                assert.equal(config[option], defaults[option]);
            });

            it("should does not throw if value is 0", async () => {
                const readConfig = {
                    browsers: {
                        b1: mkBrowser_({ [option]: 0 }),
                    },
                };

                Config.read.resolves(readConfig);

                await assert.isFulfilled(createConfig());
            });

            it("should override option for browser", async () => {
                const readConfig = {
                    [option]: 100,
                    browsers: {
                        b1: mkBrowser_(),
                        b2: mkBrowser_({ [option]: 200 }),
                    },
                };

                Config.read.resolves(readConfig);

                const config = await createConfig();

                assert.deepEqual(config.browsers.b1[option], 100);
                assert.deepEqual(config.browsers.b2[option], 200);
            });
        });
    });

    describe("buildDiffOpts", () => {
        it('should throw error if "buildDiffOpts" is not a object', async () => {
            const readConfig = {
                browsers: {
                    b1: mkBrowser_({ buildDiffOpts: "some-string" }),
                },
            };

            Config.read.resolves(readConfig);

            await assert.isRejected(createConfig(), '"buildDiffOpts" must be an object');
        });

        ["ignoreAntialiasing", "ignoreCaret"].forEach(async option => {
            it(`should set "${option}" to "true" by default`, async () => {
                const readConfig = {
                    browsers: {
                        b1: mkBrowser_({}),
                    },
                };

                Config.read.resolves(readConfig);

                const config = await createConfig();

                assert.equal(config.browsers.b1.buildDiffOpts[option], true);
            });
        });

        it("should set provided value", async () => {
            const readConfig = {
                browsers: {
                    b1: mkBrowser_({ buildDiffOpts: { k1: "v1", k2: "v2" } }),
                },
            };

            Config.read.resolves(readConfig);

            const config = await createConfig();

            assert.deepEqual(config.browsers.b1.buildDiffOpts, { k1: "v1", k2: "v2" });
        });
    });

    describe("assertViewOpts", () => {
        it('should throw error if "assertViewOpts" is not an object', async () => {
            const readConfig = {
                browsers: {
                    b1: mkBrowser_({ assertViewOpts: "some-string" }),
                },
            };

            Config.read.resolves(readConfig);

            await assert.isRejected(createConfig(), '"assertViewOpts" must be an object');
        });

        ["ignoreElements", "captureElementFromTop", "allowViewportOverflow"].forEach(async option => {
            it(`should set "${option}" option to default value if it is not set in config`, async () => {
                const readConfig = {
                    browsers: {
                        b1: mkBrowser_(),
                    },
                };
                Config.read.resolves(readConfig);

                const config = await createConfig();

                assert.deepEqual(config.browsers.b1.assertViewOpts[option], defaults.assertViewOpts[option]);
            });

            it(`should overridde only "${option}" and use others from defaults`, async () => {
                const readConfig = {
                    browsers: {
                        b1: mkBrowser_({ assertViewOpts: { [option]: 100500 } }),
                    },
                };
                Config.read.resolves(readConfig);

                const config = await createConfig();

                assert.deepEqual(config.browsers.b1.assertViewOpts, { ...defaults.assertViewOpts, [option]: 100500 });
            });
        });

        it("should set provided values and use others from defaults", async () => {
            const readConfig = {
                browsers: {
                    b1: mkBrowser_({ assertViewOpts: { k1: "v1", k2: "v2" } }),
                },
            };
            Config.read.resolves(readConfig);

            const config = await createConfig();

            assert.deepEqual(config.browsers.b1.assertViewOpts, { ...defaults.assertViewOpts, k1: "v1", k2: "v2" });
        });
    });

    function testBooleanOption(option) {
        it("should throw an error if value is not a boolean", async () => {
            const readConfig = _.set({}, "browsers.b1", mkBrowser_({ [option]: "foo" }));

            Config.read.resolves(readConfig);

            await assert.isRejected(createConfig(), `"${option}" must be a boolean`);
        });

        it("should set a default value if it is not set in config", async () => {
            const readConfig = _.set({}, "browsers.b1", mkBrowser_());
            Config.read.resolves(readConfig);

            const config = await createConfig();

            assert.equal(config[option], defaults[option]);
        });

        it("should override option for browser", async () => {
            const readConfig = {
                [option]: false,
                browsers: {
                    b1: mkBrowser_(),
                    b2: mkBrowser_({ [option]: true }),
                },
            };

            Config.read.resolves(readConfig);

            const config = await createConfig();

            assert.isFalse(config.browsers.b1[option]);
            assert.isTrue(config.browsers.b2[option]);
        });
    }

    [
        "calibrate",
        "compositeImage",
        "resetCursor",
        "strictTestsOrder",
        "waitOrientationChange",
        "isolation",
        "passive",
    ].forEach(option => describe(option, () => testBooleanOption(option)));

    describe("isolation", () => {
        it("should set to 'true' if browser support isolation", async () => {
            const readConfig = {
                browsers: {
                    b1: mkBrowser_({
                        desiredCapabilities: {
                            browserName: "chrome",
                            browserVersion: "101.0",
                        },
                    }),
                },
            };
            Config.read.resolves(readConfig);

            const config = await createConfig();

            assert.isTrue(config.browsers.b1.isolation);
        });

        it("should set to 'false' if browser doesn't support isolation", async () => {
            const readConfig = {
                browsers: {
                    b1: mkBrowser_({
                        desiredCapabilities: {
                            browserName: "chrome",
                            browserVersion: "60.0",
                        },
                    }),
                },
            };
            Config.read.resolves(readConfig);

            const config = await createConfig();

            assert.isFalse(config.browsers.b1.isolation);
        });

        describe("should set to 'false' by user even if browser support isolation", () => {
            it("in top level config", async () => {
                const readConfig = {
                    isolation: false,
                    browsers: {
                        b1: mkBrowser_({
                            desiredCapabilities: {
                                browserName: "chrome",
                                browserVersion: "101.0",
                            },
                        }),
                    },
                };
                Config.read.resolves(readConfig);

                const config = await createConfig();

                assert.isFalse(config.browsers.b1.isolation);
            });

            it("in browser config", async () => {
                const readConfig = {
                    browsers: {
                        b1: mkBrowser_({
                            isolation: false,
                            desiredCapabilities: {
                                browserName: "chrome",
                                browserVersion: "101.0",
                            },
                        }),
                    },
                };
                Config.read.resolves(readConfig);

                const config = await createConfig();

                assert.isFalse(config.browsers.b1.isolation);
            });
        });
    });

    describe("saveHistoryMode", () => {
        it("should throw an error if value is not available", async () => {
            const readConfig = _.set({}, "browsers.b1", mkBrowser_({ saveHistoryMode: "foo" }));

            Config.read.resolves(readConfig);

            await assert.isRejected(createConfig(), `"saveHistoryMode" must be one of`);
        });

        it("should set a default value if it is not set in config", async () => {
            const readConfig = _.set({}, "browsers.b1", mkBrowser_());
            Config.read.resolves(readConfig);

            const config = await createConfig();

            assert.equal(config.saveHistory, defaults.saveHistory);
        });

        it("should override option for browser", async () => {
            const readConfig = {
                saveHistoryMode: "none",
                browsers: {
                    b1: mkBrowser_(),
                    b2: mkBrowser_({ saveHistoryMode: SAVE_HISTORY_MODE.ALL }),
                },
            };

            Config.read.resolves(readConfig);

            const config = await createConfig();

            assert.equal(config.browsers.b1.saveHistoryMode, SAVE_HISTORY_MODE.NONE);
            assert.equal(config.browsers.b2.saveHistoryMode, SAVE_HISTORY_MODE.ALL);
        });

        [SAVE_HISTORY_MODE.NONE, SAVE_HISTORY_MODE.ONLY_FAILED, SAVE_HISTORY_MODE.ALL].forEach(async value => {
            it(`should set option for browser to "${value}"`, async () => {
                const readConfig = _.set({}, "browsers.b1", mkBrowser_({ saveHistoryMode: value }));

                Config.read.resolves(readConfig);

                const config = await createConfig();

                assert.equal(config.browsers.b1.saveHistoryMode, value);
            });
        });
    });

    describe("takeScreenshotOnFails", () => {
        it("should throw an error if value is not an object", async () => {
            Config.read.resolves({ takeScreenshotOnFails: "foo" });

            await assert.isRejected(createConfig(), '"takeScreenshotOnFails" must be an object');
        });

        it("should throw an error if object value contains unknown fields", async () => {
            Config.read.resolves({
                takeScreenshotOnFails: {
                    foo: "bar",
                    bar: "foo",
                },
            });

            await assert.isRejected(createConfig(), '"takeScreenshotOnFails" contains unknown properties: foo,bar.');
        });

        it("should set a default value if it is not set in config", async () => {
            Config.read.resolves({
                browsers: {
                    b1: mkBrowser_(),
                },
            });

            const config = await createConfig();

            assert.deepEqual(config.takeScreenshotOnFails, defaults.takeScreenshotOnFails);
            assert.deepEqual(config.browsers.b1.takeScreenshotOnFails, defaults.takeScreenshotOnFails);
        });

        it("should extend object value with missing fields", async () => {
            Config.read.resolves({
                takeScreenshotOnFails: {
                    testFail: true,
                },
            });

            const config = await createConfig();

            assert.deepEqual(config.takeScreenshotOnFails, {
                testFail: true,
                assertViewFail: true,
            });
        });

        it("should override option for browser", async () => {
            const readConfig = {
                takeScreenshotOnFails: {
                    testFail: false,
                },
                browsers: {
                    b1: mkBrowser_(),
                    b2: mkBrowser_({
                        takeScreenshotOnFails: {
                            assertViewFail: false,
                        },
                    }),
                },
            };

            Config.read.resolves(readConfig);

            const config = await createConfig();

            assert.deepEqual(config.browsers.b1.takeScreenshotOnFails, {
                testFail: false,
                assertViewFail: true,
            });
            assert.deepEqual(config.browsers.b2.takeScreenshotOnFails, {
                testFail: false,
                assertViewFail: false,
            });
        });
    });

    describe("screenshotMode", () => {
        it("should throw an error if option is not a string", async () => {
            const readConfig = {
                browsers: {
                    b1: mkBrowser_({ screenshotMode: { not: "string" } }),
                },
            };

            Config.read.resolves(readConfig);

            await assert.isRejected(createConfig(), /"screenshotMode" must be a string/);
        });

        it('should throw an error if option value is not "fullpage", "viewport" or "auto"', async () => {
            const readConfig = {
                browsers: {
                    b1: mkBrowser_({ screenshotMode: "foo bar" }),
                },
            };

            Config.read.resolves(readConfig);

            await assert.isRejected(createConfig(), /"screenshotMode" must be one of: fullpage, viewport, auto/);
        });

        describe("should not throw an error if option value is", () => {
            ["fullpage", "viewport", "auto"].forEach(async value => {
                it(`${value}`, async () => {
                    const readConfig = {
                        browsers: {
                            b1: mkBrowser_({ screenshotMode: value }),
                        },
                    };

                    Config.read.resolves(readConfig);

                    await assert.isFulfilled(createConfig());
                });
            });
        });

        it("should set a default value if it is not set in config", async () => {
            const readConfig = {
                browsers: {
                    b1: mkBrowser_(),
                },
            };

            Config.read.resolves(readConfig);

            const config = await createConfig();

            assert.equal(config.screenshotMode, defaults.screenshotMode);
        });

        it("should override option for browser", async () => {
            const readConfig = {
                screenshotMode: "fullpage",
                browsers: {
                    b1: mkBrowser_(),
                    b2: mkBrowser_({ screenshotMode: "viewport" }),
                },
            };

            Config.read.resolves(readConfig);

            const config = await createConfig();

            assert.equal(config.browsers.b1.screenshotMode, "fullpage");
            assert.equal(config.browsers.b2.screenshotMode, "viewport");
        });

        describe("on android browser", () => {
            it("should set mode to 'viewport' by default", async () => {
                const readConfig = {
                    browsers: {
                        b1: mkBrowser_({
                            desiredCapabilities: {
                                platformName: "android",
                            },
                        }),
                    },
                };

                Config.read.resolves(readConfig);

                const config = await createConfig();

                assert.equal(config.browsers.b1.screenshotMode, "viewport");
            });

            it("should preserve manually set mode", async () => {
                const readConfig = {
                    browsers: {
                        b1: mkBrowser_({
                            desiredCapabilities: {
                                platformName: "android",
                            },
                            screenshotMode: "fullpage",
                        }),
                    },
                };

                Config.read.resolves(readConfig);

                const config = await createConfig();

                assert.equal(config.browsers.b1.screenshotMode, "fullpage");
            });
        });
    });

    describe("takeScreenshotOnFailsMode", () => {
        it("should throw an error if option is not a string", async () => {
            const readConfig = {
                browsers: {
                    b1: mkBrowser_({ takeScreenshotOnFailsMode: { not: "string" } }),
                },
            };

            Config.read.resolves(readConfig);

            await assert.isRejected(createConfig(), /"takeScreenshotOnFailsMode" must be a string/);
        });

        it('should throw an error if option value is not "fullpage" or "viewport"', async () => {
            const readConfig = {
                browsers: {
                    b1: mkBrowser_({ takeScreenshotOnFailsMode: "foo bar" }),
                },
            };

            Config.read.resolves(readConfig);

            await assert.isRejected(createConfig(), /"takeScreenshotOnFailsMode" must be one of: fullpage, viewport/);
        });

        describe("should not throw an error if option value is", () => {
            ["fullpage", "viewport"].forEach(async value => {
                it(`${value}`, async () => {
                    const readConfig = {
                        browsers: {
                            b1: mkBrowser_({ takeScreenshotOnFailsMode: value }),
                        },
                    };

                    Config.read.resolves(readConfig);

                    await assert.isFulfilled(createConfig());
                });
            });
        });

        it("should set a default value if it is not set in config", async () => {
            const readConfig = {
                browsers: {
                    b1: mkBrowser_(),
                },
            };

            Config.read.resolves(readConfig);

            const config = await createConfig();

            assert.equal(config.takeScreenshotOnFailsMode, defaults.takeScreenshotOnFailsMode);
        });

        it("should override option for browser", async () => {
            const readConfig = {
                takeScreenshotOnFailsMode: "fullpage",
                browsers: {
                    b1: mkBrowser_(),
                    b2: mkBrowser_({ takeScreenshotOnFailsMode: "viewport" }),
                },
            };

            Config.read.resolves(readConfig);

            const config = await createConfig();

            assert.equal(config.browsers.b1.takeScreenshotOnFailsMode, "fullpage");
            assert.equal(config.browsers.b2.takeScreenshotOnFailsMode, "viewport");
        });
    });

    describe("orientation", () => {
        it("should throw an error if option value is not string", async () => {
            const readConfig = {
                browsers: {
                    b1: mkBrowser_({ orientation: { not: "string" } }),
                },
            };

            Config.read.resolves(readConfig);

            await assert.isRejected(createConfig(), /"orientation" must be a string/);
        });

        it('should throw an error if option value is not "landscape" or "portrait"', async () => {
            const readConfig = {
                browsers: {
                    b1: mkBrowser_({ orientation: "foo bar" }),
                },
            };

            Config.read.resolves(readConfig);

            await assert.isRejected(createConfig(), /"orientation" must be "landscape" or "portrait"/);
        });

        describe("should not throw an error if option value is", () => {
            ["landscape", "portrait"].forEach(async value => {
                it(`${value}`, async () => {
                    const readConfig = {
                        browsers: {
                            b1: mkBrowser_({ orientation: value }),
                        },
                    };

                    Config.read.resolves(readConfig);

                    await assert.isFulfilled(createConfig());
                });
            });
        });

        it("should set a default value if it is not set in config", async () => {
            const readConfig = {
                browsers: {
                    b1: mkBrowser_(),
                },
            };

            Config.read.resolves(readConfig);

            const config = await createConfig();

            assert.equal(config.orientation, defaults.orientation);
        });

        it("should override option for browser", async () => {
            const readConfig = {
                orientation: "landscape",
                browsers: {
                    b1: mkBrowser_(),
                    b2: mkBrowser_({ orientation: "portrait" }),
                },
            };

            Config.read.resolves(readConfig);

            const config = await createConfig();

            assert.equal(config.browsers.b1.orientation, "landscape");
            assert.equal(config.browsers.b2.orientation, "portrait");
        });
    });

    ["outputDir", "user", "key", "region"].forEach(async option => {
        describe(option, () => {
            it("should throw an error if value is not a null or string", async () => {
                const readConfig = _.set({}, "browsers.b1", mkBrowser_({ [option]: { some: "object" } }));

                Config.read.resolves(readConfig);

                await assert.isRejected(createConfig(), `"${option}" must be a string`);
            });

            it("should set a default value if it is not set in config", async () => {
                const readConfig = _.set({}, "browsers.b1", mkBrowser_());
                Config.read.resolves(readConfig);

                const config = await createConfig();

                assert.equal(config[option], defaults[option]);
            });

            it("should override option for browser", async () => {
                const readConfig = {
                    [option]: "init-string",
                    browsers: {
                        b1: mkBrowser_(),
                        b2: mkBrowser_({ [option]: "new-string" }),
                    },
                };

                Config.read.resolves(readConfig);

                const config = await createConfig();

                assert.equal(config.browsers.b1[option], "init-string");
                assert.equal(config.browsers.b2[option], "new-string");
            });
        });
    });

    ["agent", "headers"].forEach(async option => {
        describe(option, () => {
            it(`should throw error if "${option}" is not an object`, async () => {
                const readConfig = _.set({}, "browsers.b1", mkBrowser_({ [option]: "string" }));

                Config.read.resolves(readConfig);

                await assert.isRejected(createConfig(), `"${option}" must be an object`);
            });

            it("should set a default value if it is not set in config", async () => {
                const readConfig = _.set({}, "browsers.b1", mkBrowser_());
                Config.read.resolves(readConfig);

                const config = await createConfig();

                assert.equal(config[option], defaults[option]);
            });

            it("should set provided value", async () => {
                const readConfig = _.set({}, "browsers.b1", mkBrowser_({ [option]: { k1: "v1", k2: "v2" } }));
                Config.read.resolves(readConfig);

                const config = await createConfig();

                assert.deepEqual(config.browsers.b1[option], { k1: "v1", k2: "v2" });
            });
        });
    });

    ["transformRequest", "transformResponse"].forEach(async option => {
        describe(option, () => {
            it(`should throw error if ${option} is not a null or function`, async () => {
                const readConfig = _.set({}, "browsers.b1", mkBrowser_({ [option]: "string" }));

                Config.read.resolves(readConfig);

                await assert.isRejected(createConfig(), `"${option}" must be a function`);
            });

            it("should set a default value if it is not set in config", async () => {
                const readConfig = _.set({}, "browsers.b1", mkBrowser_());
                Config.read.resolves(readConfig);

                const config = await createConfig();

                assert.equal(config[option], defaults[option]);
            });

            it(`should override ${option} option`, async () => {
                const optionFn = () => {};
                const newOptionFn = () => {};

                const readConfig = {
                    [option]: optionFn,
                    browsers: {
                        b1: mkBrowser_(),
                        b2: mkBrowser_({ [option]: newOptionFn }),
                    },
                };
                Config.read.resolves(readConfig);

                const config = await createConfig();

                assert.equal(config.browsers.b1[option], optionFn);
                assert.equal(config.browsers.b2[option], newOptionFn);
            });
        });
    });

    describe("strictSSL", () => {
        it(`should throw error if option is not a null or boolean`, async () => {
            const readConfig = _.set({}, "browsers.b1", mkBrowser_({ strictSSL: "string" }));

            Config.read.resolves(readConfig);

            await assert.isRejected(createConfig(), `"strictSSL" must be a boolean`);
        });

        it("should set a default value if it is not set in config", async () => {
            const readConfig = _.set({}, "browsers.b1", mkBrowser_());
            Config.read.resolves(readConfig);

            const config = await createConfig();

            assert.equal(config.strictSSL, defaults.strictSSL);
        });

        it(`should override "strictSSL" option`, async () => {
            const readConfig = {
                strictSSL: false,
                browsers: {
                    b1: mkBrowser_(),
                    b2: mkBrowser_({ strictSSL: true }),
                },
            };
            Config.read.resolves(readConfig);

            const config = await createConfig();

            assert.isFalse(config.browsers.b1.strictSSL);
            assert.isTrue(config.browsers.b2.strictSSL);
        });
    });

    describe("headless", () => {
        it("should throw error if option is not a null, boolean or string", async () => {
            const readConfig = _.set({}, "browsers.b1", mkBrowser_({ headless: { a: 1 } }));

            Config.read.resolves(readConfig);

            await assert.isRejected(
                createConfig(),
                '"headless" option should be boolean or string with "new" or "old" values',
            );
        });

        it("should throw error if option is string with invalid values", async () => {
            const readConfig = _.set({}, "browsers.b1", mkBrowser_({ headless: "some" }));

            Config.read.resolves(readConfig);

            await assert.isRejected(createConfig(), '"headless" option should be "new" or "old", but got "some"');
        });

        it("should set a default value if it is not set in config", async () => {
            const readConfig = _.set({}, "browsers.b1", mkBrowser_());
            Config.read.resolves(readConfig);

            const config = await createConfig();

            assert.equal(config.headless, defaults.headless);
        });

        it("should override 'headless' option", async () => {
            const readConfig = {
                headless: false,
                browsers: {
                    b1: mkBrowser_(),
                    b2: mkBrowser_({ headless: true }),
                },
            };
            Config.read.resolves(readConfig);

            const config = await createConfig();

            assert.isFalse(config.browsers.b1.headless);
            assert.isTrue(config.browsers.b2.headless);
        });
    });

    describe("timeTravel", () => {
        it("should set timeTravel to off by default", async () => {
            const readConfig = {};

            Config.read.resolves(readConfig);

            const config = await createConfig();

            assert.deepEqual(config.timeTravel, { mode: "off" });
        });

        it("should throw if timeTravel is not a valid string", async () => {
            const readConfig = { timeTravel: "something" };

            Config.read.resolves(readConfig);

            await assert.isRejected(createConfig(), /TimeTravel mode must be one of the following strings/);
        });

        it("should parse string into object", async () => {
            const readConfig = { timeTravel: TimeTravelMode.RetriesOnly };

            Config.read.resolves(readConfig);

            const config = await createConfig();

            assert.deepEqual(config.timeTravel, { mode: TimeTravelMode.RetriesOnly });
        });

        it("should throw if timeTravel.mode is invalid", async () => {
            const readConfig = { timeTravel: { mode: "something" } };

            Config.read.resolves(readConfig);

            await assert.isRejected(createConfig(), /TimeTravel mode must be one of the following strings/);
        });

        it("should preserve correct object", async () => {
            const readConfig = { timeTravel: { mode: TimeTravelMode.RetriesOnly } };

            Config.read.resolves(readConfig);

            const config = await createConfig();

            assert.deepEqual(config.timeTravel, { mode: TimeTravelMode.RetriesOnly });
        });

        it("should work correctly with browser overrides", async () => {
            const readConfig = {
                timeTravel: TimeTravelMode.RetriesOnly,
                browsers: {
                    b1: mkBrowser_(),
                    b2: mkBrowser_({ timeTravel: { mode: "off" } }),
                },
            };
            Config.read.resolves(readConfig);

            const config = await createConfig();

            assert.deepEqual(config.browsers.b1.timeTravel, { mode: TimeTravelMode.RetriesOnly });
            assert.deepEqual(config.browsers.b2.timeTravel, { mode: TimeTravelMode.Off });
        });
    });
});
