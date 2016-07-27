'use strict';

var q = require('q'),
    _ = require('lodash'),
    EventEmitter = require('events').EventEmitter,
    Runner = require('../../../lib/runner'),
    MochaRunner = require('../../../lib/runner/mocha-runner'),
    BrowserPool = require('../../../lib/browser-pool'),
    BrowserAgent = require('../../../lib/browser-agent'),
    RetryManager = require('../../../lib/retry-manager'),

    makeConfigStub = require('../../utils').makeConfigStub,

    RunnerEvents = require('../../../lib/constants/runner-events');

describe('Runner', function() {
    var sandbox = sinon.sandbox.create();

    function run_(opts) {
        opts = _.defaults(opts || {}, {
            browsers: ['default-browser'],
            files: ['default-file']
        });

        var tests = _.zipObject(opts.browsers, _.fill(Array(opts.browsers.length), opts.files)),
            runner = opts.runner || new Runner(makeConfigStub({browsers: opts.browsers}));

        return runner.run(tests);
    }

    beforeEach(function() {
        sandbox.stub(BrowserPool.prototype);

        sandbox.stub(MochaRunner.prototype);
        MochaRunner.prototype.run.returns(q());

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

            assert.calledWith(BrowserPool.prototype.__constructor, config);
        });

        it('should create retryManager with passed config', function() {
            var config = makeConfigStub();

            new Runner(config);

            assert.calledOnce(RetryManager.prototype.__constructor);
            assert.calledWith(RetryManager.prototype.__constructor, config);
        });
    });

    describe('run', function() {
        describe('RUNNER_START event', function() {
            it('should start mocha runner only after RUNNER_START handler finish', function() {
                var mediator = sinon.spy().named('mediator'),
                    onRunnerStart = sinon.stub().named('onRunnerStart').returns(q.delay(1).then(mediator)),
                    runner = new Runner(makeConfigStub());

                runner.on(RunnerEvents.RUNNER_START, onRunnerStart);

                return run_({runner: runner})
                    .then(function() {
                        assert.callOrder(mediator, MochaRunner.prototype.run);
                    });
            });

            it('should not run any mocha runner if RUNNER_START handler failed', function() {
                var onRunnerStart = sinon.stub().named('onRunnerStart').returns(q.reject('some-error')),
                    runner = new Runner(makeConfigStub());

                runner.on(RunnerEvents.RUNNER_START, onRunnerStart);

                return assert.isRejected(run_({runner: runner}), /some-error/)
                    .then(function() {
                        assert.notCalled(MochaRunner.prototype.run);
                    });
            });
        });

        it('should create mocha runners with apporpriate browser agents', function() {
            return run_({browsers: ['browser1', 'browser2']})
                .then(function() {
                    assert.calledTwice(MochaRunner.prototype.__constructor);
                    assert.calledWith(MochaRunner.prototype.__constructor,
                        sinon.match.any,
                        sinon.match.instanceOf(BrowserAgent).and(sinon.match.has('browserId', 'browser1'))
                    );
                    assert.calledWith(MochaRunner.prototype.__constructor,
                        sinon.match.any,
                        sinon.match.instanceOf(BrowserAgent).and(sinon.match.has('browserId', 'browser2'))
                    );
                });
        });

        it('should run mocha runner with passed tests and filter function', function() {
            return run_({files: ['test1', 'test2']})
                .then(function() {
                    assert.calledWith(MochaRunner.prototype.run, ['test1', 'test2'], sinon.match.func);
                });
        });

        it('should not filter out any test by default', function() {
            return run_()
                .then(function() {
                    var filterFn = MochaRunner.prototype.run.firstCall.args[1];
                    assert.isTrue(filterFn());
                });
        });

        it('should wait until all mocha runners will finish', function() {
            var firstResolveMarker = sandbox.stub().named('First resolve marker'),
                secondResolveMarker = sandbox.stub().named('Second resolve marker');

            MochaRunner.prototype.run.onFirstCall().returns(q().then(firstResolveMarker));
            MochaRunner.prototype.run.onSecondCall().returns(q.delay(1).then(secondResolveMarker));

            return run_({browsers: ['browser1', 'browser2']})
                .then(function() {
                    assert.called(firstResolveMarker);
                    assert.called(secondResolveMarker);
                });
        });

        describe('if one of mocha runners failed', function() {
            var mochaRunner;

            beforeEach(function() {
                mochaRunner = new EventEmitter();
                mochaRunner.run = sandbox.stub().returns(q());
                MochaRunner.prototype.__constructor.returns(mochaRunner);

                var runner = new Runner(makeConfigStub());
                return run_({runner: runner});
            });

            it('should submit failed tests for retry', function() {
                mochaRunner.emit(RunnerEvents.TEST_FAIL, 'some-error');

                assert.calledOnce(RetryManager.prototype.handleTestFail);
                assert.calledWith(RetryManager.prototype.handleTestFail, 'some-error');
            });

            it('should submit errors for retry', function() {
                mochaRunner.emit(RunnerEvents.ERROR, 'some-error', 'some-data');

                assert.calledOnce(RetryManager.prototype.handleError);
                assert.calledWith(RetryManager.prototype.handleError, 'some-error', 'some-data');
            });
        });

        it('should passthrough events from mocha runners', function() {
            var mochaRunner = new EventEmitter();

            mochaRunner.run = sandbox.stub().returns(q());
            MochaRunner.prototype.__constructor.returns(mochaRunner);

            var runner = new Runner(makeConfigStub()),
                onTestPass = sandbox.spy().named('onTestPass');

            runner.on(RunnerEvents.TEST_PASS, onTestPass);
            return run_({runner: runner})
                .then(function() {
                    mochaRunner.emit(RunnerEvents.TEST_PASS);

                    assert.called(onTestPass);
                });
        });

        it('should start retry session after all', function() {
            return run_()
                .then(function() {
                    assert.calledOnce(RetryManager.prototype.retry);
                    assert.calledWith(RetryManager.prototype.retry, sinon.match.func);
                });
        });

        describe('retry manager events', function() {
            var retryMgr, runner;

            beforeEach(function() {
                retryMgr = new EventEmitter();
                retryMgr.submitForRetry = sinon.stub();
                RetryManager.prototype.__constructor.returns(retryMgr);

                runner = new Runner(makeConfigStub());
            });

            it('should passthrough error event', function() {
                var onError = sandbox.spy().named('onError');

                runner.on(RunnerEvents.ERROR, onError);
                retryMgr.emit(RunnerEvents.ERROR);

                assert.called(onError);
            });

            it('should passthrough retry event', function() {
                var onRetry = sandbox.spy().named('onRetry');

                runner.on(RunnerEvents.RETRY, onRetry);
                retryMgr.emit(RunnerEvents.RETRY);

                assert.called(onRetry);
            });

            it('should passthrough test failed event', function() {
                var onTestFail = sandbox.spy().named('onTestFail');

                runner.on(RunnerEvents.TEST_FAIL, onTestFail);
                retryMgr.emit(RunnerEvents.TEST_FAIL);

                assert.called(onTestFail);
            });
        });

        describe('RUNNER_END event', function() {
            it('should be emitted after mocha runners finish', function() {
                var onRunnerEnd = sinon.spy().named('onRunnerEnd'),
                    runner = new Runner(makeConfigStub());

                runner.on(RunnerEvents.RUNNER_END, onRunnerEnd);

                return run_({runner: runner})
                    .then(function() {
                        assert.callOrder(MochaRunner.prototype.run, onRunnerEnd);
                    });
            });

            it('runner should wait until RUNNER_END handler finished', function() {
                var finMarker = sinon.spy().named('finMarker'),
                    onRunnerEnd = sinon.stub().named('onRunnerEnd').returns(q.delay(1).then(finMarker)),
                    runner = new Runner(makeConfigStub());

                runner.on(RunnerEvents.RUNNER_END, onRunnerEnd);

                return run_({runner: runner})
                    .then(function() {
                        assert.calledOnce(finMarker);
                    });
            });

            it('shold be emitted even if RUNNER_START handler failed', function() {
                var onRunnerStart = sinon.stub().named('onRunnerStart').returns(q.reject()),
                    onRunnerEnd = sinon.spy().named('onRunnerEnd'),
                    runner = new Runner(makeConfigStub());

                runner.on(RunnerEvents.RUNNER_START, onRunnerStart);
                runner.on(RunnerEvents.RUNNER_END, onRunnerEnd);

                return assert.isRejected(run_({runner: runner}))
                    .then(function() {
                        assert.calledOnce(onRunnerEnd);
                    });
            });

            it('shold be emitted even if some mocha runner failed', function() {
                var onRunnerEnd = sinon.spy().named('onRunnerEnd'),
                    runner = new Runner(makeConfigStub());

                runner.on(RunnerEvents.RUNNER_END, onRunnerEnd);
                MochaRunner.prototype.run.returns(q.reject());

                return assert.isRejected(run_({runner: runner}))
                    .then(function() {
                        assert.calledOnce(onRunnerEnd);
                    });
            });

            it('should leave original error unchaned if RUNNER_END handler failed too', function() {
                var onRunnerEnd = sinon.stub().named('onRunnerEnd').returns(q.reject('handler-error')),
                    runner = new Runner(makeConfigStub());

                runner.on(RunnerEvents.RUNNER_END, onRunnerEnd);
                MochaRunner.prototype.run.returns(q.reject('run-error'));

                return assert.isRejected(run_({runner: runner}), /run-error/);
            });
        });
    });
});
