/*jshint sub:true*/

'use strict';

const path = require('path');
const url = require('url');

const _ = require('lodash');
const proxyquire = require('proxyquire');

const ConfigReader = require('../../../lib/config/config-reader');
const defaults = require('../../../lib/config/defaults');
const Config = require('../../../lib/config');

describe('config', () => {
    const sandbox = sinon.sandbox.create();

    afterEach(() => sandbox.restore());

    const mkConfig_ = (opts) => {
        return _.defaults(opts || {}, {
            specs: ['path/to/test']
        });
    };

    describe('parse', () => {
        let configStub;
        let parseOptions;

        beforeEach(() => {
            parseOptions = sinon.stub();

            configStub = proxyquire('../../../lib/config', {
                './options': parseOptions
            });
        });

        it('should read config file', () => {
            sandbox.stub(ConfigReader.prototype, 'read').returns({});

            configStub.create({}).parse();

            assert.isTrue(ConfigReader.prototype.read.calledOnce);
        });

        it('should set dir path for config file to projectRoot field', () => {
            sandbox.stub(ConfigReader.prototype, 'read').returns({conf: 'foo/bar/.config.js'});

            configStub.create({}).parse();

            assert.propertyVal(parseOptions.firstCall.args[0].options, 'projectRoot', 'foo/bar');
        });

        it('should set curr working dir to projectRoot field when config file does not exist', () => {
            sandbox.stub(ConfigReader.prototype, 'read').returns({});

            configStub.create({}).parse();

            assert.propertyVal(parseOptions.firstCall.args[0].options, 'projectRoot', process.cwd());
        });
    });

    describe('overrides options', () => {
        beforeEach(() => sandbox.stub(ConfigReader.prototype, 'read'));

        afterEach(() => {
            delete process.env['hermione_base_url'];
            process.argv = [];
        });

        it('should not override anything by default', () => {
            const readConfig = mkConfig_({baseUrl: 'http://default.com'});
            ConfigReader.prototype.read.returns(readConfig);

            const parsedConfig = Config.create({}).parse();

            assert.equal(parsedConfig.baseUrl, 'http://default.com');
        });

        it('should not override value with env if allowOverrides.env is false', () => {
            const readConfig = mkConfig_({baseUrl: 'http://default.com'});
            ConfigReader.prototype.read.returns(readConfig);

            const parsedConfig = Config.create({}, {env: false}).parse();

            assert.equal(parsedConfig.baseUrl, 'http://default.com');
        });

        it('should override value with env if allowOverrides.env is true', () => {
            const readConfig = mkConfig_({baseUrl: 'http://default.com'});
            ConfigReader.prototype.read.returns(readConfig);

            process.env['hermione_base_url'] = 'http://env.com';

            const parsedConfig = Config.create({}, {env: true}).parse();

            assert.equal(parsedConfig.baseUrl, 'http://env.com');
        });

        it('should not override value with env if allowOverrides.cli is false', () => {
            const readConfig = mkConfig_({baseUrl: 'http://default.com'});
            ConfigReader.prototype.read.returns(readConfig);

            const parsedConfig = Config.create({}, {cli: false}).parse();

            assert.equal(parsedConfig.baseUrl, 'http://default.com');
        });

        it('should override value with cli if allowOverrides.cli is true', () => {
            const readConfig = mkConfig_({baseUrl: 'http://default.com'});
            ConfigReader.prototype.read.returns(readConfig);

            process.argv = ['--base-url', 'http://cli.com'];

            const parsedConfig = Config.create({}, {cli: true}).parse();

            assert.equal(parsedConfig.baseUrl, 'http://cli.com');
        });
    });

    describe('root parsed options', () => {
        beforeEach(() => sandbox.stub(ConfigReader.prototype, 'getConfigFromFile'));

        describe('config', () => {
            it('should throw error if config is not a string', () => {
                const readConfig = mkConfig_({config: ['Array']});
                ConfigReader.prototype.getConfigFromFile.returns(readConfig);

                const config = Config.create({});

                assert.throws(() => config.parse(), Error, 'a value must be string');
            });

            it('should set default config relative to projectRoot if it does not set in config file', () => {
                ConfigReader.prototype.getConfigFromFile.returns(mkConfig_());

                const parsedConfig = Config.create({}).parse();
                const resolvedPath = path.resolve(parsedConfig.projectRoot, defaults.config);

                assert.equal(parsedConfig.config, resolvedPath);
            });

            it('should override config relative to projectRoot', () => {
                const readConfig = mkConfig_({config: './config.js'});
                ConfigReader.prototype.getConfigFromFile.returns(readConfig);

                const parsedConfig = Config.create({}).parse();
                const resolvedPath = path.resolve(parsedConfig.projectRoot, './config.js');

                assert.equal(parsedConfig.config, resolvedPath);
            });
        });

        describe('debug', () => {
            it('should throw error if debug is not a boolean', () => {
                const readConfig = mkConfig_({debug: 'String'});
                ConfigReader.prototype.getConfigFromFile.returns(readConfig);

                const config = Config.create({});

                assert.throws(() => config.parse(), Error, 'a value must be boolean');
            });

            it('should set default debug option if it does not set in config file', () => {
                ConfigReader.prototype.getConfigFromFile.returns(mkConfig_());

                const parsedConfig = Config.create({}).parse();

                assert.equal(parsedConfig.debug, defaults.debug);
            });

            it('should override debug option', () => {
                const readConfig = mkConfig_({debug: true});
                ConfigReader.prototype.getConfigFromFile.returns(readConfig);

                const parsedConfig = Config.create({}).parse();

                assert.equal(parsedConfig.debug, true);
            });
        });

        describe('mochaOpts', () => {
            it('should throw error if mochaOpts is not an error or object', () => {
                const readConfig = mkConfig_({mochaOpts: ['Array']});
                ConfigReader.prototype.getConfigFromFile.returns(readConfig);

                const config = Config.create({});

                assert.throws(() => config.parse(), Error, '"mochaOpts" should be null or object');
            });

            it('should set default mochaOpts option if it does not set in config file', () => {
                ConfigReader.prototype.getConfigFromFile.returns(mkConfig_());

                const parsedConfig = Config.create({}).parse();

                assert.deepEqual(parsedConfig.mochaOpts, defaults.mochaOpts);
            });

            it('should override mochaOpts option', () => {
                const mochaOpts = {
                    slow: 1000,
                    timeout: 10000,
                    grep: 'test',
                    ignoreLeaks: true
                };

                const readConfig = mkConfig_({mochaOpts});
                ConfigReader.prototype.getConfigFromFile.returns(readConfig);

                const parsedConfig = Config.create({}).parse();

                assert.deepEqual(parsedConfig.mochaOpts, mochaOpts);
            });
        });

        ['prepareBrowser', 'prepareEnvironment'].forEach((option) => {
            describe(`${option}`, () => {
                it(`should throw error if ${option} is not a null or function`, () => {
                    const readConfig = mkConfig_(_.set({}, option, {}));
                    sandbox.stub(ConfigReader.prototype, 'read').returns(readConfig);

                    const config = Config.create({});

                    assert.throws(() => config.parse(), Error, `"${option}" should be null or function`);
                });

                it(`should set default ${option} option if it does not set in config file`, () => {
                    ConfigReader.prototype.getConfigFromFile.returns(mkConfig_());

                    const parsedConfig = Config.create({}).parse();

                    assert.equal(parsedConfig[option], defaults[option]);
                });

                it(`should override ${option} option`, () => {
                    const func = () => {};
                    const readConfig = mkConfig_(_.set({}, option, func));

                    ConfigReader.prototype.getConfigFromFile.returns(readConfig);

                    const parsedConfig = Config.create({}).parse();

                    assert.deepEqual(parsedConfig[option], func);
                });
            });
        });

        describe('projectRoot', () => {
            it('should set config dir as projectRoot option if projectRoot is not a string', () => {
                const readConfig = mkConfig_({projectRoot: ['Array']});
                ConfigReader.prototype.getConfigFromFile.returns(readConfig);

                const parsedConfig = Config.create({}).parse();
                const configDir = path.dirname(parsedConfig.conf);

                assert.equal(parsedConfig.projectRoot, path.resolve(configDir, parsedConfig.projectRoot));
            });
        });

        describe('reporters', () => {
            it('should throw error if reporters is not an array', () => {
                const readConfig = mkConfig_({reporters: 'String'});
                ConfigReader.prototype.getConfigFromFile.returns(readConfig);

                const config = Config.create({});

                assert.throws(() => config.parse(), Error, '"reporters" should be an array');
            });

            it('should set default reporters option if it does not set in config file', () => {
                ConfigReader.prototype.getConfigFromFile.returns(mkConfig_());

                const parsedConfig = Config.create({}).parse();

                assert.sameMembers(parsedConfig.reporters, defaults.reporters);
            });

            it('should override reporters option', () => {
                const readConfig = mkConfig_({reporters: ['foo', 'bar']});
                ConfigReader.prototype.getConfigFromFile.returns(readConfig);

                const parsedConfig = Config.create({}).parse();

                assert.deepEqual(parsedConfig.reporters, ['foo', 'bar']);
            });
        });

        describe('specs', () => {
            it('should throw error if specs is empty', () => {
                ConfigReader.prototype.getConfigFromFile.returns({});

                const config = Config.create({});

                assert.throws(() => config.parse(), Error, '"specs" is required option and should not be empty');
            });

            it('should throw error if specs option is not an array', () => {
                const readConfig = mkConfig_({specs: 'String'});
                ConfigReader.prototype.getConfigFromFile.returns(readConfig);

                const config = Config.create({});

                assert.throws(() => config.parse(), Error, '"specs" should be an array');
            });

            it('should override specs option', () => {
                const readConfig = mkConfig_({specs: ['bar', 'baz']});
                ConfigReader.prototype.getConfigFromFile.returns(readConfig);

                const parsedConfig = Config.create({}).parse();

                assert.deepEqual(parsedConfig.specs, ['bar', 'baz']);
            });
        });
    });

    describe('parsed options per browser', () => {
        beforeEach(() => sandbox.stub(ConfigReader.prototype, 'getConfigFromFile'));

        const mkBrowser_ = (opts) => {
            return _.defaults(opts || {}, {
                desiredCapabilities: {}
            });
        };

        describe('desiredCapabilities', () => {
            describe('should throw error if desiredCapabilities', () => {
                it('is missing', () => {
                    const readConfig = mkConfig_({
                        browsers: {
                            b1: {}
                        }
                    });

                    ConfigReader.prototype.getConfigFromFile.returns(readConfig);

                    const config = Config.create({});

                    assert.throws(() => config.parse(), Error, 'Browser must have desired capabilities option');
                });

                it('is not an object or null', () => {
                    const readConfig = mkConfig_({
                        browsers: {
                            b1: {
                                desiredCapabilities: 'chrome'
                            }
                        }
                    });

                    ConfigReader.prototype.getConfigFromFile.returns(readConfig);

                    const config = Config.create({});

                    assert.throws(() => config.parse(), Error, 'desiredCapabilities should be null or object');
                });
            });

            it('should set desiredCapabilities', () => {
                const readConfig = mkConfig_({
                    browsers: {
                        b1: {
                            desiredCapabilities: {
                                browserName: 'yabro'
                            }
                        }
                    }
                });

                ConfigReader.prototype.getConfigFromFile.returns(readConfig);

                const parsedConfig = Config.create({}).parse();

                assert.deepEqual(parsedConfig.browsers.b1.desiredCapabilities, {browserName: 'yabro'});
            });
        });

        describe('baseUrl', () => {
            it('should throw error if baseUrl is not a string', () => {
                const readConfig = mkConfig_({
                    browsers: {
                        b1: mkBrowser_({baseUrl: ['Array']})
                    }
                });

                ConfigReader.prototype.getConfigFromFile.returns(readConfig);

                const config = Config.create({});

                assert.throws(() => config.parse(), Error, 'a value must be string');
            });

            it('should set baseUrl to all browsers', () => {
                const readConfig = mkConfig_({
                    browsers: {
                        b1: mkBrowser_(),
                        b2: mkBrowser_()
                    }
                });

                ConfigReader.prototype.getConfigFromFile.returns(readConfig);

                const parsedConfig = Config.create({}).parse();

                assert.isDefined(defaults.baseUrl);
                assert.equal(parsedConfig.browsers.b1.baseUrl, defaults.baseUrl);
                assert.equal(parsedConfig.browsers.b2.baseUrl, defaults.baseUrl);
            });

            it('should override baseUrl if protocol is set', () => {
                const readConfig = mkConfig_({
                    browsers: {
                        b1: mkBrowser_(),
                        b2: mkBrowser_({baseUrl: 'http://foo.com'})
                    }
                });

                ConfigReader.prototype.getConfigFromFile.returns(readConfig);

                const parsedConfig = Config.create({}).parse();

                assert.equal(parsedConfig.browsers.b1.baseUrl, defaults.baseUrl);
                assert.equal(parsedConfig.browsers.b2.baseUrl, 'http://foo.com');
            });

            it('should resolve baseUrl relative to default baseUrl', () => {
                const readConfig = mkConfig_({
                    browsers: {
                        b1: mkBrowser_(),
                        b2: mkBrowser_({baseUrl: '/test'})
                    }
                });

                ConfigReader.prototype.getConfigFromFile.returns(readConfig);

                const parsedConfig = Config.create({}).parse();

                assert.equal(parsedConfig.browsers.b1.baseUrl, defaults.baseUrl);
                assert.equal(parsedConfig.browsers.b2.baseUrl, url.resolve(defaults.baseUrl, '/test'));
            });
        });

        describe('gridUrl', () => {
            it('should throw error if gridUrl is not a string', () => {
                const readConfig = mkConfig_({
                    browsers: {
                        b1: mkBrowser_({gridUrl: /regExp/})
                    }
                });

                ConfigReader.prototype.getConfigFromFile.returns(readConfig);

                const config = Config.create({});

                assert.throws(() => config.parse(), Error, 'a value must be string');
            });

            it('should set gridUrl to all browsers', () => {
                const readConfig = mkConfig_({
                    browsers: {
                        b1: mkBrowser_(),
                        b2: mkBrowser_()
                    }
                });

                ConfigReader.prototype.getConfigFromFile.returns(readConfig);

                const parsedConfig = Config.create({}).parse();

                assert.isDefined(defaults.gridUrl);
                assert.equal(parsedConfig.browsers.b1.gridUrl, defaults.gridUrl);
                assert.equal(parsedConfig.browsers.b2.gridUrl, defaults.gridUrl);
            });

            it('should override gridUrl option', () => {
                const readConfig = mkConfig_({
                    browsers: {
                        b1: mkBrowser_(),
                        b2: mkBrowser_({gridUrl: 'http://bar.com'})
                    }
                });

                ConfigReader.prototype.getConfigFromFile.returns(readConfig);

                const parsedConfig = Config.create({}).parse();

                assert.equal(parsedConfig.browsers.b1.gridUrl, defaults.gridUrl);
                assert.equal(parsedConfig.browsers.b2.gridUrl, 'http://bar.com');
            });
        });

        describe('screenshotPath', () => {
            it('should throw error if screenshotPath is not a null or string', () => {
                const readConfig = mkConfig_({
                    browsers: {
                        b1: mkBrowser_({screenshotPath: ['Array']})
                    }
                });

                ConfigReader.prototype.getConfigFromFile.returns(readConfig);

                const config = Config.create({});

                assert.throws(() => config.parse(), Error, '"screenshotPath" should be null or string');
            });

            it('should set screenshotPath option to all browsers', () => {
                const readConfig = mkConfig_({
                    browsers: {
                        b1: mkBrowser_(),
                        b2: mkBrowser_()
                    }
                });

                ConfigReader.prototype.getConfigFromFile.returns(readConfig);

                const parsedConfig = Config.create({}).parse();

                assert.isDefined(defaults.screenshotPath);
                assert.equal(parsedConfig.browsers.b1.screenshotPath, defaults.screenshotPath);
                assert.equal(parsedConfig.browsers.b2.screenshotPath, defaults.screenshotPath);
            });

            it('should override screenshotPath option', () => {
                const readConfig = mkConfig_({
                    browsers: {
                        b1: mkBrowser_(),
                        b2: mkBrowser_({screenshotPath: '/screens'})
                    }
                });

                ConfigReader.prototype.getConfigFromFile.returns(readConfig);

                const parsedConfig = Config.create({}).parse();

                assert.equal(parsedConfig.browsers.b1.screenshotPath, defaults.screenshotPath);
                assert.equal(parsedConfig.browsers.b2.screenshotPath, '/screens');
            });

            it('should resolve screenshotPath relative to projectRoot', () => {
                const readConfig = mkConfig_({
                    browsers: {
                        b1: mkBrowser_(),
                        b2: mkBrowser_({screenshotPath: './screens'})
                    }
                });

                ConfigReader.prototype.getConfigFromFile.returns(readConfig);

                const parsedConfig = Config.create({}).parse();
                const resolvedPath = path.resolve(parsedConfig.projectRoot, './screens');

                assert.equal(parsedConfig.browsers.b1.screenshotPath, defaults.screenshotPath);
                assert.equal(parsedConfig.browsers.b2.screenshotPath, resolvedPath);
            });
        });

        ['sessionsPerBrowser', 'waitTimeout'].forEach((option) => {
            describe(`${option}`, () => {
                describe(`should throw error if ${option}`, () => {
                    it('is not a number', () => {
                        const readConfig = mkConfig_({
                            browsers: {
                                b1: mkBrowser_(_.set({}, option, '10'))
                            }
                        });

                        ConfigReader.prototype.getConfigFromFile.returns(readConfig);

                        const config = Config.create({});

                        assert.throws(() => config.parse(), Error, 'Field must be an integer number');
                    });

                    it('is negative number', () => {
                        const readConfig = mkConfig_({
                            browsers: {
                                b1: mkBrowser_(_.set({}, option, -5))
                            }
                        });

                        ConfigReader.prototype.getConfigFromFile.returns(readConfig);

                        const config = Config.create({});

                        assert.throws(() => config.parse(), Error, 'Field must be positive');
                    });

                    it('is float number', () => {
                        const readConfig = mkConfig_({
                            browsers: {
                                b1: mkBrowser_(_.set({}, option, 15.5))
                            }
                        });

                        ConfigReader.prototype.getConfigFromFile.returns(readConfig);

                        const config = Config.create({});

                        assert.throws(() => config.parse(), Error, 'Field must be an integer number');
                    });
                });

                it(`should set ${option} option to all browsers`, () => {
                    const readConfig = mkConfig_({
                        browsers: {
                            b1: mkBrowser_(),
                            b2: mkBrowser_()
                        }
                    });

                    ConfigReader.prototype.getConfigFromFile.returns(readConfig);

                    const parsedConfig = Config.create({}).parse();

                    assert.isDefined(defaults[option]);
                    assert.equal(parsedConfig.browsers.b1[option], defaults[option]);
                    assert.equal(parsedConfig.browsers.b2[option], defaults[option]);
                });

                it(`should override ${option} option`, () => {
                    const readConfig = mkConfig_({
                        browsers: {
                            b1: mkBrowser_(),
                            b2: mkBrowser_(_.set({}, option, 13))
                        }
                    });

                    ConfigReader.prototype.getConfigFromFile.returns(readConfig);

                    const parsedConfig = Config.create({}).parse();

                    assert.equal(parsedConfig.browsers.b1[option], defaults[option]);
                    assert.equal(parsedConfig.browsers.b2[option], 13);
                });
            });
        });

        describe('retry', () => {
            describe('should throw error if retry', () => {
                it('is not a number', () => {
                    const readConfig = mkConfig_({
                        browsers: {
                            b1: mkBrowser_({retry: '5'})
                        }
                    });

                    ConfigReader.prototype.getConfigFromFile.returns(readConfig);

                    const config = Config.create({});

                    assert.throws(() => config.parse(), Error, 'a value must be number');
                });

                it('is negative', () => {
                    const readConfig = mkConfig_({
                        browsers: {
                            b1: mkBrowser_({retry: -7})
                        }
                    });

                    ConfigReader.prototype.getConfigFromFile.returns(readConfig);

                    const config = Config.create({});

                    assert.throws(() => config.parse(), Error, '"retry" should be non-negative');
                });
            });

            it('should set retry option to all browsers', () => {
                const readConfig = mkConfig_({
                    browsers: {
                        b1: mkBrowser_(),
                        b2: mkBrowser_()
                    }
                });

                ConfigReader.prototype.getConfigFromFile.returns(readConfig);

                const parsedConfig = Config.create({}).parse();

                assert.isDefined(defaults.retry);
                assert.equal(parsedConfig.browsers.b1.retry, defaults.retry);
                assert.equal(parsedConfig.browsers.b2.retry, defaults.retry);
            });

            it('should override retry option', () => {
                const readConfig = mkConfig_({
                    browsers: {
                        b1: mkBrowser_(),
                        b2: mkBrowser_({retry: 7})
                    }
                });

                ConfigReader.prototype.getConfigFromFile.returns(readConfig);

                const parsedConfig = Config.create({}).parse();

                assert.equal(parsedConfig.browsers.b1.retry, defaults.retry);
                assert.equal(parsedConfig.browsers.b2.retry, 7);
            });
        });
    });
});
