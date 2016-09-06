'use strict';

const url = require('url');
const path = require('path');

const _ = require('lodash');
const proxyquire = require('proxyquire');

const ConfigReader = require('../../../lib/config/config-reader');
const defaults = require('../../../lib/config/defaults');

const Config = require('../../../lib/config');
const parseOptions = require('../../../lib/config/options');

describe('config', () => {
    const sandbox = sinon.sandbox.create();

    afterEach(() => sandbox.restore());

    describe('parse', () => {
        let configStub;
        let parseOptionsStub;

        beforeEach(() => {
            parseOptionsStub = sinon.stub();

            configStub = proxyquire('../../../lib/config', {
                './options': parseOptionsStub
            });
        });

        it('should read config file', () => {
            sandbox.stub(ConfigReader.prototype, 'read').returns({});

            configStub.create({}).parse();

            assert.isTrue(ConfigReader.prototype.read.called);
        });

        it('should set dirname path for config file to projectRoot field', () => {
            sandbox.stub(ConfigReader.prototype, 'read').returns({conf: 'foo/bar/.config.js'});

            configStub.create({}).parse();

            assert.propertyVal(parseOptionsStub.firstCall.args[0].options, 'projectRoot', 'foo/bar');
        });

        it('should set project path to projectRoot field when config file does not exist', () => {
            sandbox.stub(ConfigReader.prototype, 'read').returns({});

            configStub.create({}).parse();

            assert.propertyVal(parseOptionsStub.firstCall.args[0].options, 'projectRoot', process.cwd());
        });
    });

    describe('overrides', () => {
        beforeEach(() => {
            sandbox.stub(ConfigReader.prototype, 'read').returns({baseUrl: 'http://default.com'});

            process.env['hermione_base_url'] = 'http://env.com';
            process.argv = ['--base-url', 'http://cli.com'];
        });

        afterEach(() => {
            delete process.env['hermione_base_url'];
            process.argv = [];
        });

        it('should not override anything by default', () => {
            const parsedConfig = Config.create({}).parse();

            assert.equal(parsedConfig.baseUrl, 'http://default.com');
        });

        it('should not override value with env if allowOverrides.env is false', () => {
            const parsedConfig = Config.create({}, {env: false}).parse();

            assert.equal(parsedConfig.baseUrl, 'http://default.com');
        });

        it('should override value with env if allowOverrides.env is true', () => {
            const parsedConfig = Config.create({}, {env: true}).parse();

            assert.equal(parsedConfig.baseUrl, 'http://env.com');
        });

        it('should not override value with env if allowOverrides.cli is false', () => {
            const parsedConfig = Config.create({}, {cli: false}).parse();

            assert.equal(parsedConfig.baseUrl, 'http://default.com');
        });

        it('should override value with cli if allowOverrides.cli is true', () => {
            const parsedConfig = Config.create({}, {cli: true}).parse();

            assert.equal(parsedConfig.baseUrl, 'http://cli.com');
        });
    });

    describe('root parsed options', () => {
        beforeEach(() => sandbox.stub(ConfigReader.prototype, 'getConfigFromFile'));

        describe('conf', () => {
            it('should throw error if conf is not a string', () => {
                ConfigReader.prototype.getConfigFromFile.returns({
                    conf: ['Array']
                });

                const config = Config.create({});

                assert.throws(() => config.parse(), Error, 'a value must be string');
            });

            it('should set default conf option if it does not set in config file', () => {
                ConfigReader.prototype.getConfigFromFile.returns({});

                const parsedConfig = Config.create({}).parse();
                const resolvedPath = path.resolve(parsedConfig.projectRoot, defaults.conf);

                assert.equal(parsedConfig.conf, resolvedPath);
            });

            it('should override conf relative to projectRoot', () => {
                ConfigReader.prototype.getConfigFromFile.returns({
                    conf: './config.js'
                });

                const parsedConfig = Config.create({}).parse();
                const resolvedPath = path.resolve(parsedConfig.projectRoot, './config.js');

                assert.equal(parsedConfig.conf, resolvedPath);
            });
        });

        describe('debug', () => {
            it('should throw error if debug is not a boolean', () => {
                ConfigReader.prototype.getConfigFromFile.returns({
                    debug: 'String'
                });

                const config = Config.create({});

                assert.throws(() => config.parse(), Error, 'a value must be boolean');
            });

            it('should set default debug option if it does not set in config file', () => {
                ConfigReader.prototype.getConfigFromFile.returns({});

                const parsedConfig = Config.create({}).parse();

                assert.equal(parsedConfig.debug, defaults.debug);
            });

            it('should override debug option', () => {
                ConfigReader.prototype.getConfigFromFile.returns({
                    debug: true
                });

                const parsedConfig = Config.create({}).parse();

                assert.equal(parsedConfig.debug, true);
            });
        });

        describe('mochaOpts', () => {
            it('should throw error if mochaOpts is not an error or object', () => {
                ConfigReader.prototype.getConfigFromFile.returns({
                    mochaOpts: ['Array']
                });

                const config = Config.create({});

                assert.throws(() => config.parse(), Error, '"mochaOpts" should be null or object');
            });

            it('should set default mochaOpts option if it does not set in config file', () => {
                ConfigReader.prototype.getConfigFromFile.returns({});

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

                ConfigReader.prototype.getConfigFromFile.returns({mochaOpts});

                const parsedConfig = Config.create({}).parse();

                assert.deepEqual(parsedConfig.mochaOpts, mochaOpts);
            });
        });

        ['prepareBrowser', 'prepareEnvironment'].forEach((option) => {
            describe(`${option}`, () => {
                it(`should throw error if ${option} is not a null or function`, () => {
                    sandbox.stub(ConfigReader.prototype, 'read').returns(_.set({}, option, {}));

                    const config = Config.create({});

                    assert.throws(() => config.parse(), Error, `"${option}" should be null or function`);
                });

                it(`should set default ${option} option if it does not set in config file`, () => {
                    ConfigReader.prototype.getConfigFromFile.returns({});

                    const parsedConfig = Config.create({}).parse();

                    assert.equal(parsedConfig[option], defaults[option]);
                });

                it(`should override ${option} option`, () => {
                    const func = () => {};

                    ConfigReader.prototype.getConfigFromFile.returns(_.set({}, option, func));

                    const parsedConfig = Config.create({}).parse();

                    assert.deepEqual(parsedConfig[option], func);
                });
            });
        });

        describe('projectRoot', () => {
            it('should set config dir as projectRoot option if projectRoot is not a string', () => {
                ConfigReader.prototype.getConfigFromFile.returns({
                    projectRoot: ['Array']
                });

                const parsedConfig = Config.create({}).parse();
                const configDir = path.dirname(parsedConfig.conf);

                assert.equal(parsedConfig.projectRoot, path.resolve(configDir, parsedConfig.projectRoot));
            });
        });

        describe('reporters', () => {
            it('should throw error if reporters is not an array', () => {
                ConfigReader.prototype.getConfigFromFile.returns({
                    reporters: 'String'
                });

                const config = Config.create({});

                assert.throws(() => config.parse(), Error, '"reporters" should be an array');
            });

            it('should set default reporters option if it does not set in config file', () => {
                ConfigReader.prototype.getConfigFromFile.returns({});

                const parsedConfig = Config.create({}).parse();

                assert.sameMembers(parsedConfig.reporters, defaults.reporters);
            });

            it('should override reporters option', () => {
                ConfigReader.prototype.getConfigFromFile.returns({
                    reporters: ['foo', 'bar']
                });

                const parsedConfig = Config.create({}).parse();

                assert.deepEqual(parsedConfig.reporters, ['foo', 'bar']);
            });
        });

        describe('specs', () => {
            it('should throw error if specs option is not an array', () => {
                ConfigReader.prototype.getConfigFromFile.returns({
                    specs: 'String'
                });

                const config = Config.create({});

                assert.throws(() => config.parse(), Error, '"specs" should be an array');
            });

            it('should set default specs option if it does not set in config file', () => {
                ConfigReader.prototype.getConfigFromFile.returns({});

                const parsedConfig = Config.create({}).parse();

                assert.sameMembers(parsedConfig.specs, defaults.specs);
            });

            it('should override specs option', () => {
                ConfigReader.prototype.getConfigFromFile.returns({
                    specs: ['bar', 'baz']
                });

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
                    ConfigReader.prototype.getConfigFromFile.returns({
                        browsers: {
                            b1: {}
                        }
                    });

                    const config = Config.create({});

                    assert.throws(() => config.parse(), Error, 'Browser must have desired capabilities set');
                });

                it('is not an object or null', () => {
                    ConfigReader.prototype.getConfigFromFile.returns({
                        browsers: {
                            b1: {
                                desiredCapabilities: 'chrome'
                            }
                        }
                    });

                    const config = Config.create({});

                    assert.throws(() => config.parse(), Error, 'desiredCapabilities should be null or object');
                });
            })

            it('should set desiredCapabilities', () => {
                ConfigReader.prototype.getConfigFromFile.returns({
                    browsers: {
                        b1: {
                            desiredCapabilities: {
                                browserName: 'yabro'
                            }
                        }
                    }
                });

                const parsedConfig = Config.create({}).parse();

                assert.deepEqual(parsedConfig.browsers.b1.desiredCapabilities, {browserName: 'yabro'});
            });
        });

        describe('baseUrl', () => {
            it('should throw error if baseUrl is not a string', () => {
                ConfigReader.prototype.getConfigFromFile.returns({
                    browsers: {
                        b1: mkBrowser_({baseUrl: ['Array']})
                    }
                });

                const config = Config.create({});

                assert.throws(() => config.parse(), Error, 'a value must be string');
            });

            it('should set baseUrl to all browsers', () => {
                ConfigReader.prototype.getConfigFromFile.returns({
                    browsers: {
                        b1: mkBrowser_(),
                        b2: mkBrowser_()
                    }
                });

                const parsedConfig = Config.create({}).parse();

                assert.isDefined(defaults.baseUrl);
                assert.equal(parsedConfig.browsers.b1.baseUrl, defaults.baseUrl);
                assert.equal(parsedConfig.browsers.b2.baseUrl, defaults.baseUrl);
            });

            it('should override baseUrl if protocol is set', () => {
                ConfigReader.prototype.getConfigFromFile.returns({
                    browsers: {
                        b1: mkBrowser_(),
                        b2: mkBrowser_({baseUrl: 'http://foo.com'})
                    }
                });

                const parsedConfig = Config.create({}).parse();

                assert.equal(parsedConfig.browsers.b1.baseUrl, defaults.baseUrl);
                assert.equal(parsedConfig.browsers.b2.baseUrl, 'http://foo.com');
            });

            it('should resolve baseUrl relative to default baseUrl', () => {
                ConfigReader.prototype.getConfigFromFile.returns({
                    browsers: {
                        b1: mkBrowser_(),
                        b2: mkBrowser_({baseUrl: '/test'})
                    }
                });

                const parsedConfig = Config.create({}).parse();

                assert.equal(parsedConfig.browsers.b1.baseUrl, defaults.baseUrl);
                assert.equal(parsedConfig.browsers.b2.baseUrl, url.resolve(defaults.baseUrl, '/test'));
            });
        });

        describe('grid', () => {
            it('should throw error if grid is not a string', () => {
                ConfigReader.prototype.getConfigFromFile.returns({
                    browsers: {
                        b1: mkBrowser_({grid: /regExp/})
                    }
                });

                const config = Config.create({});

                assert.throws(() => config.parse(), Error, 'a value must be string');
            });

            it('should set grid to all browsers', () => {
                ConfigReader.prototype.getConfigFromFile.returns({
                    browsers: {
                        b1: mkBrowser_(),
                        b2: mkBrowser_()
                    }
                });

                const parsedConfig = Config.create({}).parse();

                assert.isDefined(defaults.grid);
                assert.equal(parsedConfig.browsers.b1.grid, defaults.grid);
                assert.equal(parsedConfig.browsers.b2.grid, defaults.grid);
            });

            it('should override grid option', () => {
                ConfigReader.prototype.getConfigFromFile.returns({
                    browsers: {
                        b1: mkBrowser_(),
                        b2: mkBrowser_({grid: 'http://bar.com'})
                    }
                });

                const parsedConfig = Config.create({}).parse();

                assert.equal(parsedConfig.browsers.b1.grid, defaults.grid);
                assert.equal(parsedConfig.browsers.b2.grid, 'http://bar.com');
            });
        });

        describe('screenshotPath', () => {
            it('should throw error if screenshotPath is not a null or string', () => {
                ConfigReader.prototype.getConfigFromFile.returns({
                    browsers: {
                        b1: mkBrowser_({screenshotPath: ['Array']})
                    }
                });

                const config = Config.create({});

                assert.throws(() => config.parse(), Error, '"screenshotPath" should be null or string');
            });

            it('should set screenshotPath option to all browsers', () => {
                ConfigReader.prototype.getConfigFromFile.returns({
                    browsers: {
                        b1: mkBrowser_(),
                        b2: mkBrowser_()
                    }
                });

                const parsedConfig = Config.create({}).parse();

                assert.isDefined(defaults.screenshotPath);
                assert.equal(parsedConfig.browsers.b1.screenshotPath, defaults.screenshotPath);
                assert.equal(parsedConfig.browsers.b2.screenshotPath, defaults.screenshotPath);
            });

            it('should override screenshotPath option', () => {
                ConfigReader.prototype.getConfigFromFile.returns({
                    browsers: {
                        b1: mkBrowser_(),
                        b2: mkBrowser_({screenshotPath: '/screens'})
                    }
                });

                const parsedConfig = Config.create({}).parse();

                assert.equal(parsedConfig.browsers.b1.screenshotPath, defaults.screenshotPath);
                assert.equal(parsedConfig.browsers.b2.screenshotPath, '/screens');
            });

            it('should resolve screenshotPath relative to projectRoot', () => {
                ConfigReader.prototype.getConfigFromFile.returns({
                    browsers: {
                        b1: mkBrowser_(),
                        b2: mkBrowser_({screenshotPath: './screens'})
                    }
                });

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
                        ConfigReader.prototype.getConfigFromFile.returns({
                            browsers: {
                                b1: mkBrowser_(_.set({}, option, '10'))
                            }
                        });

                        const config = Config.create({});

                        assert.throws(() => config.parse(), Error, 'Field must be an integer number');
                    });

                    it('is negative number', () => {
                        ConfigReader.prototype.getConfigFromFile.returns({
                            browsers: {
                                b1: mkBrowser_(_.set({}, option, -5))
                            }
                        });

                        const config = Config.create({});

                        assert.throws(() => config.parse(), Error, 'Field must be positive');
                    });

                    it('is float number', () => {
                        ConfigReader.prototype.getConfigFromFile.returns({
                            browsers: {
                                b1: mkBrowser_(_.set({}, option, 15.5))
                            }
                        });

                        const config = Config.create({});

                        assert.throws(() => config.parse(), Error, 'Field must be an integer number');
                    });
                });


                it(`should set ${option} option to all browsers`, () => {
                    ConfigReader.prototype.getConfigFromFile.returns({
                        browsers: {
                            b1: mkBrowser_(),
                            b2: mkBrowser_()
                        }
                    });

                    const parsedConfig = Config.create({}).parse();

                    assert.isDefined(defaults[option]);
                    assert.equal(parsedConfig.browsers.b1[option], defaults[option]);
                    assert.equal(parsedConfig.browsers.b2[option], defaults[option]);
                });

                it(`should override ${option} option`, () => {
                    ConfigReader.prototype.getConfigFromFile.returns({
                        browsers: {
                            b1: mkBrowser_(),
                            b2: mkBrowser_(_.set({}, option, 13))
                        }
                    });

                    const parsedConfig = Config.create({}).parse();

                    assert.equal(parsedConfig.browsers.b1[option], defaults[option]);
                    assert.equal(parsedConfig.browsers.b2[option], 13);
                });
            });
        });

        describe('retry', () => {
            describe('should throw error if retry', () => {
                it('is not a number', () => {
                    ConfigReader.prototype.getConfigFromFile.returns({
                        browsers: {
                            b1: mkBrowser_({retry: '5'})
                        }
                    });

                    const config = Config.create({});

                    assert.throws(() => config.parse(), Error, 'a value must be number');
                });

                it('is negative', () => {
                    ConfigReader.prototype.getConfigFromFile.returns({
                        browsers: {
                            b1: mkBrowser_({retry: -7})
                        }
                    });

                    const config = Config.create({});

                    assert.throws(() => config.parse(), Error, '"retry" should be non-negative');
                });
            });

            it('should set retry option to all browsers', () => {
                ConfigReader.prototype.getConfigFromFile.returns({
                    browsers: {
                        b1: mkBrowser_(),
                        b2: mkBrowser_()
                    }
                });

                const parsedConfig = Config.create({}).parse();

                assert.isDefined(defaults.retry);
                assert.equal(parsedConfig.browsers.b1.retry, defaults.retry);
                assert.equal(parsedConfig.browsers.b2.retry, defaults.retry);
            });

            it('should override retry option', () => {
                ConfigReader.prototype.getConfigFromFile.returns({
                    browsers: {
                        b1: mkBrowser_(),
                        b2: mkBrowser_({retry: 7})
                    }
                });

                const parsedConfig = Config.create({}).parse();

                assert.equal(parsedConfig.browsers.b1.retry, defaults.retry);
                assert.equal(parsedConfig.browsers.b2.retry, 7);
            });
        });
    });
});
