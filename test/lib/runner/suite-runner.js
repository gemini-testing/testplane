'use strict';

var q = require('q'),
    _ = require('lodash'),
    EventEmitter = require('events').EventEmitter,
    ProxyReporter = require('../../../lib/proxy-reporter'),
    BrowserAgent = require('../../../lib/browser-agent'),
    logger = require('../../../lib/utils').logger,
    SuiteRunner,

    proxyquire = require('proxyquire').noCallThru();

describe('Suite runner', function() {
    var sandbox = sinon.sandbox.create(),
        clearRequire,
        mocha;

    function mkSuiteStub_() {
        var suite = new EventEmitter();

        suite.enableTimeouts = sandbox.stub();
        suite.beforeAll = sandbox.stub();
        suite.afterAll = sandbox.stub();
        suite.tests = [];

        return suite;
    }

    function mkMochaStub_() {
        return {
            addFile: sandbox.stub(),
            fullTrace: sandbox.stub(),
            reporter: sandbox.stub(),
            run: sandbox.stub().yields(),

            suite: mkSuiteStub_()
        };
    }

    function mkTestStub_(opts) {
        return _.defaults(opts || {}, {
            title: 'default-title',
            parent: mkSuiteStub_()
        });
    }

    function run_(suite, filterFn) {
        return new SuiteRunner(
            {},
            new BrowserAgent()
        ).run(suite || 'test_suite', filterFn);
    }

    beforeEach(function() {
        clearRequire = sandbox.stub().named('clear-require');
        mocha = mkMochaStub_();
        SuiteRunner = proxyquire('../../../lib/runner/suite-runner', {
            'clear-require': clearRequire,
            'mocha': function() {
                return mocha;
            }
        });

        sandbox.stub(BrowserAgent.prototype);
        BrowserAgent.prototype.browserId = 'some-default-browser';

        sandbox.stub(logger);
    });

    afterEach(function() {
        sandbox.restore();
    });

    describe('run', function() {
        it('should add suite file to mocha', function() {
            return run_('path/to/suite/file')
                .then(function() {
                    assert.calledWith(mocha.addFile, 'path/to/suite/file');
                });
        });

        it('should force mocha to pass full trace on errors', function() {
            return run_()
                .then(function() {
                    assert.called(mocha.fullTrace);
                });
        });

        it('should clear require cache for test file', function() {
            return run_('path/to/test')
                .then(function() {
                    assert.calledWithMatch(clearRequire, 'path/to/test');
                });
        });

        it('should request browser before suite execution', function() {
            mocha.suite.beforeAll.yields();
            BrowserAgent.prototype.getBrowser.returns(q());

            return run_()
                .then(function() {
                    assert.calledOnce(BrowserAgent.prototype.getBrowser);
                });
        });

        it('should release browser after suite execution', function() {
            var browser = {};

            mocha.suite.beforeAll.yields();

            BrowserAgent.prototype.getBrowser.returns(q(browser));
            BrowserAgent.prototype.freeBrowser.returns(q());

            return run_()
                .then(function() {
                    var afterAll = mocha.suite.afterAll.firstCall.args[0];
                    return afterAll();
                })
                .then(function() {
                    assert.calledOnce(BrowserAgent.prototype.freeBrowser);
                    assert.calledWith(BrowserAgent.prototype.freeBrowser, browser);
                });
        });

        it('should disable mocha timeouts while setting browser hooks', function() {
            mocha.suite.enableTimeouts.onFirstCall().returns(true);

            return run_()
                .then(function() {
                    assert.callOrder(
                        mocha.suite.enableTimeouts, // get current value of enableTimeouts
                        mocha.suite.enableTimeouts.withArgs(false).named('disableTimeouts'),
                        mocha.suite.beforeAll,
                        mocha.suite.afterAll,
                        mocha.suite.enableTimeouts.withArgs(true).named('restoreTimeouts')
                    );
                });
        });

        it('should not be rejected if freeBrowser failed', function() {
            var browser = {};

            mocha.suite.beforeAll.yields();

            BrowserAgent.prototype.getBrowser.returns(q(browser));
            BrowserAgent.prototype.freeBrowser.returns(q.reject('some-error'));

            return run_()
                .then(function() {
                    var afterAll = mocha.suite.afterAll.firstCall.args[0];
                    return assert.isFulfilled(afterAll());
                })
                .then(function() {
                    assert.calledOnce(logger.warn);
                    assert.calledWithMatch(logger.warn, /some-error/);
                });
        });

        it('should set mocha reporter as proxy reporter in order to proxy events from mocha to runner', function() {
            return run_()
                .then(function() {
                    assert.calledWith(mocha.reporter, ProxyReporter);
                });
        });

        it('should pass to proxy reporter browser id', function() {
            BrowserAgent.prototype.browserId = 'browser';

            return run_()
                .then(function() {
                    assert.calledWithMatch(mocha.reporter, sinon.match.any, {
                        browserId: 'browser'
                    });
                });
        });

        it('should pass to proxy reporter getter for requested browser', function() {
            var browser = {};

            mocha.suite.beforeAll.yields();
            BrowserAgent.prototype.getBrowser.returns(q(browser));

            return run_()
                .then(function() {
                    var getBrowser = mocha.reporter.lastCall.args[1].getBrowser;
                    assert.equal(browser, getBrowser());
                });
        });

        it('should check if test should be run', function() {
            var someTest = mkTestStub_({parent: mocha.suite}),
                shouldRun = sandbox.stub().returns(true);

            mocha.suite.tests = [someTest];
            BrowserAgent.prototype.browserId = 'some-browser';

            return run_(null, shouldRun)
                .then(function() {
                    mocha.suite.emit('test', someTest);
                    assert.calledWith(shouldRun, someTest, 'some-browser');
                });
        });

        it('should not remove test which expected to be run', function() {
            var test1 = mkTestStub_({parent: mocha.suite}),
                test2 = mkTestStub_({parent: mocha.suite}),
                shouldRun = sandbox.stub().returns(true);

            mocha.suite.tests = [test1, test2];

            return run_(null, shouldRun)
                .then(function() {
                    mocha.suite.emit('test', test2);
                    assert.deepEqual(mocha.suite.tests, [test1, test2]);
                });
        });

        it('should remove test which does not suppose to be run', function() {
            var test1 = mkTestStub_({parent: mocha.suite}),
                test2 = mkTestStub_({parent: mocha.suite}),
                shouldRun = sandbox.stub().returns(false);

            mocha.suite.tests = [test1, test2];

            return run_(null, shouldRun)
                .then(function() {
                    mocha.suite.emit('test', test2);
                    assert.deepEqual(mocha.suite.tests, [test1]);
                });
        });

        it('should run mocha', function() {
            return run_()
                .then(function() {
                    assert.called(mocha.run);
                });
        });
    });
});
