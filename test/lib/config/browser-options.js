'use strict';

const _ = require('lodash');

const Config = require('lib/config');
const defaults = require('lib/config/defaults');

describe('config browser-options', () => {
    const sandbox = sinon.sandbox.create();

    const mkBrowser_ = (opts) => {
        return _.defaults(opts || {}, {
            desiredCapabilities: {}
        });
    };

    const createConfig = () => Config.create(defaults.config);

    beforeEach(() => sandbox.stub(Config, 'read'));

    afterEach(() => sandbox.restore());

    describe('desiredCapabilities', () => {
        describe('should throw error if desiredCapabilities', () => {
            it('is missing', () => {
                const readConfig = {
                    browsers: {
                        b1: {}
                    }
                };

                Config.read.returns(readConfig);

                assert.throws(() => createConfig(), Error, 'Each browser must have "desiredCapabilities" option');
            });

            it('is not an object or null', () => {
                const readConfig = {
                    browsers: {
                        b1: {
                            desiredCapabilities: 'chrome'
                        }
                    }
                };

                Config.read.returns(readConfig);

                assert.throws(() => createConfig(), Error, '"desiredCapabilities" must be an object');
            });
        });

        it('should set desiredCapabilities', () => {
            const readConfig = {
                browsers: {
                    b1: {
                        desiredCapabilities: {
                            browserName: 'yabro'
                        }
                    }
                }
            };

            Config.read.returns(readConfig);

            const config = createConfig();

            assert.deepEqual(config.browsers.b1.desiredCapabilities, {browserName: 'yabro'});
        });
    });

    describe('baseUrl', () => {
        it('should throw error if baseUrl is not a string', () => {
            const readConfig = {
                browsers: {
                    b1: mkBrowser_({baseUrl: ['Array']})
                }
            };

            Config.read.returns(readConfig);

            assert.throws(() => createConfig(), Error, '"baseUrl" must be a string');
        });

        it('should set baseUrl to all browsers', () => {
            const baseUrl = 'http://default.com';
            const readConfig = {
                baseUrl,
                browsers: {
                    b1: mkBrowser_(),
                    b2: mkBrowser_()
                }
            };

            Config.read.returns(readConfig);

            const config = createConfig();

            assert.equal(config.browsers.b1.baseUrl, baseUrl);
            assert.equal(config.browsers.b2.baseUrl, baseUrl);
        });

        it('should override baseUrl option if protocol is set', () => {
            const baseUrl = 'http://default.com';
            const readConfig = {
                baseUrl,
                browsers: {
                    b1: mkBrowser_(),
                    b2: mkBrowser_({baseUrl: 'http://foo.com'})
                }
            };

            Config.read.returns(readConfig);

            const config = createConfig();

            assert.equal(config.browsers.b1.baseUrl, baseUrl);
            assert.equal(config.browsers.b2.baseUrl, 'http://foo.com');
        });

        it('should resolve baseUrl option relative to top level baseUrl', () => {
            const baseUrl = 'http://default.com';
            const readConfig = {
                baseUrl,
                browsers: {
                    b1: mkBrowser_(),
                    b2: mkBrowser_({baseUrl: '/test'})
                }
            };

            Config.read.returns(readConfig);

            const config = createConfig();

            assert.equal(config.browsers.b1.baseUrl, baseUrl);
            assert.equal(config.browsers.b2.baseUrl, 'http://default.com/test');
        });

        it('should resolve baseUrl option relative to top level baseUrl with path', () => {
            const baseUrl = 'http://default.com/search/';
            const readConfig = {
                baseUrl,
                browsers: {
                    b1: mkBrowser_(),
                    b2: mkBrowser_({baseUrl: '/test'})
                }
            };

            Config.read.returns(readConfig);

            const config = createConfig();

            assert.equal(config.browsers.b1.baseUrl, baseUrl);
            assert.equal(config.browsers.b2.baseUrl, 'http://default.com/search/test');
        });
    });

    describe('gridUrl', () => {
        it('should throw error if gridUrl is not a string', () => {
            const readConfig = {
                browsers: {
                    b1: mkBrowser_({gridUrl: /regExp/})
                }
            };

            Config.read.returns(readConfig);

            assert.throws(() => createConfig(), Error, '"gridUrl" must be a string');
        });

        it('should set gridUrl to all browsers', () => {
            const gridUrl = 'http://default.com';
            const readConfig = {
                gridUrl,
                browsers: {
                    b1: mkBrowser_(),
                    b2: mkBrowser_()
                }
            };

            Config.read.returns(readConfig);

            const config = createConfig();

            assert.equal(config.browsers.b1.gridUrl, gridUrl);
            assert.equal(config.browsers.b2.gridUrl, gridUrl);
        });

        it('should override gridUrl option', () => {
            const gridUrl = 'http://default.com';
            const readConfig = {
                gridUrl,
                browsers: {
                    b1: mkBrowser_(),
                    b2: mkBrowser_({gridUrl: 'http://bar.com'})
                }
            };

            Config.read.returns(readConfig);

            const config = createConfig();

            assert.equal(config.browsers.b1.gridUrl, gridUrl);
            assert.equal(config.browsers.b2.gridUrl, 'http://bar.com');
        });
    });

    describe('prepareBrowser', () => {
        it('should throw error if prepareBrowser is not a null or function', () => {
            const readConfig = {
                browsers: {
                    b1: mkBrowser_({prepareBrowser: 'String'})
                }
            };

            Config.read.returns(readConfig);

            assert.throws(() => createConfig(), Error, '"prepareBrowser" must be a function');
        });

        it('should set prepareBrowser to all browsers', () => {
            const prepareBrowser = () => {};
            const readConfig = {
                prepareBrowser,
                browsers: {
                    b1: mkBrowser_(),
                    b2: mkBrowser_()
                }
            };

            Config.read.returns(readConfig);

            const config = createConfig();

            assert.equal(config.browsers.b1.prepareBrowser, prepareBrowser);
            assert.equal(config.browsers.b2.prepareBrowser, prepareBrowser);
        });

        it('should override prepareBrowser option', () => {
            const prepareBrowser = () => {};
            const newFunc = () => {};

            const readConfig = {
                prepareBrowser,
                browsers: {
                    b1: mkBrowser_(),
                    b2: mkBrowser_({prepareBrowser: newFunc})
                }
            };

            Config.read.returns(readConfig);

            const config = createConfig();

            assert.equal(config.browsers.b1.prepareBrowser, prepareBrowser);
            assert.equal(config.browsers.b2.prepareBrowser, newFunc);
        });
    });

    describe('screenshotPath', () => {
        beforeEach(() => sandbox.stub(process, 'cwd').returns('/default/path'));

        it('should throw error if screenshotPath is not a null or string', () => {
            const readConfig = {
                browsers: {
                    b1: mkBrowser_({screenshotPath: ['Array']})
                }
            };

            Config.read.returns(readConfig);

            assert.throws(() => createConfig(), Error, '"screenshotPath" must be a string');
        });

        it('should set screenshotPath option to all browsers relative to project dir', () => {
            const screenshotPath = 'default/path';
            const readConfig = {
                screenshotPath,
                browsers: {
                    b1: mkBrowser_(),
                    b2: mkBrowser_()
                }
            };

            process.cwd.returns('/project_dir');
            Config.read.returns(readConfig);

            const config = createConfig();

            assert.equal(config.browsers.b1.screenshotPath, '/project_dir/default/path');
            assert.equal(config.browsers.b2.screenshotPath, '/project_dir/default/path');
        });

        it('should override screenshotPath option relative to project dir', () => {
            const screenshotPath = 'default/path';
            const readConfig = {
                screenshotPath,
                browsers: {
                    b1: mkBrowser_(),
                    b2: mkBrowser_({screenshotPath: './screens'})
                }
            };

            process.cwd.returns('/project_dir');
            Config.read.returns(readConfig);

            const config = createConfig();

            assert.equal(config.browsers.b1.screenshotPath, '/project_dir/default/path');
            assert.equal(config.browsers.b2.screenshotPath, '/project_dir/screens');
        });
    });

    describe('screenshotsDir', () => {
        it('should set a default screenshotsDir option if it is not set in config', () => {
            const config = createConfig();

            assert.equal(config.screenshotsDir, defaults.screenshotsDir);
        });

        it('should throw an error if a value is not a string or function', () => {
            const readConfig = {
                browsers: {
                    b1: mkBrowser_({screenshotsDir: ['Array']})
                }
            };

            Config.read.returns(readConfig);

            assert.throws(() => createConfig(), Error, '"screenshotsDir" must be a string or function');
        });

        it('should does not throw if a value is a function', () => {
            const readConfig = {
                screenshotsDir: () => {},
                browsers: {
                    b1: mkBrowser_()
                }
            };

            Config.read.returns(readConfig);

            assert.doesNotThrow(createConfig);
        });

        it('should set screenshotsDir option to all browsers', () => {
            const screenshotsDir = '/some/dir';
            const readConfig = {
                screenshotsDir,
                browsers: {
                    b1: mkBrowser_(),
                    b2: mkBrowser_()
                }
            };

            Config.read.returns(readConfig);

            const config = createConfig();

            assert.equal(config.browsers.b1.screenshotsDir, '/some/dir');
            assert.equal(config.browsers.b2.screenshotsDir, '/some/dir');
        });

        it('should override screenshotsDir option per browser', () => {
            const screenshotsDir = '/some/dir';
            const readConfig = {
                screenshotsDir,
                browsers: {
                    b1: mkBrowser_(),
                    b2: mkBrowser_({screenshotsDir: '/screens'})
                }
            };

            Config.read.returns(readConfig);

            const config = createConfig();

            assert.equal(config.browsers.b1.screenshotsDir, '/some/dir');
            assert.equal(config.browsers.b2.screenshotsDir, '/screens');
        });
    });

    ['sessionsPerBrowser', 'waitTimeout'].forEach((option) => {
        describe(`${option}`, () => {
            describe(`should throw error if ${option}`, () => {
                it('is not a number', () => {
                    const readConfig = {
                        browsers: {
                            b1: mkBrowser_({[option]: '10'})
                        }
                    };

                    Config.read.returns(readConfig);

                    assert.throws(() => createConfig(), Error, `"${option}" must be a positive integer`);
                });

                it('is negative number', () => {
                    const readConfig = {
                        browsers: {
                            b1: mkBrowser_({[option]: -5})
                        }
                    };

                    Config.read.returns(readConfig);

                    assert.throws(() => createConfig(), Error, `"${option}" must be a positive integer`);
                });

                it('is float number', () => {
                    const readConfig = {
                        browsers: {
                            b1: mkBrowser_({[option]: 15.5})
                        }
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
                        b2: mkBrowser_()
                    }
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
                        b2: mkBrowser_(_.set({}, option, 13))
                    }
                };

                Config.read.returns(readConfig);

                const config = createConfig();

                assert.equal(config.browsers.b1[option], 666);
                assert.equal(config.browsers.b2[option], 13);
            });
        });
    });

    describe('testsPerSession', () => {
        describe('should throw error if "testsPerSession"', () => {
            it('is not a number', () => {
                const readConfig = {
                    browsers: {
                        b1: mkBrowser_({testsPerSession: '10'})
                    }
                };

                Config.read.returns(readConfig);

                assert.throws(() => createConfig(), Error, '"testsPerSession" must be a positive integer or Infinity');
            });

            it('is a negative number', () => {
                const readConfig = {
                    browsers: {
                        b1: mkBrowser_({testsPerSession: -5})
                    }
                };

                Config.read.returns(readConfig);

                assert.throws(() => createConfig(), Error, '"testsPerSession" must be a positive integer or Infinity');
            });

            it('is a float number', () => {
                const readConfig = {
                    browsers: {
                        b1: mkBrowser_({testsPerSession: 15.5})
                    }
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
                    b2: mkBrowser_()
                }
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
                    b2: mkBrowser_({testsPerSession: 13})
                }
            };

            Config.read.returns(readConfig);

            const config = createConfig();

            assert.equal(config.browsers.b1.testsPerSession, 666);
            assert.equal(config.browsers.b2.testsPerSession, 13);
        });
    });

    [
        'retry', 'httpTimeout', 'sessionRequestTimeout', 'sessionQuitTimeout',
        'screenshotOnRejectTimeout', 'screenshotDelay', 'pageLoadTimeout'
    ].forEach((option) => {
        describe(`${option}`, () => {
            it(`should throw error if ${option} is not a number`, () => {
                const readConfig = {
                    browsers: {
                        b1: mkBrowser_(_.set({}, option, '100500'))
                    }
                };

                Config.read.returns(readConfig);

                assert.throws(() => createConfig(), Error, `"${option}" must be a non-negative integer`);
            });

            it(`should throw error if ${option} is negative`, () => {
                const readConfig = {
                    browsers: {
                        b1: mkBrowser_(_.set({}, option, -7))
                    }
                };

                Config.read.returns(readConfig);

                assert.throws(() => createConfig(), Error, `"${option}" must be a non-negative integer`);
            });

            it(`should set ${option} option to all browsers`, () => {
                const readConfig = {
                    [option]: 100500,
                    browsers: {
                        b1: mkBrowser_(),
                        b2: mkBrowser_()
                    }
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
                        b2: mkBrowser_(_.set({}, option, 500100))
                    }
                };

                Config.read.returns(readConfig);

                const config = createConfig();

                assert.equal(config.browsers.b1[option], 100500);
                assert.equal(config.browsers.b2[option], 500100);
            });
        });
    });

    describe('meta', () => {
        it('should throw error if "meta" is not a object', () => {
            const readConfig = {
                browsers: {
                    b1: mkBrowser_({meta: 'meta-string'})
                }
            };

            Config.read.returns(readConfig);

            assert.throws(() => createConfig(), Error, '"meta" must be an object');
        });

        it('should set null by default', () => {
            const readConfig = {
                browsers: {
                    b1: mkBrowser_({})
                }
            };

            Config.read.returns(readConfig);

            const config = createConfig();

            assert.equal(config.browsers.b1.meta, null);
        });

        it('should set provided value', () => {
            const readConfig = {
                browsers: {
                    b1: mkBrowser_({meta: {k1: 'v1', k2: 'v2'}})
                }
            };

            Config.read.returns(readConfig);

            const config = createConfig();

            assert.deepEqual(config.browsers.b1.meta, {k1: 'v1', k2: 'v2'});
        });
    });

    describe('windowSize', () => {
        describe('should throw error if "windowSize" is', () => {
            it('not object, string or null', () => {
                const readConfig = {
                    browsers: {
                        b1: mkBrowser_({windowSize: 1})
                    }
                };

                Config.read.returns(readConfig);

                assert.throws(() => createConfig(), Error, '"windowSize" must be string, object or null');
            });

            it('object without "width" or "height" keys', () => {
                const readConfig = {
                    browsers: {
                        b1: mkBrowser_({windowSize: {width: 1}})
                    }
                };

                Config.read.returns(readConfig);

                assert.throws(() => createConfig(), Error, '"windowSize" must be an object with "width" and "height" keys');
            });

            it('object with "width" or "height" keys that are not numbers', () => {
                const readConfig = {
                    browsers: {
                        b1: mkBrowser_({windowSize: {width: 1, height: '2'}})
                    }
                };

                Config.read.returns(readConfig);

                assert.throws(() => createConfig(), Error, '"windowSize" must be an object with "width" and "height" keys');
            });

            it('string with wrong pattern', () => {
                const readConfig = {
                    browsers: {
                        b1: mkBrowser_({windowSize: 'some_size'})
                    }
                };

                Config.read.returns(readConfig);

                assert.throws(() => createConfig(), Error, '"windowSize" should have form of <width>x<height> (i.e. 1600x1200)');
            });
        });

        it('should be "null" by default', () => {
            const readConfig = {
                browsers: {
                    b1: mkBrowser_()
                }
            };

            Config.read.returns(readConfig);

            const config = createConfig();

            assert.equal(config.browsers.b1.windowSize, null);
        });

        it('should accept string value', () => {
            const readConfig = {
                browsers: {
                    b1: mkBrowser_({windowSize: '1x2'})
                }
            };

            Config.read.returns(readConfig);

            const config = createConfig();

            assert.deepEqual(config.browsers.b1.windowSize, {width: 1, height: 2});
        });

        it('should pass object with "width" and "height" keys as is', () => {
            const size = {width: 1, height: 2, check: true};
            const readConfig = {
                browsers: {
                    b1: mkBrowser_({windowSize: size})
                }
            };

            Config.read.returns(readConfig);

            const config = createConfig();

            assert.deepEqual(config.browsers.b1.windowSize, size);
        });

        it('should set option to all browsers', () => {
            const readConfig = {
                windowSize: '1x2',
                browsers: {
                    b1: mkBrowser_(),
                    b2: mkBrowser_()
                }
            };

            Config.read.returns(readConfig);

            const config = createConfig();

            assert.deepEqual(config.browsers.b1.windowSize, {width: 1, height: 2});
            assert.deepEqual(config.browsers.b2.windowSize, {width: 1, height: 2});
        });

        it('should override option for browser', () => {
            const readConfig = {
                windowSize: '1x2',
                browsers: {
                    b1: mkBrowser_(),
                    b2: mkBrowser_({windowSize: '5x5'})
                }
            };

            Config.read.returns(readConfig);

            const config = createConfig();

            assert.deepEqual(config.browsers.b1.windowSize, {width: 1, height: 2});
            assert.deepEqual(config.browsers.b2.windowSize, {width: 5, height: 5});
        });
    });

    ['tolerance', 'antialiasingTolerance'].forEach((option) => {
        describe(`${option}`, () => {
            describe('should throw an error', () => {
                it('if value is not number', () => {
                    const readConfig = {
                        browsers: {
                            b1: mkBrowser_({[option]: []})
                        }
                    };

                    Config.read.returns(readConfig);

                    assert.throws(() => createConfig(), Error, `"${option}" must be a number`);
                });

                it('if value is negative', () => {
                    const readConfig = {
                        browsers: {
                            b1: mkBrowser_({[option]: -1})
                        }
                    };

                    Config.read.returns(readConfig);

                    assert.throws(() => createConfig(), Error, `"${option}" must be non-negative`);
                });
            });

            it('should set a default value if it is not set in config', () => {
                const readConfig = {
                    browsers: {
                        b1: mkBrowser_()
                    }
                };

                Config.read.returns(readConfig);

                const config = createConfig();

                assert.equal(config[option], defaults[option]);
            });

            it('should does not throw if value is 0', () => {
                const readConfig = {
                    browsers: {
                        b1: mkBrowser_({[option]: 0})
                    }
                };

                Config.read.returns(readConfig);

                assert.doesNotThrow(createConfig);
            });

            it('should override option for browser', () => {
                const readConfig = {
                    [option]: 100,
                    browsers: {
                        b1: mkBrowser_(),
                        b2: mkBrowser_({[option]: 200})
                    }
                };

                Config.read.returns(readConfig);

                const config = createConfig();

                assert.deepEqual(config.browsers.b1[option], 100);
                assert.deepEqual(config.browsers.b2[option], 200);
            });
        });
    });

    describe('buildDiffOpts', () => {
        it('should throw error if "buildDiffOpts" is not a object', () => {
            const readConfig = {
                browsers: {
                    b1: mkBrowser_({buildDiffOpts: 'some-string'})
                }
            };

            Config.read.returns(readConfig);

            assert.throws(() => createConfig(), Error, '"buildDiffOpts" must be an object');
        });

        ['ignoreAntialiasing', 'ignoreCaret'].forEach((option) => {
            it(`should set "${option}" to "true" by default`, () => {
                const readConfig = {
                    browsers: {
                        b1: mkBrowser_({})
                    }
                };

                Config.read.returns(readConfig);

                const config = createConfig();

                assert.equal(config.browsers.b1.buildDiffOpts[option], true);
            });
        });

        it('should set provided value', () => {
            const readConfig = {
                browsers: {
                    b1: mkBrowser_({buildDiffOpts: {k1: 'v1', k2: 'v2'}})
                }
            };

            Config.read.returns(readConfig);

            const config = createConfig();

            assert.deepEqual(config.browsers.b1.buildDiffOpts, {k1: 'v1', k2: 'v2'});
        });
    });

    ['calibrate', 'screenshotOnReject', 'compositeImage', 'resetCursor'].forEach((option) => {
        describe(`${option}`, () => {
            it('should throw an error if value is not a boolean', () => {
                const readConfig = _.set({}, 'browsers.b1', mkBrowser_({[option]: 'foo'}));

                Config.read.returns(readConfig);

                assert.throws(() => createConfig(), Error, `"${option}" must be a boolean`);
            });

            it('should set a default value if it is not set in config', () => {
                const readConfig = _.set({}, 'browsers.b1', mkBrowser_());
                Config.read.returns(readConfig);

                const config = createConfig();

                assert.equal(config[option], defaults[option]);
            });

            it('should override option for browser', () => {
                const readConfig = {
                    [option]: false,
                    browsers: {
                        b1: mkBrowser_(),
                        b2: mkBrowser_({[option]: true})
                    }
                };

                Config.read.returns(readConfig);

                const config = createConfig();

                assert.isFalse(config.browsers.b1[option]);
                assert.isTrue(config.browsers.b2[option]);
            });
        });
    });

    describe('screenshotMode', () => {
        it('should throw an error if option is not a string', () => {
            const readConfig = {
                browsers: {
                    b1: mkBrowser_({screenshotMode: {not: 'string'}})
                }
            };

            Config.read.returns(readConfig);

            assert.throws(() => createConfig(), Error, /"screenshotMode" must be a string/);
        });

        it('should throw an error if option value is not "fullpage", "viewport" or "auto"', () => {
            const readConfig = {
                browsers: {
                    b1: mkBrowser_({screenshotMode: 'foo bar'})
                }
            };

            Config.read.returns(readConfig);

            assert.throws(() => createConfig(), Error, /"screenshotMode" must be "fullpage", "viewport" or "auto"/);
        });

        describe('should not throw an error if option value is', () => {
            ['fullpage', 'viewport', 'auto'].forEach((value) => {
                it(`${value}`, () => {
                    const readConfig = {
                        browsers: {
                            b1: mkBrowser_({screenshotMode: value})
                        }
                    };

                    Config.read.returns(readConfig);

                    assert.doesNotThrow(() => createConfig());
                });
            });
        });

        it('should set a default value if it is not set in config', () => {
            const readConfig = {
                browsers: {
                    b1: mkBrowser_()
                }
            };

            Config.read.returns(readConfig);

            const config = createConfig();

            assert.equal(config.screenshotMode, defaults.screenshotMode);
        });

        it('should override option for browser', () => {
            const readConfig = {
                screenshotMode: 'fullpage',
                browsers: {
                    b1: mkBrowser_(),
                    b2: mkBrowser_({screenshotMode: 'viewport'})
                }
            };

            Config.read.returns(readConfig);

            const config = createConfig();

            assert.equal(config.browsers.b1.screenshotMode, 'fullpage');
            assert.equal(config.browsers.b2.screenshotMode, 'viewport');
        });
    });

    describe('orientation', () => {
        it('should throw an error if option value is not string', () => {
            const readConfig = {
                browsers: {
                    b1: mkBrowser_({orientation: {not: 'string'}})
                }
            };

            Config.read.returns(readConfig);

            assert.throws(() => createConfig(), Error, /"orientation" must be a string/);
        });

        it('should throw an error if option value is not "landscape" or "portrait"', () => {
            const readConfig = {
                browsers: {
                    b1: mkBrowser_({orientation: 'foo bar'})
                }
            };

            Config.read.returns(readConfig);

            assert.throws(() => createConfig(), Error, /"orientation" must be "landscape" or "portrait"/);
        });

        describe('should not throw an error if option value is', () => {
            ['landscape', 'portrait'].forEach((value) => {
                it(`${value}`, () => {
                    const readConfig = {
                        browsers: {
                            b1: mkBrowser_({orientation: value})
                        }
                    };

                    Config.read.returns(readConfig);

                    assert.doesNotThrow(() => createConfig());
                });
            });
        });

        it('should set a default value if it is not set in config', () => {
            const readConfig = {
                browsers: {
                    b1: mkBrowser_()
                }
            };

            Config.read.returns(readConfig);

            const config = createConfig();

            assert.equal(config.orientation, defaults.orientation);
        });

        it('should override option for browser', () => {
            const readConfig = {
                orientation: 'landscape',
                browsers: {
                    b1: mkBrowser_(),
                    b2: mkBrowser_({orientation: 'portrait'})
                }
            };

            Config.read.returns(readConfig);

            const config = createConfig();

            assert.equal(config.browsers.b1.orientation, 'landscape');
            assert.equal(config.browsers.b2.orientation, 'portrait');
        });
    });
});
