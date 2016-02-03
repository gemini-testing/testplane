'use strict';

var q = require('q'),
    _ = require('lodash'),
    EventEmitter = require('events').EventEmitter,
    Runner = require('../../../lib/runner/index'),
    BrowserRunner = require('../../../lib/runner/browser-runner'),
    BrowserPool = require('../../../lib/browser-pool'),
    RetryManager = require('../../../lib/retry-manager'),

    makeConfigStub = require('../../utils').makeConfigStub,

    RunnerEvents = require('../../../lib/constants/runner-events');

describe('Runner', function() {
    var sandbox = sinon.sandbox.create();

    function run_(opts) {
        opts = _.defaults(opts || {}, {
            browsers: ['default-browser'],
            tests: []
        });

        var runner = opts.runner || new Runner(makeConfigStub({browsers: opts.browsers}));
        return runner.run(opts.tests, opts.browsers);
    }

    beforeEach(function() {
        sandbox.stub(BrowserPool.prototype);

        sandbox.stub(BrowserRunner.prototype);
        BrowserRunner.prototype.run.returns(q());

        sandbox.stub(RetryManager.prototype);
    });

    afterEach(function() {
        sandbox.restore();
    });

    describe('constructor', function() {
        /*jshint nonew: false */
        it('should create browser pool', function() {
            var config = makeConfigStub();

            new Runner(config);

            assert.called(BrowserPool.prototype.__constructor, config);
        });

        it('should create retryManager with passed config', function() {
            var config = makeConfigStub();

            new Runner(config);

            assert.calledOnce(RetryManager.prototype.__constructor);
            assert.calledWith(RetryManager.prototype.__constructor, config);
        });
    });

    describe('run', function() {
        it('should create browser runner for each passed browser', function() {
            return run_({browsers: ['browser1', 'browser2']})
                .then(function() {
                    assert.calledTwice(BrowserRunner.prototype.__constructor);
                    assert.calledWith(BrowserRunner.prototype.__constructor, sinon.match.any, 'browser1');
                    assert.calledWith(BrowserRunner.prototype.__constructor, sinon.match.any, 'browser2');
                });
        });

        it('should emit `RunnerEvents.RUNNER_START` event', function() {
            var onStartRunner = sandbox.spy().named('onStartRunner'),
                runner = new Runner(makeConfigStub());

            runner.on(RunnerEvents.RUNNER_START, onStartRunner);

            return runner.run()
                .then(function() {
                    assert.called(onStartRunner);
                });
        });

        it('should emit `RunnerEvents.RUNNER_END` event', function() {
            var onEndRunner = sandbox.spy().named('onEndRunner'),
                runner = new Runner(makeConfigStub());

            runner.on(RunnerEvents.RUNNER_END, onEndRunner);

            return runner.run()
                .then(function() {
                    assert.called(onEndRunner);
                });
        });

        it('should emit events in correct order', function() {
            var onStartRunner = sandbox.spy().named('onStartRunner'),
                onEndRunner = sandbox.spy().named('onEndRunner'),
                runner = new Runner(makeConfigStub());

            runner.on(RunnerEvents.RUNNER_START, onStartRunner);
            runner.on(RunnerEvents.RUNNER_END, onEndRunner);

            return runner.run()
                .then(function() {
                    assert.callOrder(onStartRunner, onEndRunner);
                });
        });

        it('should run all browser runners', function() {
            return run_({browsers: ['browser1', 'browser2']})
                .then(function() {
                    assert.calledTwice(BrowserRunner.prototype.run);
                });
        });

        it('should run browser runner with passed tests and filter function', function() {
            return run_({tests: ['test1', 'test2']})
                .then(function() {
                    assert.calledWith(BrowserRunner.prototype.run, ['test1', 'test2'], sinon.match.func);
                });
        });

        it('should not filter out any test by default', function() {
            return run_()
                .then(function() {
                    var filterFn = BrowserRunner.prototype.run.firstCall.args[1];
                    assert.isTrue(filterFn());
                });
        });

        it('should wait until all browser runners will finish', function() {
            var firstResolveMarker = sandbox.stub().named('First resolve marker'),
                secondResolveMarker = sandbox.stub().named('Second resolve marker');

            BrowserRunner.prototype.run.onFirstCall().returns(q().then(firstResolveMarker));
            BrowserRunner.prototype.run.onSecondCall().returns(q.delay(1).then(secondResolveMarker));

            return run_({browsers: ['browser1', 'browser2']})
                .then(function() {
                    assert.called(firstResolveMarker);
                    assert.called(secondResolveMarker);
                });
        });

        describe('if one of browser runners failed', function() {
            var browserRunner;

            beforeEach(function() {
                browserRunner = new EventEmitter();
                browserRunner.run = sandbox.stub().returns(q());
                BrowserRunner.prototype.__constructor.returns(browserRunner);

                var runner = new Runner(makeConfigStub());
                run_({runner: runner});
            });

            it('should submit failed tests for retry', function() {
                browserRunner.emit(RunnerEvents.TEST_FAIL, 'some-error');

                assert.calledOnce(RetryManager.prototype.handleTestFail);
                assert.calledWith(RetryManager.prototype.handleTestFail, 'some-error');
            });

            it('should submit errors for retry', function() {
                browserRunner.emit(RunnerEvents.ERROR, 'some-error', 'some-data');

                assert.calledOnce(RetryManager.prototype.handleError);
                assert.calledWith(RetryManager.prototype.handleError, 'some-error', 'some-data');
            });
        });
    });

    it('should passthrough events from browser runners', function() {
        var browserRunner = new EventEmitter();

        browserRunner.run = sandbox.stub().returns(q());
        BrowserRunner.prototype.__constructor.returns(browserRunner);

        var runner = new Runner(makeConfigStub()),
            onTestPass = sandbox.spy().named('onTestPass');

        runner.on(RunnerEvents.TEST_PASS, onTestPass);
        run_({runner: runner});
        browserRunner.emit(RunnerEvents.TEST_PASS);

        assert.called(onTestPass);
    });

    it('should start retry session after all', function() {
        return run_()
            .then(function() {
                assert.calledOnce(RetryManager.prototype.retry);
                assert.calledWith(RetryManager.prototype.retry, sinon.match.func);
            });
    });

    describe('retry manager events', function() {
        var browserRunner, runner;

        beforeEach(function() {
            browserRunner = new EventEmitter();
            browserRunner.submitForRetry = sinon.stub();
            RetryManager.prototype.__constructor.returns(browserRunner);

            runner = new Runner(makeConfigStub());
        });

        it('should passthrough error event', function() {
            var onError = sandbox.spy().named('onError');

            runner.on(RunnerEvents.ERROR, onError);
            browserRunner.emit(RunnerEvents.ERROR);

            assert.called(onError);
        });

        it('should passthrough retry event', function() {
            var onRetry = sandbox.spy().named('onRetry');

            runner.on(RunnerEvents.RETRY, onRetry);
            browserRunner.emit(RunnerEvents.RETRY);

            assert.called(onRetry);
        });

        it('should passthrough test failed event', function() {
            var onTestFail = sandbox.spy().named('onTestFail');

            runner.on(RunnerEvents.TEST_FAIL, onTestFail);
            browserRunner.emit(RunnerEvents.TEST_FAIL);

            assert.called(onTestFail);
        });
    });
});
