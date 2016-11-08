'use strict';

const q = require('q');
const _ = require('lodash');
const EventEmitter = require('events').EventEmitter;

const BrowserAgent = require('../../../lib/browser-agent');
const BrowserPool = require('../../../lib/browser-pool');
const MochaRunner = require('../../../lib/runner/mocha-runner');
const Runner = require('../../../lib/runner');
const TestSkipper = require('../../../lib/runner/test-skipper');
const RetryManager = require('../../../lib/retry-manager');
const RunnerEvents = require('../../../lib/constants/runner-events');

const makeConfigStub = require('../../utils').makeConfigStub;

describe('Runner', () => {
    const sandbox = sinon.sandbox.create();

    const mkMochaRunner = () => {
        sandbox.stub(MochaRunner, 'create');

        const mochaRunner = new EventEmitter();
        mochaRunner.run = sandbox.stub().returns(q());

        MochaRunner.create.returns(mochaRunner);

        return mochaRunner;
    };

    const run_ = (opts) => {
        opts = _.defaults(opts || {}, {
            browsers: ['default-browser'],
            files: ['default-file']
        });

        const tests = _.zipObject(opts.browsers, _.fill(Array(opts.browsers.length), opts.files));
        const runner = opts.runner || new Runner(makeConfigStub({browsers: opts.browsers}));

        return runner.run(tests);
    };

    beforeEach(() => {
        sandbox.stub(BrowserPool.prototype);

        sandbox.stub(MochaRunner.prototype, 'run');
        MochaRunner.prototype.run.returns(q());

        sandbox.stub(RetryManager.prototype);
    });

    afterEach(() => sandbox.restore());

    describe('constructor', () => {
        it('should create browser pool', () => {
            const config = makeConfigStub();

            new Runner(config); // eslint-disable-line no-new

            assert.calledWith(BrowserPool.prototype.__constructor, config);
        });

        it('should create retryManager with passed config', () => {
            const config = makeConfigStub();

            new Runner(config); // eslint-disable-line no-new

            assert.calledOnce(RetryManager.prototype.__constructor);
            assert.calledWith(RetryManager.prototype.__constructor, config);
        });
    });

    describe('run', () => {
        describe('RUNNER_START event', () => {
            it('should start mocha runner only after RUNNER_START handler finish', () => {
                const mediator = sinon.spy().named('mediator');
                const onRunnerStart = sinon.stub().named('onRunnerStart').returns(q.delay(1).then(mediator));
                const runner = new Runner(makeConfigStub());

                runner.on(RunnerEvents.RUNNER_START, onRunnerStart);

                return run_({runner})
                    .then(() => assert.callOrder(mediator, MochaRunner.prototype.run));
            });

            it('should pass a runner to a RUNNER_START handler', () => {
                const onRunnerStart = sinon.stub().named('onRunnerStart').returns(q());
                const runner = new Runner(makeConfigStub());

                runner.on(RunnerEvents.RUNNER_START, onRunnerStart);

                return run_({runner})
                    .then(() => assert.calledWith(onRunnerStart, runner));
            });

            it('should not run any mocha runner if RUNNER_START handler failed', () => {
                const onRunnerStart = sinon.stub().named('onRunnerStart').returns(q.reject('some-error'));
                const runner = new Runner(makeConfigStub());

                runner.on(RunnerEvents.RUNNER_START, onRunnerStart);

                return assert.isRejected(run_({runner}), /some-error/)
                    .then(() => assert.notCalled(MochaRunner.prototype.run));
            });
        });

        it('should create mocha runners with apporpriate browser agents', () => {
            mkMochaRunner();

            return run_({browsers: ['browser1', 'browser2']})
                .then(() => {
                    assert.calledTwice(MochaRunner.create);
                    assert.calledWith(MochaRunner.create,
                        sinon.match.any,
                        sinon.match.instanceOf(BrowserAgent).and(sinon.match.has('browserId', 'browser1'))
                    );
                    assert.calledWith(MochaRunner.create,
                        sinon.match.any,
                        sinon.match.instanceOf(BrowserAgent).and(sinon.match.has('browserId', 'browser2'))
                    );
                });
        });

        it('should create test skipper with browsers from config', () => {
            const config = makeConfigStub();
            sandbox.stub(TestSkipper, 'create');

            new Runner(config); // eslint-disable-line no-new

            assert.calledWith(TestSkipper.create, config);
        });

        it('should create mocha runner with test skipper', () => {
            mkMochaRunner();

            return run_()
                .then(() => {
                    assert.calledWith(MochaRunner.create,
                        sinon.match.any, sinon.match.any, sinon.match.instanceOf(TestSkipper));
                });
        });

        it('should run mocha runner with passed tests and filter function', () => {
            return run_({files: ['test1', 'test2']})
                .then(() => {
                    assert.calledWith(MochaRunner.prototype.run, ['test1', 'test2'], sinon.match.func);
                });
        });

        it('should not filter out any test by default', () => {
            return run_()
                .then(() => {
                    const filterFn = MochaRunner.prototype.run.firstCall.args[1];
                    assert.isTrue(filterFn());
                });
        });

        it('should wait until all mocha runners will finish', () => {
            const firstResolveMarker = sandbox.stub().named('First resolve marker');
            const secondResolveMarker = sandbox.stub().named('Second resolve marker');

            MochaRunner.prototype.run.onFirstCall().returns(q().then(firstResolveMarker));
            MochaRunner.prototype.run.onSecondCall().returns(q.delay(1).then(secondResolveMarker));

            return run_({browsers: ['browser1', 'browser2']})
                .then(() => {
                    assert.called(firstResolveMarker);
                    assert.called(secondResolveMarker);
                });
        });

        describe('if one of mocha runners failed', () => {
            let mochaRunner;

            beforeEach(() => {
                mochaRunner = mkMochaRunner();

                const runner = new Runner(makeConfigStub());
                return run_({runner});
            });

            it('should submit failed tests for retry', () => {
                mochaRunner.emit(RunnerEvents.TEST_FAIL, 'some-error');

                assert.calledOnce(RetryManager.prototype.handleTestFail);
                assert.calledWith(RetryManager.prototype.handleTestFail, 'some-error');
            });

            it('should submit errors for retry', () => {
                mochaRunner.emit(RunnerEvents.ERROR, 'some-error', 'some-data');

                assert.calledOnce(RetryManager.prototype.handleError);
                assert.calledWith(RetryManager.prototype.handleError, 'some-error', 'some-data');
            });
        });

        it('should passthrough events from mocha runners', () => {
            const mochaRunner = mkMochaRunner();
            const runner = new Runner(makeConfigStub());
            const onTestPass = sandbox.spy().named('onTestPass');

            runner.on(RunnerEvents.TEST_PASS, onTestPass);
            return run_({runner})
                .then(() => {
                    mochaRunner.emit(RunnerEvents.TEST_PASS);

                    assert.called(onTestPass);
                });
        });

        describe('passing of events from browser agent', () => {
            beforeEach(() => sandbox.stub(BrowserAgent, 'create'));

            [RunnerEvents.SESSION_START, RunnerEvents.SESSION_END].forEach((event) => {
                it(`should passthrough event ${event} from browser agent`, () => {
                    const browserAgent = new EventEmitter();
                    const runner = new Runner(makeConfigStub());
                    const onEventHandler = sandbox.spy().named(event);

                    BrowserAgent.create.returns(browserAgent);

                    runner.on(event, onEventHandler);

                    return run_({runner})
                        .then(() => {
                            browserAgent.emit(event);

                            assert.called(onEventHandler);
                        });
                });
            });
        });

        it('should start retry session after all', () => {
            return run_()
                .then(() => {
                    assert.calledOnce(RetryManager.prototype.retry);
                    assert.calledWith(RetryManager.prototype.retry, sinon.match.func);
                });
        });

        describe('retry manager events', () => {
            let retryMgr;
            let runner;

            beforeEach(() => {
                retryMgr = new EventEmitter();
                retryMgr.submitForRetry = sinon.stub();
                RetryManager.prototype.__constructor.returns(retryMgr);

                runner = new Runner(makeConfigStub());
            });

            it('should passthrough error event', () => {
                const onError = sandbox.spy().named('onError');

                runner.on(RunnerEvents.ERROR, onError);
                retryMgr.emit(RunnerEvents.ERROR);

                assert.called(onError);
            });

            it('should passthrough retry event', () => {
                const onRetry = sandbox.spy().named('onRetry');

                runner.on(RunnerEvents.RETRY, onRetry);
                retryMgr.emit(RunnerEvents.RETRY);

                assert.called(onRetry);
            });

            it('should passthrough test failed event', () => {
                const onTestFail = sandbox.spy().named('onTestFail');

                runner.on(RunnerEvents.TEST_FAIL, onTestFail);
                retryMgr.emit(RunnerEvents.TEST_FAIL);

                assert.called(onTestFail);
            });
        });

        describe('RUNNER_END event', () => {
            it('should be emitted after mocha runners finish', () => {
                const onRunnerEnd = sinon.spy().named('onRunnerEnd');
                const runner = new Runner(makeConfigStub());

                runner.on(RunnerEvents.RUNNER_END, onRunnerEnd);

                return run_({runner})
                    .then(() => assert.callOrder(MochaRunner.prototype.run, onRunnerEnd));
            });

            it('runner should wait until RUNNER_END handler finished', () => {
                const finMarker = sinon.spy().named('finMarker');
                const onRunnerEnd = sinon.stub().named('onRunnerEnd').returns(q.delay(1).then(finMarker));
                const runner = new Runner(makeConfigStub());

                runner.on(RunnerEvents.RUNNER_END, onRunnerEnd);

                return run_({runner})
                    .then(() => assert.calledOnce(finMarker));
            });

            it('should be emitted even if RUNNER_START handler failed', () => {
                const onRunnerStart = sinon.stub().named('onRunnerStart').returns(q.reject());
                const onRunnerEnd = sinon.spy().named('onRunnerEnd');
                const runner = new Runner(makeConfigStub());

                runner.on(RunnerEvents.RUNNER_START, onRunnerStart);
                runner.on(RunnerEvents.RUNNER_END, onRunnerEnd);

                return assert.isRejected(run_({runner}))
                    .then(() => assert.calledOnce(onRunnerEnd));
            });

            it('should be emitted even if some mocha runner failed', () => {
                const onRunnerEnd = sinon.spy().named('onRunnerEnd');
                const runner = new Runner(makeConfigStub());

                runner.on(RunnerEvents.RUNNER_END, onRunnerEnd);
                MochaRunner.prototype.run.returns(q.reject());

                return assert.isRejected(run_({runner}))
                    .then(() => assert.calledOnce(onRunnerEnd));
            });

            it('should leave original error unchaned if RUNNER_END handler failed too', () => {
                const onRunnerEnd = sinon.stub().named('onRunnerEnd').returns(q.reject('handler-error'));
                const runner = new Runner(makeConfigStub());

                runner.on(RunnerEvents.RUNNER_END, onRunnerEnd);
                MochaRunner.prototype.run.returns(q.reject('run-error'));

                return assert.isRejected(run_({runner}), /run-error/);
            });
        });
    });
});
