'use strict';

var q = require('q'),
    _ = require('lodash'),
    EventEmitter = require('events').EventEmitter,
    BrowserAgent = require('../../../../lib/browser-agent'),
    logger = require('../../../../lib/utils').logger,
    MochaAdapter = require('../../../../lib/runner/mocha-runner/mocha-adapter'),
    ProxyReporter = require('../../../../lib/runner/mocha-runner/proxy-reporter'),
    MochaRunner = require('../../../../lib/runner/mocha-runner');

describe('mocha-runner', function() {
    var sandbox = sinon.sandbox.create();

    function mkSuiteStub_() {
        var suite = new EventEmitter();

        suite.enableTimeouts = sandbox.stub();
        suite.beforeAll = sandbox.stub();
        suite.afterAll = sandbox.stub();
        suite.tests = [];

        return suite;
    }

    function run_(suites, filterFn) {
        return new MochaRunner(
            {},
            new BrowserAgent()
        ).run(suites || ['test_suite'], filterFn);
    }

    beforeEach(function() {
        sandbox.stub(MochaAdapter.prototype);
        MochaAdapter.prototype.suite = mkSuiteStub_();

        sandbox.stub(BrowserAgent.prototype);
        BrowserAgent.prototype.browserId = 'some-default-browser';

        sandbox.stub(logger);
    });

    afterEach(function() {
        sandbox.restore();
    });

    describe('run', function() {
        it('should create mocha instance for each file', function() {
            return run_(['path/to/file', 'path/to/other/file'])
                .then(function() {
                    assert.calledTwice(MochaAdapter.prototype.__constructor);
                    assert.calledWith(MochaAdapter.prototype.addFile, 'path/to/file');
                    assert.calledWith(MochaAdapter.prototype.addFile, 'path/to/other/file');

                    var mochaInstances = MochaAdapter.prototype.addFile.thisValues;
                    assert.notEqual(mochaInstances[0], mochaInstances[1]);
                });
        });

        it('should request browser before suite execution', function() {
            MochaAdapter.prototype.suite.beforeAll.yields();
            BrowserAgent.prototype.getBrowser.returns(q());

            return run_()
                .then(function() {
                    assert.calledOnce(BrowserAgent.prototype.getBrowser);
                });
        });

        it('should release browser after suite execution', function() {
            var browser = {};

            MochaAdapter.prototype.suite.beforeAll.yields();

            BrowserAgent.prototype.getBrowser.returns(q(browser));
            BrowserAgent.prototype.freeBrowser.returns(q());

            return run_()
                .then(function() {
                    var afterAll = MochaAdapter.prototype.suite.afterAll.firstCall.args[0];
                    return afterAll();
                })
                .then(function() {
                    assert.calledOnce(BrowserAgent.prototype.freeBrowser);
                    assert.calledWith(BrowserAgent.prototype.freeBrowser, browser);
                });
        });

        it('should disable mocha timeouts while setting browser hooks', function() {
            MochaAdapter.prototype.suite.enableTimeouts.onFirstCall().returns(true);

            return run_()
                .then(function() {
                    assert.callOrder(
                        MochaAdapter.prototype.suite.enableTimeouts, // get current value of enableTimeouts
                        MochaAdapter.prototype.suite.enableTimeouts.withArgs(false).named('disableTimeouts'),
                        MochaAdapter.prototype.suite.beforeAll,
                        MochaAdapter.prototype.suite.afterAll,
                        MochaAdapter.prototype.suite.enableTimeouts.withArgs(true).named('restoreTimeouts')
                    );
                });
        });

        it('should not be rejected if freeBrowser failed', function() {
            var browser = {};

            MochaAdapter.prototype.suite.beforeAll.yields();

            BrowserAgent.prototype.getBrowser.returns(q(browser));
            BrowserAgent.prototype.freeBrowser.returns(q.reject('some-error'));

            return run_()
                .then(function() {
                    var afterAll = MochaAdapter.prototype.suite.afterAll.firstCall.args[0];
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
                    assert.calledWith(MochaAdapter.prototype.reporter, ProxyReporter);
                });
        });

        it('should pass to proxy reporter browser id', function() {
            BrowserAgent.prototype.browserId = 'browser';

            return run_()
                .then(function() {
                    assert.calledWithMatch(MochaAdapter.prototype.reporter, sinon.match.any, {
                        browserId: 'browser'
                    });
                });
        });

        it('should pass to proxy reporter getter for requested browser', function() {
            var browser = {};

            MochaAdapter.prototype.suite.beforeAll.yields();
            BrowserAgent.prototype.getBrowser.returns(q(browser));

            return run_()
                .then(function() {
                    var getBrowser = MochaAdapter.prototype.reporter.lastCall.args[1].getBrowser;
                    assert.equal(browser, getBrowser());
                });
        });

        describe('filterFn', function() {
            function mkTestStub_(opts) {
                return _.defaults(opts || {}, {
                    title: 'default-title',
                    parent: MochaAdapter.prototype.suite
                });
            }

            it('should check if test should be run', function() {
                var someTest = mkTestStub_(),
                    shouldRun = sandbox.stub().returns(true);

                MochaAdapter.prototype.suite.tests = [someTest];
                BrowserAgent.prototype.browserId = 'some-browser';

                return run_(null, shouldRun)
                    .then(function() {
                        MochaAdapter.prototype.suite.emit('test', someTest);
                        assert.calledWith(shouldRun, someTest, 'some-browser');
                    });
            });

            it('should not remove test which expected to be run', function() {
                var test1 = mkTestStub_(),
                    test2 = mkTestStub_(),
                    shouldRun = sandbox.stub().returns(true);

                MochaAdapter.prototype.suite.tests = [test1, test2];

                return run_(null, shouldRun)
                    .then(function() {
                        MochaAdapter.prototype.suite.emit('test', test2);
                        assert.deepEqual(MochaAdapter.prototype.suite.tests, [test1, test2]);
                    });
            });

            it('should remove test which does not suppose to be run', function() {
                var test1 = mkTestStub_(),
                    test2 = mkTestStub_(),
                    shouldRun = sandbox.stub().returns(false);

                MochaAdapter.prototype.suite.tests = [test1, test2];

                return run_(null, shouldRun)
                    .then(function() {
                        MochaAdapter.prototype.suite.emit('test', test2);
                        assert.deepEqual(MochaAdapter.prototype.suite.tests, [test1]);
                    });
            });
        });

        it('should run all mocha instances', function() {
            return run_(['some/file', 'other/file'])
                .then(function() {
                    assert.calledTwice(MochaAdapter.prototype.run);
                });
        });

        it('should wait until all mocha instances will finish their work', function() {
            var firstResolveMarker = sandbox.stub().named('First resolve marker'),
                secondResolveMarker = sandbox.stub().named('Second resolve marker');

            MochaAdapter.prototype.run.onFirstCall().returns(q().then(firstResolveMarker));
            MochaAdapter.prototype.run.onSecondCall().returns(q.delay(1).then(secondResolveMarker));

            return run_(['path/to/suite', 'path/to/another/suite'])
                .then(function() {
                    assert.called(firstResolveMarker);
                    assert.called(secondResolveMarker);
                });
        });

        it('should be rejected if one of mocha instances rejected on run', function() {
            MochaAdapter.prototype.run.returns(q.reject('Error'));

            return assert.isRejected(run_(), /Error/);
        });
    });
});
