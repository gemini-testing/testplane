'use strict';

const _ = require('lodash');

const Config = require('../../../lib/config');
const defaults = require('../../../lib/config/defaults');

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
        beforeEach(() => sandbox.stub(process, 'cwd'));

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

    ['retry', 'httpTimeout', 'sessionRequestTimeout', 'sessionQuitTimeout'].forEach((option) => {
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
});
