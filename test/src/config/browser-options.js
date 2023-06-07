"use strict";

const _ = require("lodash");

const { Config } = require("src/config");
const defaults = require("src/config/defaults");
const { WEBDRIVER_PROTOCOL, DEVTOOLS_PROTOCOL, SAVE_HISTORY_MODE } = require("src/constants/config");

describe("config browser-options", () => {
    const sandbox = sinon.sandbox.create();

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
            it("is missing", () => {
                const readConfig = {
                    browsers: {
                        b1: {},
                    },
                };

                Config.read.returns(readConfig);

                assert.throws(() => createConfig(), Error, 'Each browser must have "desiredCapabilities" option');
            });

            it("is not an object or null", () => {
                const readConfig = {
                    browsers: {
                        b1: {
                            desiredCapabilities: "chrome",
                        },
                    },
                };

                Config.read.returns(readConfig);

                assert.throws(() => createConfig(), Error, '"desiredCapabilities" must be an object');
            });
        });

        it("should set desiredCapabilities", () => {
            const readConfig = {
                browsers: {
                    b1: {
                        desiredCapabilities: {
                            browserName: "yabro",
                        },
                    },
                },
            };

            Config.read.returns(readConfig);

            const config = createConfig();

            assert.deepEqual(config.browsers.b1.desiredCapabilities, { browserName: "yabro" });
        });
    });

    describe("baseUrl", () => {
        it("should throw error if baseUrl is not a string", () => {
            const readConfig = {
                browsers: {
                    b1: mkBrowser_({ baseUrl: ["Array"] }),
                },
            };

            Config.read.returns(readConfig);

            assert.throws(() => createConfig(), Error, '"baseUrl" must be a string');
        });

        it("should set baseUrl to all browsers", () => {
            const baseUrl = "http://default.com";
            const readConfig = {
                baseUrl,
                browsers: {
                    b1: mkBrowser_(),
                    b2: mkBrowser_(),
                },
            };

            Config.read.returns(readConfig);

            const config = createConfig();

            assert.equal(config.browsers.b1.baseUrl, baseUrl);
            assert.equal(config.browsers.b2.baseUrl, baseUrl);
        });

        it("should override baseUrl option if protocol is set", () => {
            const baseUrl = "http://default.com";
            const readConfig = {
                baseUrl,
                browsers: {
                    b1: mkBrowser_(),
                    b2: mkBrowser_({ baseUrl: "http://foo.com" }),
                },
            };

            Config.read.returns(readConfig);

            const config = createConfig();

            assert.equal(config.browsers.b1.baseUrl, baseUrl);
            assert.equal(config.browsers.b2.baseUrl, "http://foo.com");
        });

        it("should resolve baseUrl option relative to top level baseUrl", () => {
            const baseUrl = "http://default.com";
            const readConfig = {
                baseUrl,
                browsers: {
                    b1: mkBrowser_(),
                    b2: mkBrowser_({ baseUrl: "/test" }),
                },
            };

            Config.read.returns(readConfig);

            const config = createConfig();

            assert.equal(config.browsers.b1.baseUrl, baseUrl);
            assert.equal(config.browsers.b2.baseUrl, "http://default.com/test");
        });

        it("should resolve baseUrl option relative to top level baseUrl with path", () => {
            const baseUrl = "http://default.com/search/";
            const readConfig = {
                baseUrl,
                browsers: {
                    b1: mkBrowser_(),
                    b2: mkBrowser_({ baseUrl: "/test" }),
                },
            };

            Config.read.returns(readConfig);

            const config = createConfig();

            assert.equal(config.browsers.b1.baseUrl, baseUrl);
            assert.equal(config.browsers.b2.baseUrl, "http://default.com/search/test");
        });
    });

    [
        { optionName: "gridUrl", uriScheme: "http" },
        { optionName: "browserWSEndpoint", uriScheme: "ws" },
    ].forEach(({ optionName, uriScheme }) => {
        describe(optionName, () => {
            it("should throw error if option is not a string", () => {
                const readConfig = {
                    browsers: {
                        b1: mkBrowser_({ [optionName]: /regExp/ }),
                    },
                };

                Config.read.returns(readConfig);

                assert.throws(() => createConfig(), Error, `"${optionName}" must be a string`);
            });

            it("should set option to all browsers", () => {
                const optionValue = `${uriScheme}://default.com`;
                const readConfig = {
                    [optionName]: optionValue,
                    browsers: {
                        b1: mkBrowser_(),
                        b2: mkBrowser_(),
                    },
                };

                Config.read.returns(readConfig);

                const config = createConfig();

                assert.equal(config.browsers.b1[optionName], optionValue);
                assert.equal(config.browsers.b2[optionName], optionValue);
            });

            it("should override option", () => {
                const optionValue = `${uriScheme}://default.com`;
                const readConfig = {
                    [optionName]: optionValue,
                    browsers: {
                        b1: mkBrowser_(),
                        b2: mkBrowser_({ [optionName]: `${uriScheme}://bar.com` }),
                    },
                };

                Config.read.returns(readConfig);

                const config = createConfig();

                assert.equal(config.browsers.b1[optionName], optionValue);
                assert.equal(config.browsers.b2[optionName], `${uriScheme}://bar.com`);
            });
        });
    });

    describe("browserWSEndpoint", () => {
        it("should throw an error if option value does not start with WebSocket protocol", () => {
            const readConfig = {
                browsers: {
                    b1: mkBrowser_({ browserWSEndpoint: "http://endpoint.com" }),
                },
            };

            Config.read.returns(readConfig);

            assert.throws(
                () => createConfig(),
                Error,
                /"browserWSEndpoint" must start with "ws:\/\/" or "wss:\/\/" prefix/,
            );
        });

        describe("should not throw an error if option value start with", () => {
            ["ws", "wss"].forEach(protocol => {
                it(protocol, () => {
                    const readConfig = {
                        browsers: {
                            b1: mkBrowser_({ browserWSEndpoint: `${protocol}://endpoint.com` }),
                        },
                    };

                    Config.read.returns(readConfig);

                    assert.doesNotThrow(() => createConfig());
                });
            });
        });
    });

    describe("automationProtocol", () => {
        it("should throw an error if option value is not string", () => {
            const readConfig = {
                browsers: {
                    b1: mkBrowser_({ automationProtocol: { not: "string" } }),
                },
            };

            Config.read.returns(readConfig);

            assert.throws(() => createConfig(), Error, /"automationProtocol" must be a string/);
        });

        it(`should throw an error if option value is not "${WEBDRIVER_PROTOCOL}" or "${DEVTOOLS_PROTOCOL}"`, () => {
            const readConfig = {
                browsers: {
                    b1: mkBrowser_({ automationProtocol: "foo bar" }),
                },
            };

            Config.read.returns(readConfig);

            assert.throws(
                () => createConfig(),
                Error,
                new RegExp(`"automationProtocol" must be "${WEBDRIVER_PROTOCOL}" or "${DEVTOOLS_PROTOCOL}"`),
            );
        });

        describe("should not throw an error if option value is", () => {
            [WEBDRIVER_PROTOCOL, DEVTOOLS_PROTOCOL].forEach(value => {
                it(`${value}`, () => {
                    const readConfig = {
                        browsers: {
                            b1: mkBrowser_({ automationProtocol: value }),
                        },
                    };

                    Config.read.returns(readConfig);

                    assert.doesNotThrow(() => createConfig());
                });
            });
        });

        it("should set a default value if it is not set in config", () => {
            const readConfig = {
                browsers: {
                    b1: mkBrowser_(),
                },
            };

            Config.read.returns(readConfig);

            const config = createConfig();

            assert.equal(config.automationProtocol, defaults.automationProtocol);
        });

        it("should override option for browser", () => {
            const readConfig = {
                automationProtocol: WEBDRIVER_PROTOCOL,
                browsers: {
                    b1: mkBrowser_(),
                    b2: mkBrowser_({ automationProtocol: DEVTOOLS_PROTOCOL }),
                },
            };

            Config.read.returns(readConfig);

            const config = createConfig();

            assert.equal(config.browsers.b1.automationProtocol, WEBDRIVER_PROTOCOL);
            assert.equal(config.browsers.b2.automationProtocol, DEVTOOLS_PROTOCOL);
        });
    });

    describe("sessionEnvFlags", () => {
        it("should throw an error if option value is not an object", () => {
            const readConfig = {
                browsers: {
                    b1: mkBrowser_({ sessionEnvFlags: "string" }),
                },
            };

            Config.read.returns(readConfig);

            assert.throws(() => createConfig(), Error, /"sessionEnvFlags" must be an object/);
        });

        it("should throw an error if option value is not available", () => {
            const readConfig = {
                browsers: {
                    b1: mkBrowser_({ sessionEnvFlags: { a: "b" } }),
                },
            };

            Config.read.returns(readConfig);

            assert.throws(() => createConfig(), Error, /keys of "sessionEnvFlags" must be one of:/);
        });

        it("should throw an error if value inside available option is not boolean", () => {
            const readConfig = {
                browsers: {
                    b1: mkBrowser_({ sessionEnvFlags: { isW3C: "string" } }),
                },
            };

            Config.read.returns(readConfig);

            assert.throws(() => createConfig(), Error, /values of "sessionEnvFlags" must be boolean/);
        });

        describe("should not throw an error if option key is", () => {
            ["isW3C", "isChrome", "isMobile", "isIOS", "isAndroid", "isSauce", "isSeleniumStandalone"].forEach(key => {
                it(`"${key}" and value is boolean`, () => {
                    const readConfig = {
                        browsers: {
                            b1: mkBrowser_({ sessionEnvFlags: { [key]: true } }),
                        },
                    };

                    Config.read.returns(readConfig);

                    assert.doesNotThrow(() => createConfig());
                });
            });
        });

        it("should set a default value if it is not set in config", () => {
            const readConfig = {
                browsers: {
                    b1: mkBrowser_(),
                },
            };

            Config.read.returns(readConfig);

            const config = createConfig();

            assert.deepEqual(config.sessionEnvFlags, defaults.sessionEnvFlags);
        });

        it("should override option for browser", () => {
            const readConfig = {
                sessionEnvFlags: { isW3C: true },
                browsers: {
                    b1: mkBrowser_(),
                    b2: mkBrowser_({ sessionEnvFlags: { isW3C: false } }),
                },
            };

            Config.read.returns(readConfig);

            const config = createConfig();

            assert.deepEqual(config.browsers.b1.sessionEnvFlags, { isW3C: true });
            assert.deepEqual(config.browsers.b2.sessionEnvFlags, { isW3C: false });
        });
    });

    describe("prepareBrowser", () => {
        it("should throw error if prepareBrowser is not a null or function", () => {
            const readConfig = {
                browsers: {
                    b1: mkBrowser_({ prepareBrowser: "String" }),
                },
            };

            Config.read.returns(readConfig);

            assert.throws(() => createConfig(), Error, '"prepareBrowser" must be a function');
        });

        it("should set prepareBrowser to all browsers", () => {
            const prepareBrowser = () => {};
            const readConfig = {
                prepareBrowser,
                browsers: {
                    b1: mkBrowser_(),
                    b2: mkBrowser_(),
                },
            };

            Config.read.returns(readConfig);

            const config = createConfig();

            assert.equal(config.browsers.b1.prepareBrowser, prepareBrowser);
            assert.equal(config.browsers.b2.prepareBrowser, prepareBrowser);
        });

        it("should override prepareBrowser option", () => {
            const prepareBrowser = () => {};
            const newFunc = () => {};

            const readConfig = {
                prepareBrowser,
                browsers: {
                    b1: mkBrowser_(),
                    b2: mkBrowser_({ prepareBrowser: newFunc }),
                },
            };

            Config.read.returns(readConfig);

            const config = createConfig();

            assert.equal(config.browsers.b1.prepareBrowser, prepareBrowser);
            assert.equal(config.browsers.b2.prepareBrowser, newFunc);
        });
    });

    describe("screenshotsDir", () => {
        it("should set a default screenshotsDir option if it is not set in config", () => {
            const config = createConfig();

            assert.equal(config.screenshotsDir, defaults.screenshotsDir);
        });

        it("should throw an error if a value is not a string or function", () => {
            const readConfig = {
                browsers: {
                    b1: mkBrowser_({ screenshotsDir: ["Array"] }),
                },
            };

            Config.read.returns(readConfig);

            assert.throws(() => createConfig(), Error, '"screenshotsDir" must be a string or function');
        });

        it("should does not throw if a value is a function", () => {
            const readConfig = {
                screenshotsDir: () => {},
                browsers: {
                    b1: mkBrowser_(),
                },
            };

            Config.read.returns(readConfig);

            assert.doesNotThrow(createConfig);
        });

        it("should set screenshotsDir option to all browsers", () => {
            const screenshotsDir = "/some/dir";
            const readConfig = {
                screenshotsDir,
                browsers: {
                    b1: mkBrowser_(),
                    b2: mkBrowser_(),
                },
            };

            Config.read.returns(readConfig);

            const config = createConfig();

            assert.equal(config.browsers.b1.screenshotsDir, "/some/dir");
            assert.equal(config.browsers.b2.screenshotsDir, "/some/dir");
        });

        it("should override screenshotsDir option per browser", () => {
            const screenshotsDir = "/some/dir";
            const readConfig = {
                screenshotsDir,
                browsers: {
                    b1: mkBrowser_(),
                    b2: mkBrowser_({ screenshotsDir: "/screens" }),
                },
            };

            Config.read.returns(readConfig);

            const config = createConfig();

            assert.equal(config.browsers.b1.screenshotsDir, "/some/dir");
            assert.equal(config.browsers.b2.screenshotsDir, "/screens");
        });
    });

    ["sessionsPerBrowser", "waitTimeout"].forEach(option => {
        describe(`${option}`, () => {
            describe(`should throw error if ${option}`, () => {
                it("is not a number", () => {
                    const readConfig = {
                        browsers: {
                            b1: mkBrowser_({ [option]: "10" }),
                        },
                    };

                    Config.read.returns(readConfig);

                    assert.throws(() => createConfig(), Error, `"${option}" must be a positive integer`);
                });

                it("is negative number", () => {
                    const readConfig = {
                        browsers: {
                            b1: mkBrowser_({ [option]: -5 }),
                        },
                    };

                    Config.read.returns(readConfig);

                    assert.throws(() => createConfig(), Error, `"${option}" must be a positive integer`);
                });

                it("is float number", () => {
                    const readConfig = {
                        browsers: {
                            b1: mkBrowser_({ [option]: 15.5 }),
                        },
                    };

                    Config.read.returns(readConfig);

                    assert.throws(() => createConfig(), Error, `"${option}" must be a positive integer`);
                });
            });

            it(`should set ${option} to all browsers`, () => {
                const readConfig = {
                    [option]: 666,
                    browsers: {
                        b1: mkBrowser_(),
                        b2: mkBrowser_(),
                    },
                };

                Config.read.returns(readConfig);

                const config = createConfig();

                assert.equal(config.browsers.b1[option], 666);
                assert.equal(config.browsers.b2[option], 666);
            });

            it(`should override ${option} option`, () => {
                const readConfig = {
                    [option]: 666,
                    browsers: {
                        b1: mkBrowser_(),
                        b2: mkBrowser_(_.set({}, option, 13)),
                    },
                };

                Config.read.returns(readConfig);

                const config = createConfig();

                assert.equal(config.browsers.b1[option], 666);
                assert.equal(config.browsers.b2[option], 13);
            });
        });
    });

    describe("testsPerSession", () => {
        describe('should throw error if "testsPerSession"', () => {
            it("is not a number", () => {
                const readConfig = {
                    browsers: {
                        b1: mkBrowser_({ testsPerSession: "10" }),
                    },
                };

                Config.read.returns(readConfig);

                assert.throws(() => createConfig(), Error, '"testsPerSession" must be a positive integer or Infinity');
            });

            it("is a negative number", () => {
                const readConfig = {
                    browsers: {
                        b1: mkBrowser_({ testsPerSession: -5 }),
                    },
                };

                Config.read.returns(readConfig);

                assert.throws(() => createConfig(), Error, '"testsPerSession" must be a positive integer or Infinity');
            });

            it("is a float number", () => {
                const readConfig = {
                    browsers: {
                        b1: mkBrowser_({ testsPerSession: 15.5 }),
                    },
                };

                Config.read.returns(readConfig);

                assert.throws(() => createConfig(), Error, '"testsPerSession" must be a positive integer or Infinity');
            });
        });

        it('should set "testsPerSession" to all browsers', () => {
            const readConfig = {
                testsPerSession: 666,
                browsers: {
                    b1: mkBrowser_(),
                    b2: mkBrowser_(),
                },
            };

            Config.read.returns(readConfig);

            const config = createConfig();

            assert.equal(config.browsers.b1.testsPerSession, 666);
            assert.equal(config.browsers.b2.testsPerSession, 666);
        });

        it('should override "testsPerSession option"', () => {
            const readConfig = {
                testsPerSession: 666,
                browsers: {
                    b1: mkBrowser_(),
                    b2: mkBrowser_({ testsPerSession: 13 }),
                },
            };

            Config.read.returns(readConfig);

            const config = createConfig();

            assert.equal(config.browsers.b1.testsPerSession, 666);
            assert.equal(config.browsers.b2.testsPerSession, 13);
        });
    });

    function testNonNegativeIntegerOption(option) {
        it(`should throw error if ${option} is not a number`, () => {
            const readConfig = {
                browsers: {
                    b1: mkBrowser_({ [option]: "100500" }),
                },
            };

            Config.read.returns(readConfig);

            assert.throws(() => createConfig(), Error, `"${option}" must be a non-negative integer`);
        });

        it(`should throw error if ${option} is negative`, () => {
            const readConfig = {
                browsers: {
                    b1: mkBrowser_({ [option]: -7 }),
                },
            };

            Config.read.returns(readConfig);

            assert.throws(() => createConfig(), Error, `"${option}" must be a non-negative integer`);
        });

        it(`should set ${option} option to all browsers`, () => {
            const readConfig = {
                [option]: 100500,
                browsers: {
                    b1: mkBrowser_(),
                    b2: mkBrowser_(),
                },
            };

            Config.read.returns(readConfig);

            const config = createConfig();

            assert.equal(config.browsers.b1[option], 100500);
            assert.equal(config.browsers.b2[option], 100500);
        });

        it(`should override ${option} option`, () => {
            const readConfig = {
                [option]: 100500,
                browsers: {
                    b1: mkBrowser_(),
                    b2: mkBrowser_({ [option]: 500100 }),
                },
            };

            Config.read.returns(readConfig);

            const config = createConfig();

            assert.equal(config.browsers.b1[option], 100500);
            assert.equal(config.browsers.b2[option], 500100);
        });
    }

    ["retry", "httpTimeout", "screenshotDelay"].forEach(option =>
        describe(option, () => testNonNegativeIntegerOption(option)),
    );

    function testOptionalNonNegativeIntegerOption(option) {
        testNonNegativeIntegerOption(option);

        it(`should does not throw an error if ${option} is null`, () => {
            const readConfig = {
                browsers: {
                    b1: mkBrowser_({ [option]: null }),
                },
            };

            Config.read.returns(readConfig);

            assert.doesNotThrow(createConfig);
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
        it('should throw error if "meta" is not a object', () => {
            const readConfig = {
                browsers: {
                    b1: mkBrowser_({ meta: "meta-string" }),
                },
            };

            Config.read.returns(readConfig);

            assert.throws(() => createConfig(), Error, '"meta" must be an object');
        });

        it("should set null by default", () => {
            const readConfig = {
                browsers: {
                    b1: mkBrowser_({}),
                },
            };

            Config.read.returns(readConfig);

            const config = createConfig();

            assert.equal(config.browsers.b1.meta, null);
        });

        it("should set provided value", () => {
            const readConfig = {
                browsers: {
                    b1: mkBrowser_({ meta: { k1: "v1", k2: "v2" } }),
                },
            };

            Config.read.returns(readConfig);

            const config = createConfig();

            assert.deepEqual(config.browsers.b1.meta, { k1: "v1", k2: "v2" });
        });
    });

    describe("windowSize", () => {
        describe('should throw error if "windowSize" is', () => {
            it("not object, string or null", () => {
                const readConfig = {
                    browsers: {
                        b1: mkBrowser_({ windowSize: 1 }),
                    },
                };

                Config.read.returns(readConfig);

                assert.throws(() => createConfig(), Error, '"windowSize" must be string, object or null');
            });

            it('object without "width" or "height" keys', () => {
                const readConfig = {
                    browsers: {
                        b1: mkBrowser_({ windowSize: { width: 1 } }),
                    },
                };

                Config.read.returns(readConfig);

                assert.throws(
                    () => createConfig(),
                    Error,
                    '"windowSize" must be an object with "width" and "height" keys',
                );
            });

            it('object with "width" or "height" keys that are not numbers', () => {
                const readConfig = {
                    browsers: {
                        b1: mkBrowser_({ windowSize: { width: 1, height: "2" } }),
                    },
                };

                Config.read.returns(readConfig);

                assert.throws(
                    () => createConfig(),
                    Error,
                    '"windowSize" must be an object with "width" and "height" keys',
                );
            });

            it("string with wrong pattern", () => {
                const readConfig = {
                    browsers: {
                        b1: mkBrowser_({ windowSize: "some_size" }),
                    },
                };

                Config.read.returns(readConfig);

                assert.throws(
                    () => createConfig(),
                    Error,
                    '"windowSize" should have form of <width>x<height> (i.e. 1600x1200)',
                );
            });
        });

        it('should be "null" by default', () => {
            const readConfig = {
                browsers: {
                    b1: mkBrowser_(),
                },
            };

            Config.read.returns(readConfig);

            const config = createConfig();

            assert.equal(config.browsers.b1.windowSize, null);
        });

        it("should accept string value", () => {
            const readConfig = {
                browsers: {
                    b1: mkBrowser_({ windowSize: "1x2" }),
                },
            };

            Config.read.returns(readConfig);

            const config = createConfig();

            assert.deepEqual(config.browsers.b1.windowSize, { width: 1, height: 2 });
        });

        it('should pass object with "width" and "height" keys as is', () => {
            const size = { width: 1, height: 2, check: true };
            const readConfig = {
                browsers: {
                    b1: mkBrowser_({ windowSize: size }),
                },
            };

            Config.read.returns(readConfig);

            const config = createConfig();

            assert.deepEqual(config.browsers.b1.windowSize, size);
        });

        it("should set option to all browsers", () => {
            const readConfig = {
                windowSize: "1x2",
                browsers: {
                    b1: mkBrowser_(),
                    b2: mkBrowser_(),
                },
            };

            Config.read.returns(readConfig);

            const config = createConfig();

            assert.deepEqual(config.browsers.b1.windowSize, { width: 1, height: 2 });
            assert.deepEqual(config.browsers.b2.windowSize, { width: 1, height: 2 });
        });

        it("should override option for browser", () => {
            const readConfig = {
                windowSize: "1x2",
                browsers: {
                    b1: mkBrowser_(),
                    b2: mkBrowser_({ windowSize: "5x5" }),
                },
            };

            Config.read.returns(readConfig);

            const config = createConfig();

            assert.deepEqual(config.browsers.b1.windowSize, { width: 1, height: 2 });
            assert.deepEqual(config.browsers.b2.windowSize, { width: 5, height: 5 });
        });
    });

    ["tolerance", "antialiasingTolerance"].forEach(option => {
        describe(`${option}`, () => {
            describe("should throw an error", () => {
                it("if value is not number", () => {
                    const readConfig = {
                        browsers: {
                            b1: mkBrowser_({ [option]: [] }),
                        },
                    };

                    Config.read.returns(readConfig);

                    assert.throws(() => createConfig(), Error, `"${option}" must be a number`);
                });

                it("if value is negative", () => {
                    const readConfig = {
                        browsers: {
                            b1: mkBrowser_({ [option]: -1 }),
                        },
                    };

                    Config.read.returns(readConfig);

                    assert.throws(() => createConfig(), Error, `"${option}" must be non-negative`);
                });
            });

            it("should set a default value if it is not set in config", () => {
                const readConfig = {
                    browsers: {
                        b1: mkBrowser_(),
                    },
                };

                Config.read.returns(readConfig);

                const config = createConfig();

                assert.equal(config[option], defaults[option]);
            });

            it("should does not throw if value is 0", () => {
                const readConfig = {
                    browsers: {
                        b1: mkBrowser_({ [option]: 0 }),
                    },
                };

                Config.read.returns(readConfig);

                assert.doesNotThrow(createConfig);
            });

            it("should override option for browser", () => {
                const readConfig = {
                    [option]: 100,
                    browsers: {
                        b1: mkBrowser_(),
                        b2: mkBrowser_({ [option]: 200 }),
                    },
                };

                Config.read.returns(readConfig);

                const config = createConfig();

                assert.deepEqual(config.browsers.b1[option], 100);
                assert.deepEqual(config.browsers.b2[option], 200);
            });
        });
    });

    describe("buildDiffOpts", () => {
        it('should throw error if "buildDiffOpts" is not a object', () => {
            const readConfig = {
                browsers: {
                    b1: mkBrowser_({ buildDiffOpts: "some-string" }),
                },
            };

            Config.read.returns(readConfig);

            assert.throws(() => createConfig(), Error, '"buildDiffOpts" must be an object');
        });

        ["ignoreAntialiasing", "ignoreCaret"].forEach(option => {
            it(`should set "${option}" to "true" by default`, () => {
                const readConfig = {
                    browsers: {
                        b1: mkBrowser_({}),
                    },
                };

                Config.read.returns(readConfig);

                const config = createConfig();

                assert.equal(config.browsers.b1.buildDiffOpts[option], true);
            });
        });

        it("should set provided value", () => {
            const readConfig = {
                browsers: {
                    b1: mkBrowser_({ buildDiffOpts: { k1: "v1", k2: "v2" } }),
                },
            };

            Config.read.returns(readConfig);

            const config = createConfig();

            assert.deepEqual(config.browsers.b1.buildDiffOpts, { k1: "v1", k2: "v2" });
        });
    });

    describe("assertViewOpts", () => {
        it('should throw error if "assertViewOpts" is not an object', () => {
            const readConfig = {
                browsers: {
                    b1: mkBrowser_({ assertViewOpts: "some-string" }),
                },
            };

            Config.read.returns(readConfig);

            assert.throws(() => createConfig(), Error, '"assertViewOpts" must be an object');
        });

        ["ignoreElements", "captureElementFromTop", "allowViewportOverflow"].forEach(option => {
            it(`should set "${option}" option to default value if it is not set in config`, () => {
                const readConfig = {
                    browsers: {
                        b1: mkBrowser_(),
                    },
                };
                Config.read.returns(readConfig);

                const config = createConfig();

                assert.deepEqual(config.browsers.b1.assertViewOpts[option], defaults.assertViewOpts[option]);
            });

            it(`should overridde only "${option}" and use others from defaults`, () => {
                const readConfig = {
                    browsers: {
                        b1: mkBrowser_({ assertViewOpts: { [option]: 100500 } }),
                    },
                };
                Config.read.returns(readConfig);

                const config = createConfig();

                assert.deepEqual(config.browsers.b1.assertViewOpts, { ...defaults.assertViewOpts, [option]: 100500 });
            });
        });

        it("should set provided values and use others from defaults", () => {
            const readConfig = {
                browsers: {
                    b1: mkBrowser_({ assertViewOpts: { k1: "v1", k2: "v2" } }),
                },
            };
            Config.read.returns(readConfig);

            const config = createConfig();

            assert.deepEqual(config.browsers.b1.assertViewOpts, { ...defaults.assertViewOpts, k1: "v1", k2: "v2" });
        });
    });

    function testBooleanOption(option) {
        it("should throw an error if value is not a boolean", () => {
            const readConfig = _.set({}, "browsers.b1", mkBrowser_({ [option]: "foo" }));

            Config.read.returns(readConfig);

            assert.throws(() => createConfig(), Error, `"${option}" must be a boolean`);
        });

        it("should set a default value if it is not set in config", () => {
            const readConfig = _.set({}, "browsers.b1", mkBrowser_());
            Config.read.returns(readConfig);

            const config = createConfig();

            assert.equal(config[option], defaults[option]);
        });

        it("should override option for browser", () => {
            const readConfig = {
                [option]: false,
                browsers: {
                    b1: mkBrowser_(),
                    b2: mkBrowser_({ [option]: true }),
                },
            };

            Config.read.returns(readConfig);

            const config = createConfig();

            assert.isFalse(config.browsers.b1[option]);
            assert.isTrue(config.browsers.b2[option]);
        });
    }

    ["calibrate", "compositeImage", "resetCursor", "strictTestsOrder", "waitOrientationChange"].forEach(option =>
        describe(option, () => testBooleanOption(option)),
    );

    describe("saveHistoryMode", () => {
        it("should throw an error if value is not available", () => {
            const readConfig = _.set({}, "browsers.b1", mkBrowser_({ saveHistoryMode: "foo" }));

            Config.read.returns(readConfig);

            assert.throws(() => createConfig(), Error, `"saveHistoryMode" must be one of`);
        });

        it("should set a default value if it is not set in config", () => {
            const readConfig = _.set({}, "browsers.b1", mkBrowser_());
            Config.read.returns(readConfig);

            const config = createConfig();

            assert.equal(config.saveHistory, defaults.saveHistory);
        });

        it("should override option for browser", () => {
            const readConfig = {
                saveHistoryMode: "none",
                browsers: {
                    b1: mkBrowser_(),
                    b2: mkBrowser_({ saveHistoryMode: SAVE_HISTORY_MODE.ALL }),
                },
            };

            Config.read.returns(readConfig);

            const config = createConfig();

            assert.equal(config.browsers.b1.saveHistoryMode, SAVE_HISTORY_MODE.NONE);
            assert.equal(config.browsers.b2.saveHistoryMode, SAVE_HISTORY_MODE.ALL);
        });

        [SAVE_HISTORY_MODE.NONE, SAVE_HISTORY_MODE.ONLY_FAILED, SAVE_HISTORY_MODE.ALL].forEach(value => {
            it(`should set option for browser to "${value}"`, () => {
                const readConfig = _.set({}, "browsers.b1", mkBrowser_({ saveHistoryMode: value }));

                Config.read.returns(readConfig);

                const config = createConfig();

                assert.equal(config.browsers.b1.saveHistoryMode, value);
            });
        });
    });

    describe("takeScreenshotOnFails", () => {
        it("should throw an error if value is not an object", () => {
            Config.read.returns({ takeScreenshotOnFails: "foo" });

            assert.throws(() => createConfig(), Error, '"takeScreenshotOnFails" must be an object');
        });

        it("should throw an error if object value contains unknown fields", () => {
            Config.read.returns({
                takeScreenshotOnFails: {
                    foo: "bar",
                    bar: "foo",
                },
            });

            assert.throws(() => createConfig(), Error, '"takeScreenshotOnFails" contains unknown properties: foo,bar.');
        });

        it("should set a default value if it is not set in config", () => {
            Config.read.returns({
                browsers: {
                    b1: mkBrowser_(),
                },
            });

            const config = createConfig();

            assert.deepEqual(config.takeScreenshotOnFails, defaults.takeScreenshotOnFails);
            assert.deepEqual(config.browsers.b1.takeScreenshotOnFails, defaults.takeScreenshotOnFails);
        });

        it("should extend object value with missing fields", () => {
            Config.read.returns({
                takeScreenshotOnFails: {
                    testFail: true,
                },
            });

            const config = createConfig();

            assert.deepEqual(config.takeScreenshotOnFails, {
                testFail: true,
                assertViewFail: true,
            });
        });

        it("should override option for browser", () => {
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

            Config.read.returns(readConfig);

            const config = createConfig();

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
        it("should throw an error if option is not a string", () => {
            const readConfig = {
                browsers: {
                    b1: mkBrowser_({ screenshotMode: { not: "string" } }),
                },
            };

            Config.read.returns(readConfig);

            assert.throws(() => createConfig(), Error, /"screenshotMode" must be a string/);
        });

        it('should throw an error if option value is not "fullpage", "viewport" or "auto"', () => {
            const readConfig = {
                browsers: {
                    b1: mkBrowser_({ screenshotMode: "foo bar" }),
                },
            };

            Config.read.returns(readConfig);

            assert.throws(() => createConfig(), Error, /"screenshotMode" must be one of: fullpage, viewport, auto/);
        });

        describe("should not throw an error if option value is", () => {
            ["fullpage", "viewport", "auto"].forEach(value => {
                it(`${value}`, () => {
                    const readConfig = {
                        browsers: {
                            b1: mkBrowser_({ screenshotMode: value }),
                        },
                    };

                    Config.read.returns(readConfig);

                    assert.doesNotThrow(() => createConfig());
                });
            });
        });

        it("should set a default value if it is not set in config", () => {
            const readConfig = {
                browsers: {
                    b1: mkBrowser_(),
                },
            };

            Config.read.returns(readConfig);

            const config = createConfig();

            assert.equal(config.screenshotMode, defaults.screenshotMode);
        });

        it("should override option for browser", () => {
            const readConfig = {
                screenshotMode: "fullpage",
                browsers: {
                    b1: mkBrowser_(),
                    b2: mkBrowser_({ screenshotMode: "viewport" }),
                },
            };

            Config.read.returns(readConfig);

            const config = createConfig();

            assert.equal(config.browsers.b1.screenshotMode, "fullpage");
            assert.equal(config.browsers.b2.screenshotMode, "viewport");
        });

        describe("on android browser", () => {
            it("should set mode to 'viewport' by default", () => {
                const readConfig = {
                    browsers: {
                        b1: mkBrowser_({
                            desiredCapabilities: {
                                platformName: "android",
                            },
                        }),
                    },
                };

                Config.read.returns(readConfig);

                const config = createConfig();

                assert.equal(config.browsers.b1.screenshotMode, "viewport");
            });

            it("should preserve manually set mode", () => {
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

                Config.read.returns(readConfig);

                const config = createConfig();

                assert.equal(config.browsers.b1.screenshotMode, "fullpage");
            });
        });
    });

    describe("takeScreenshotOnFailsMode", () => {
        it("should throw an error if option is not a string", () => {
            const readConfig = {
                browsers: {
                    b1: mkBrowser_({ takeScreenshotOnFailsMode: { not: "string" } }),
                },
            };

            Config.read.returns(readConfig);

            assert.throws(() => createConfig(), Error, /"takeScreenshotOnFailsMode" must be a string/);
        });

        it('should throw an error if option value is not "fullpage" or "viewport"', () => {
            const readConfig = {
                browsers: {
                    b1: mkBrowser_({ takeScreenshotOnFailsMode: "foo bar" }),
                },
            };

            Config.read.returns(readConfig);

            assert.throws(
                () => createConfig(),
                Error,
                /"takeScreenshotOnFailsMode" must be one of: fullpage, viewport/,
            );
        });

        describe("should not throw an error if option value is", () => {
            ["fullpage", "viewport"].forEach(value => {
                it(`${value}`, () => {
                    const readConfig = {
                        browsers: {
                            b1: mkBrowser_({ takeScreenshotOnFailsMode: value }),
                        },
                    };

                    Config.read.returns(readConfig);

                    assert.doesNotThrow(() => createConfig());
                });
            });
        });

        it("should set a default value if it is not set in config", () => {
            const readConfig = {
                browsers: {
                    b1: mkBrowser_(),
                },
            };

            Config.read.returns(readConfig);

            const config = createConfig();

            assert.equal(config.takeScreenshotOnFailsMode, defaults.takeScreenshotOnFailsMode);
        });

        it("should override option for browser", () => {
            const readConfig = {
                takeScreenshotOnFailsMode: "fullpage",
                browsers: {
                    b1: mkBrowser_(),
                    b2: mkBrowser_({ takeScreenshotOnFailsMode: "viewport" }),
                },
            };

            Config.read.returns(readConfig);

            const config = createConfig();

            assert.equal(config.browsers.b1.takeScreenshotOnFailsMode, "fullpage");
            assert.equal(config.browsers.b2.takeScreenshotOnFailsMode, "viewport");
        });
    });

    describe("orientation", () => {
        it("should throw an error if option value is not string", () => {
            const readConfig = {
                browsers: {
                    b1: mkBrowser_({ orientation: { not: "string" } }),
                },
            };

            Config.read.returns(readConfig);

            assert.throws(() => createConfig(), Error, /"orientation" must be a string/);
        });

        it('should throw an error if option value is not "landscape" or "portrait"', () => {
            const readConfig = {
                browsers: {
                    b1: mkBrowser_({ orientation: "foo bar" }),
                },
            };

            Config.read.returns(readConfig);

            assert.throws(() => createConfig(), Error, /"orientation" must be "landscape" or "portrait"/);
        });

        describe("should not throw an error if option value is", () => {
            ["landscape", "portrait"].forEach(value => {
                it(`${value}`, () => {
                    const readConfig = {
                        browsers: {
                            b1: mkBrowser_({ orientation: value }),
                        },
                    };

                    Config.read.returns(readConfig);

                    assert.doesNotThrow(() => createConfig());
                });
            });
        });

        it("should set a default value if it is not set in config", () => {
            const readConfig = {
                browsers: {
                    b1: mkBrowser_(),
                },
            };

            Config.read.returns(readConfig);

            const config = createConfig();

            assert.equal(config.orientation, defaults.orientation);
        });

        it("should override option for browser", () => {
            const readConfig = {
                orientation: "landscape",
                browsers: {
                    b1: mkBrowser_(),
                    b2: mkBrowser_({ orientation: "portrait" }),
                },
            };

            Config.read.returns(readConfig);

            const config = createConfig();

            assert.equal(config.browsers.b1.orientation, "landscape");
            assert.equal(config.browsers.b2.orientation, "portrait");
        });
    });

    ["outputDir", "user", "key", "region"].forEach(option => {
        describe(option, () => {
            it("should throw an error if value is not a null or string", () => {
                const readConfig = _.set({}, "browsers.b1", mkBrowser_({ [option]: { some: "object" } }));

                Config.read.returns(readConfig);

                assert.throws(() => createConfig(), Error, `"${option}" must be a string`);
            });

            it("should set a default value if it is not set in config", () => {
                const readConfig = _.set({}, "browsers.b1", mkBrowser_());
                Config.read.returns(readConfig);

                const config = createConfig();

                assert.equal(config[option], defaults[option]);
            });

            it("should override option for browser", () => {
                const readConfig = {
                    [option]: "init-string",
                    browsers: {
                        b1: mkBrowser_(),
                        b2: mkBrowser_({ [option]: "new-string" }),
                    },
                };

                Config.read.returns(readConfig);

                const config = createConfig();

                assert.equal(config.browsers.b1[option], "init-string");
                assert.equal(config.browsers.b2[option], "new-string");
            });
        });
    });

    ["agent", "headers"].forEach(option => {
        describe(option, () => {
            it(`should throw error if "${option}" is not an object`, () => {
                const readConfig = _.set({}, "browsers.b1", mkBrowser_({ [option]: "string" }));

                Config.read.returns(readConfig);

                assert.throws(() => createConfig(), Error, `"${option}" must be an object`);
            });

            it("should set a default value if it is not set in config", () => {
                const readConfig = _.set({}, "browsers.b1", mkBrowser_());
                Config.read.returns(readConfig);

                const config = createConfig();

                assert.equal(config[option], defaults[option]);
            });

            it("should set provided value", () => {
                const readConfig = _.set({}, "browsers.b1", mkBrowser_({ [option]: { k1: "v1", k2: "v2" } }));
                Config.read.returns(readConfig);

                const config = createConfig();

                assert.deepEqual(config.browsers.b1[option], { k1: "v1", k2: "v2" });
            });
        });
    });

    ["transformRequest", "transformResponse"].forEach(option => {
        describe(option, () => {
            it(`should throw error if ${option} is not a null or function`, () => {
                const readConfig = _.set({}, "browsers.b1", mkBrowser_({ [option]: "string" }));

                Config.read.returns(readConfig);

                assert.throws(() => createConfig(), Error, `"${option}" must be a function`);
            });

            it("should set a default value if it is not set in config", () => {
                const readConfig = _.set({}, "browsers.b1", mkBrowser_());
                Config.read.returns(readConfig);

                const config = createConfig();

                assert.equal(config[option], defaults[option]);
            });

            it(`should override ${option} option`, () => {
                const optionFn = () => {};
                const newOptionFn = () => {};

                const readConfig = {
                    [option]: optionFn,
                    browsers: {
                        b1: mkBrowser_(),
                        b2: mkBrowser_({ [option]: newOptionFn }),
                    },
                };
                Config.read.returns(readConfig);

                const config = createConfig();

                assert.equal(config.browsers.b1[option], optionFn);
                assert.equal(config.browsers.b2[option], newOptionFn);
            });
        });
    });

    ["strictSSL", "headless"].forEach(option => {
        describe(option, () => {
            it(`should throw error if ${option} is not a null or boolean`, () => {
                const readConfig = _.set({}, "browsers.b1", mkBrowser_({ [option]: "string" }));

                Config.read.returns(readConfig);

                assert.throws(() => createConfig(), Error, `"${option}" must be a boolean`);
            });

            it("should set a default value if it is not set in config", () => {
                const readConfig = _.set({}, "browsers.b1", mkBrowser_());
                Config.read.returns(readConfig);

                const config = createConfig();

                assert.equal(config[option], defaults[option]);
            });

            it(`should override ${option} option`, () => {
                const readConfig = {
                    [option]: false,
                    browsers: {
                        b1: mkBrowser_(),
                        b2: mkBrowser_({ [option]: true }),
                    },
                };
                Config.read.returns(readConfig);

                const config = createConfig();

                assert.isFalse(config.browsers.b1[option]);
                assert.isTrue(config.browsers.b2[option]);
            });
        });
    });
});
