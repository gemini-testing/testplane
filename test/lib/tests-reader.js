'use strict';

var globExtra = require('glob-extra'),
    readTests = require('../../lib/tests-reader'),
    logger = require('../../lib/utils').logger,
    makeConfigStub = require('../utils').makeConfigStub,
    _ = require('lodash'),
    q = require('q');

describe('tests-reader', function() {
    var sandbox = sinon.sandbox.create();

    beforeEach(function() {
        sandbox.stub(globExtra, 'expandPaths');
        sandbox.stub(logger, 'warn');

        globExtra.expandPaths.returns(q([]));
    });

    afterEach(function() {
        sandbox.restore();
    });

    function readTests_(opts) {
        opts = _.defaultsDeep(opts || {}, {
            testPaths: [],
            browsers: [],
            config: {
                specs: ['default-spec']
            }
        });

        return readTests(opts.testPaths, opts.browsers, makeConfigStub(opts.config));
    }

    it('should throw in case of invalid specs declaration', function() {
        return assert.throws(function() {
            readTests_({config: {specs: [12345]}});
        }, /array of strings or\/and plain objects/);
    });

    it('should assign specified browsers to specified test files in specs', function() {
        globExtra.expandPaths
            .withArgs(['test1']).returns(q(['/test1']))
            .withArgs(['dir']).returns(q(['/dir/test2', '/dir/test3']));

        var params = {
            config: {
                specs: [
                    {files: ['test1'], browsers: ['browser1']},
                    {files: ['dir'], browsers: ['browser2']}
                ],
                browsers: ['browser1', 'browser2']
            }
        };

        return assert.becomes(readTests_(params), {
            browser1: ['/test1'],
            browser2: ['/dir/test2', '/dir/test3']
        });
    });

    it('should support intersection of test paths in specs', function() {
        globExtra.expandPaths
            .withArgs(['dir', 'dir1']).returns(q(['/dir/test', '/dir1/test']))
            .withArgs(['dir', 'dir2']).returns(q(['/dir/test', '/dir2/test']));

        var params = {
            config: {
                specs: [
                    {files: ['dir', 'dir1'], browsers: ['browser1']},
                    {files: ['dir', 'dir2'], browsers: ['browser2']}
                ],
                browsers: ['browser1', 'browser2']
            }
        };

        return assert.becomes(readTests_(params), {
            browser1: ['/dir/test', '/dir1/test'],
            browser2: ['/dir/test', '/dir2/test']
        });
    });

    it('should support intersection of subpaths in specs', function() {
        globExtra.expandPaths
            .withArgs(['dir']).returns(q(['/dir/sub-dir/test']))
            .withArgs(['dir/sub-dir']).returns(q(['/dir/sub-dir/test']));

        var params = {
            config: {
                specs: [
                    {files: ['dir'], browsers: ['browser1']},
                    {files: ['dir/sub-dir'], browsers: ['browser2']}
                ],
                browsers: ['browser1', 'browser2']
            }
        };

        return assert.becomes(readTests_(params), {
            browser1: ['/dir/sub-dir/test'],
            browser2: ['/dir/sub-dir/test']
        });
    });

    it('should support intersection of browsers in specs', function() {
        globExtra.expandPaths
            .withArgs(['test1']).returns(q(['/test1']))
            .withArgs(['test2']).returns(q(['/test2']));

        var params = {
            config: {
                specs: [
                    {files: ['test1'], browsers: ['browser', 'browser1']},
                    {files: ['test2'], browsers: ['browser', 'browser2']}
                ],
                browsers: ['browser', 'browser1', 'browser2']
            }
        };

        return assert.becomes(readTests_(params), {
            browser: ['/test1', '/test2'],
            browser1: ['/test1'],
            browser2: ['/test2']
        });
    });

    it('should assign all browsers to test files which are specified as strings in specs', function() {
        globExtra.expandPaths
            .withArgs(['test1']).returns(q(['/test1']))
            .withArgs(['test2']).returns(q(['/test2']));

        var params = {
            config: {
                specs: ['test1', 'test2'],
                browsers: ['browser1', 'browser2']
            }
        };

        return assert.becomes(readTests_(params), {
            browser1: ['/test1', '/test2'],
            browser2: ['/test1', '/test2']
        });
    });

    it('should assign all browsers to test files which are specified as objects without `browsers` property', function() {
        globExtra.expandPaths
            .withArgs(['test1']).returns(q(['/test1']))
            .withArgs(['test2']).returns(q(['/test2']));

        var params = {
            config: {
                specs: [{files: ['test1']}, {files: ['test2']}],
                browsers: ['browser1', 'browser2']
            }
        };

        return assert.becomes(readTests_(params), {
            browser1: ['/test1', '/test2'],
            browser2: ['/test1', '/test2']
        });
    });

    it('should support string and object notations in specs', function() {
        globExtra.expandPaths
            .withArgs(['test1']).returns(q(['/test1']))
            .withArgs(['test2']).returns(q(['/test2']));

        var params = {
            config: {
                specs: ['test1', {files: ['test2']}],
                browsers: ['browser1', 'browser2']
            }
        };

        return assert.becomes(readTests_(params), {
            browser1: ['/test1', '/test2'],
            browser2: ['/test1', '/test2']
        });
    });

    it('should not assign unknown browsers to test files', function() {
        globExtra.expandPaths.withArgs(['test']).returns(q(['/test']));

        var params = {
            config: {
                specs: [{files: ['test'], browsers: ['unknown-browser']}],
                browsers: ['browser']
            }
        };

        return assert.becomes(readTests_(params), {});
    });

    it('should log warning in case of unknown browsers in specs', function() {
        var params = {
            config: {
                specs: [{browsers: 'unknown-browser'}],
                browsers: ['browser']
            }
        };

        return readTests_(params)
            .then(function() {
                assert.calledWithMatch(logger.warn, /ids: unknown-browser.+browser/);
            });
    });

    it('should filter browsers from specs in case of input browsers', function() {
        globExtra.expandPaths.withArgs(['test']).returns(q(['/test']));

        var params = {
            config: {
                specs: ['test'],
                browsers: ['browser1', 'browser2']
            },
            browsers: ['browser1']
        };

        return assert.becomes(readTests_(params), {browser1: ['/test']});
    });

    it('should not assign unknown input browsers to test files', function() {
        globExtra.expandPaths.withArgs(['test']).returns(q(['/test']));

        var params = {
            config: {
                specs: ['test'],
                browsers: ['browser']
            },
            browsers: ['unknown-browser']
        };

        return assert.becomes(readTests_(params), {});
    });

    it('should log warning in case of unknown input browsers', function() {
        var params = {
            config: {
                browsers: ['browser']
            },
            browsers: ['unknown-browser']
        };

        return readTests_(params)
            .then(function() {
                assert.calledWithMatch(logger.warn, /ids: unknown-browser.+browser/);
            });
    });

    it('should filter test files from specs in case of input test paths', function() {
        globExtra.expandPaths
            .withArgs(['test1']).returns(q(['/test1']))
            .withArgs(['test2']).returns(q(['/test2']));

        var params = {
            config: {
                specs: ['test1', 'test2'],
                browsers: ['browser']
            },
            testPaths: ['test1']
        };

        return assert.becomes(readTests_(params), {browser: ['/test1']});
    });

    it('should not assign browsers to unknown input test paths', function() {
        globExtra.expandPaths
            .withArgs(['test']).returns(q(['/test']))
            .withArgs(['unknown-test']).returns(q(['/unknown-test']));

        var params = {
            config: {
                specs: ['test'],
                browsers: ['browser']
            },
            testPaths: ['unknown-test']
        };

        return assert.becomes(readTests_(params), {});
    });
});
