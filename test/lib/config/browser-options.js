'use strict';

const path = require('path');
const url = require('url');
const _ = require('lodash');

const ConfigReader = require('../../../lib/config/config-reader');
const defaults = require('../../../lib/config/defaults');
const Config = require('../../../lib/config');

describe('config browser-options', () => {
    const sandbox = sinon.sandbox.create();

    const mkBrowser_ = (opts) => {
        return _.defaults(opts || {}, {
            desiredCapabilities: {}
        });
    };

    const mkConfig_ = (opts) => {
        return _.defaults(opts || {}, {
            specs: ['path/to/test']
        });
    };

    beforeEach(() => sandbox.stub(ConfigReader.prototype, 'read'));

    afterEach(() => sandbox.restore());

    describe('desiredCapabilities', () => {
        describe('should throw error if desiredCapabilities', () => {
            it('is missing', () => {
                const readConfig = mkConfig_({
                    browsers: {
                        b1: {}
                    }
                });

                ConfigReader.prototype.read.returns(readConfig);

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

                ConfigReader.prototype.read.returns(readConfig);

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

            ConfigReader.prototype.read.returns(readConfig);

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

            ConfigReader.prototype.read.returns(readConfig);

            const config = Config.create({});

            assert.throws(() => config.parse(), Error, 'value must be a string');
        });

        it('should set baseUrl to all browsers', () => {
            const baseUrl = 'http://default.com';
            const readConfig = mkConfig_({
                baseUrl,
                browsers: {
                    b1: mkBrowser_(),
                    b2: mkBrowser_()
                }
            });

            ConfigReader.prototype.read.returns(readConfig);

            const parsedConfig = Config.create({}).parse();

            assert.equal(parsedConfig.browsers.b1.baseUrl, baseUrl);
            assert.equal(parsedConfig.browsers.b2.baseUrl, baseUrl);
        });

        it('should override baseUrl if protocol is set', () => {
            const baseUrl = 'http://default.com';
            const readConfig = mkConfig_({
                baseUrl,
                browsers: {
                    b1: mkBrowser_(),
                    b2: mkBrowser_({baseUrl: 'http://foo.com'})
                }
            });

            ConfigReader.prototype.read.returns(readConfig);

            const parsedConfig = Config.create({}).parse();

            assert.equal(parsedConfig.browsers.b1.baseUrl, baseUrl);
            assert.equal(parsedConfig.browsers.b2.baseUrl, 'http://foo.com');
        });

        it('should resolve baseUrl relative to default baseUrl', () => {
            const baseUrl = 'http://default.com';
            const readConfig = mkConfig_({
                baseUrl,
                browsers: {
                    b1: mkBrowser_(),
                    b2: mkBrowser_({baseUrl: '/test'})
                }
            });

            ConfigReader.prototype.read.returns(readConfig);

            const parsedConfig = Config.create({}).parse();

            assert.equal(parsedConfig.browsers.b1.baseUrl, baseUrl);
            assert.equal(parsedConfig.browsers.b2.baseUrl, url.resolve(baseUrl, '/test'));
        });
    });

    describe('gridUrl', () => {
        it('should throw error if gridUrl is not a string', () => {
            const readConfig = mkConfig_({
                browsers: {
                    b1: mkBrowser_({gridUrl: /regExp/})
                }
            });

            ConfigReader.prototype.read.returns(readConfig);

            const config = Config.create({});

            assert.throws(() => config.parse(), Error, 'value must be a string');
        });

        it('should set gridUrl to all browsers', () => {
            const gridUrl = 'http://default.com';
            const readConfig = mkConfig_({
                gridUrl,
                browsers: {
                    b1: mkBrowser_(),
                    b2: mkBrowser_()
                }
            });

            ConfigReader.prototype.read.returns(readConfig);

            const parsedConfig = Config.create({}).parse();

            assert.equal(parsedConfig.browsers.b1.gridUrl, gridUrl);
            assert.equal(parsedConfig.browsers.b2.gridUrl, gridUrl);
        });

        it('should override gridUrl option', () => {
            const gridUrl = 'http://default.com';
            const readConfig = mkConfig_({
                gridUrl,
                browsers: {
                    b1: mkBrowser_(),
                    b2: mkBrowser_({gridUrl: 'http://bar.com'})
                }
            });

            ConfigReader.prototype.read.returns(readConfig);

            const parsedConfig = Config.create({}).parse();

            assert.equal(parsedConfig.browsers.b1.gridUrl, gridUrl);
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

            ConfigReader.prototype.read.returns(readConfig);

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

            ConfigReader.prototype.read.returns(readConfig);

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

            ConfigReader.prototype.read.returns(readConfig);

            const parsedConfig = Config.create({}).parse();

            assert.equal(parsedConfig.browsers.b1.screenshotPath, defaults.screenshotPath);
            assert.equal(parsedConfig.browsers.b2.screenshotPath, '/screens');
        });

        it('should resolve screenshotPath relative to project dir', () => {
            const readConfig = mkConfig_({
                browsers: {
                    b1: mkBrowser_(),
                    b2: mkBrowser_({screenshotPath: './screens'})
                }
            });

            ConfigReader.prototype.read.returns(readConfig);

            const parsedConfig = Config.create({}).parse();
            const resolvedPath = path.resolve(process.cwd(), './screens');

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

                    ConfigReader.prototype.read.returns(readConfig);

                    const config = Config.create({});

                    assert.throws(() => config.parse(), Error, 'Field must be an integer number');
                });

                it('is negative number', () => {
                    const readConfig = mkConfig_({
                        browsers: {
                            b1: mkBrowser_(_.set({}, option, -5))
                        }
                    });

                    ConfigReader.prototype.read.returns(readConfig);

                    const config = Config.create({});

                    assert.throws(() => config.parse(), Error, 'Field must be positive');
                });

                it('is float number', () => {
                    const readConfig = mkConfig_({
                        browsers: {
                            b1: mkBrowser_(_.set({}, option, 15.5))
                        }
                    });

                    ConfigReader.prototype.read.returns(readConfig);

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

                ConfigReader.prototype.read.returns(readConfig);

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

                ConfigReader.prototype.read.returns(readConfig);

                const parsedConfig = Config.create({}).parse();

                assert.equal(parsedConfig.browsers.b1[option], defaults[option]);
                assert.equal(parsedConfig.browsers.b2[option], 13);
            });
        });
    });

    describe('retry', () => {
        it('should throw error if retry is not a number', () => {
            const readConfig = mkConfig_({
                browsers: {
                    b1: mkBrowser_({retry: '5'})
                }
            });

            ConfigReader.prototype.read.returns(readConfig);

            const config = Config.create({});

            assert.throws(() => config.parse(), Error, 'value must be a number');
        });

        it('should throw error if retry is negative', () => {
            const readConfig = mkConfig_({
                browsers: {
                    b1: mkBrowser_({retry: -7})
                }
            });

            ConfigReader.prototype.read.returns(readConfig);

            const config = Config.create({});

            assert.throws(() => config.parse(), Error, '"retry" should be non-negative');
        });

        it('should set retry option to all browsers', () => {
            const readConfig = mkConfig_({
                browsers: {
                    b1: mkBrowser_(),
                    b2: mkBrowser_()
                }
            });

            ConfigReader.prototype.read.returns(readConfig);

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

            ConfigReader.prototype.read.returns(readConfig);

            const parsedConfig = Config.create({}).parse();

            assert.equal(parsedConfig.browsers.b1.retry, defaults.retry);
            assert.equal(parsedConfig.browsers.b2.retry, 7);
        });
    });
});
