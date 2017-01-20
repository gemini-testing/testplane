'use strict';

const q = require('q');
const _ = require('lodash');
const QEmitter = require('qemitter');
const qUtils = require('qemitter/utils');

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

        const mochaRunner = new QEmitter();
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

        sandbox.stub(MochaRunner, 'init');

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

        it('should init mocha runner on RUNNER_START event', () => {
            new Runner(makeConfigStub()); // eslint-disable-line no-new

            assert.calledOnce(MochaRunner.init);
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

        it('should run mocha runner with passed tests', () => {
            return run_({files: ['test1', 'test2']})
                .then(() => assert.calledWith(MochaRunner.prototype.run, ['test1', 'test2']));
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

        describe('Mocha runners', () => {
            let mochaRunner;

            beforeEach(() => {
                mochaRunner = mkMochaRunner();
            });

            describe('if one of mocha runners failed', () => {
                beforeEach(() => {
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

            describe('events', () => {
                const mochaRunnerEvents = [
                    RunnerEvents.SUITE_BEGIN,
                    RunnerEvents.SUITE_END,

                    RunnerEvents.TEST_BEGIN,
                    RunnerEvents.TEST_END,

                    RunnerEvents.TEST_PASS,
                    RunnerEvents.TEST_PENDING,

                    RunnerEvents.INFO,
                    RunnerEvents.WARNING
                ];

                it('should passthrough events', () => {
                    const runner = new Runner(makeConfigStub());

                    return run_({runner})
                        .then(() => {
                            _.forEach(mochaRunnerEvents, (event, name) => {
                                const spy = sinon.spy().named(`${name} handler`);
                                runner.on(event, spy);

                                mochaRunner.emit(event);

                                assert.calledOnce(spy);
                            });
                        });
                });

                it('should passthrough events from mocha runners synchronously', () => {
                    sandbox.stub(qUtils, 'passthroughEvent');
                    const runner = new Runner(makeConfigStub());

                    return run_({runner})
                        .then(() => {
                            assert.calledWith(qUtils.passthroughEvent,
                                sinon.match.instanceOf(QEmitter),
                                sinon.match.instanceOf(Runner),
                                mochaRunnerEvents
                            );
                        });
                });
            });
        });

        describe('passing of events from browser agent', () => {
            beforeEach(() => sandbox.stub(BrowserAgent, 'create').returns(sinon.createStubInstance(BrowserAgent)));

            [RunnerEvents.SESSION_START, RunnerEvents.SESSION_END].forEach((event) => {
                it(`should passthrough event ${event} from browser agent`, () => {
                    const browserAgent = new QEmitter();
                    const runner = new Runner(makeConfigStub());
                    const onEventHandler = sandbox.spy().named(event);

                    BrowserAgent.create.returns(browserAgent);

                    runner.on(event, onEventHandler);

                    return run_({runner})
                        .then(() => {
                            browserAgent.emitAndWait(event);

                            assert.called(onEventHandler);
                        });
                });
            });

            it('should passthrough SESSION_START and SESSION_END events asynchronously', () => {
                sandbox.stub(qUtils, 'passthroughEventAsync');
                const runner = new Runner(makeConfigStub());

                return run_({runner})
                    .then(() => {
                        assert.calledWith(qUtils.passthroughEventAsync,
                            sinon.match.instanceOf(BrowserAgent),
                            sinon.match.instanceOf(Runner), [
                                RunnerEvents.SESSION_START,
                                RunnerEvents.SESSION_END
                            ]
                        );
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
                retryMgr = new QEmitter();
                retryMgr.submitForRetry = sinon.stub();
                RetryManager.prototype.__constructor.returns(retryMgr);
            });

            it('should passthrough error event', () => {
                const onError = sandbox.spy().named('onError');

                runner = new Runner(makeConfigStub());
                runner.on(RunnerEvents.ERROR, onError);
                retryMgr.emit(RunnerEvents.ERROR);

                assert.called(onError);
            });

            it('should passthrough retry event', () => {
                const onRetry = sandbox.spy().named('onRetry');

                runner = new Runner(makeConfigStub());
                runner.on(RunnerEvents.RETRY, onRetry);
                retryMgr.emit(RunnerEvents.RETRY);

                assert.called(onRetry);
            });

            it('should passthrough test failed event', () => {
                const onTestFail = sandbox.spy().named('onTestFail');

                runner = new Runner(makeConfigStub());
                runner.on(RunnerEvents.TEST_FAIL, onTestFail);
                retryMgr.emit(RunnerEvents.TEST_FAIL);

                assert.called(onTestFail);
            });

            it('should synchrony passthrough necessary events', () => {
                sandbox.stub(qUtils, 'passthroughEvent');

                new Runner(makeConfigStub()); // eslint-disable-line no-new

                assert.calledWith(qUtils.passthroughEvent,
                    retryMgr,
                    sinon.match.instanceOf(Runner), [
                        RunnerEvents.TEST_FAIL,
                        RunnerEvents.SUITE_FAIL,
                        RunnerEvents.ERROR,
                        RunnerEvents.RETRY
                    ]
                );
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

    describe('buildSuiteTree', () => {
        beforeEach(() => {
            sandbox.stub(MochaRunner.prototype, 'buildSuiteTree');
            sandbox.stub(BrowserAgent, 'create').returns(sinon.createStubInstance(BrowserAgent));
        });

        it('should create browser agent for each browser', () => {
            const runner = new Runner(makeConfigStub());

            runner.buildSuiteTree({bro1: [], bro2: []});

            assert.calledTwice(BrowserAgent.create);
            assert.calledWith(BrowserAgent.create, 'bro1');
            assert.calledWith(BrowserAgent.create, 'bro2');
            assert.calledWith(BrowserAgent.create, sinon.match.any, sinon.match.instanceOf(BrowserPool));
        });

        it('should create mocha runner with the specified config and browser agent', () => {
            const config = makeConfigStub();
            const runner = new Runner(config);
            const createMochaRunner = sinon.spy(MochaRunner, 'create');

            runner.buildSuiteTree({bro: []});

            assert.calledWith(createMochaRunner, config, sinon.match.instanceOf(BrowserAgent), sinon.match.instanceOf(TestSkipper));
        });

        it('should assign suite tree from mocha runner to passed browsers', () => {
            const config = makeConfigStub();
            const runner = new Runner(config);
            const suiteTreeStub = sandbox.stub();
            MochaRunner.prototype.buildSuiteTree.returns(suiteTreeStub);

            const suiteTree = runner.buildSuiteTree({bro: []});

            assert.deepEqual(suiteTree, {bro: suiteTreeStub});
        });

        it('should build suite tree for each set of files', () => {
            const runner = new Runner(makeConfigStub());

            runner.buildSuiteTree({bro: ['some/path/file1.js', 'other/path/file2.js']});

            assert.calledWith(MochaRunner.prototype.buildSuiteTree, ['some/path/file1.js', 'other/path/file2.js']);
        });
    });
});
