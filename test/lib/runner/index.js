'use strict';

const q = require('q');
const _ = require('lodash');
const QEmitter = require('qemitter');
const qUtils = require('qemitter/utils');

const BrowserAgent = require('../../../lib/browser-agent');
const BrowserPool = require('../../../lib/browser-pool');
const logger = require('../../../lib/utils').logger;
const MochaRunner = require('../../../lib/runner/mocha-runner');
const Runner = require('../../../lib/runner');
const TestSkipper = require('../../../lib/runner/test-skipper');
const RunnerEvents = require('../../../lib/constants/runner-events');

const utils = require('../../utils');

describe('Runner', () => {
    const sandbox = sinon.sandbox.create();

    const makeConfigStub = (opts) => {
        const config = utils.makeConfigStub(opts);

        config.forBrowser = sandbox.stub();

        return config;
    };

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
        sandbox.stub(logger, 'warn');
    });

    afterEach(() => sandbox.restore());

    describe('constructor', () => {
        it('should create browser pool', () => {
            const config = makeConfigStub();

            new Runner(config); // eslint-disable-line no-new

            assert.calledWith(BrowserPool.prototype.__constructor, config);
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

            describe('events', () => {
                const mochaRunnerEvents = _.values(RunnerEvents.getSync());

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

        describe('passing events from browser agent', () => {
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

        it('should passthrough BEFORE_FILE_READ and AFTER_FILE_READ events synchronously', () => {
            sandbox.stub(qUtils, 'passthroughEvent');
            const runner = new Runner(makeConfigStub());

            runner.buildSuiteTree([{}]);

            assert.calledWith(qUtils.passthroughEvent,
                sinon.match.instanceOf(QEmitter),
                sinon.match.instanceOf(Runner),
                [
                    RunnerEvents.BEFORE_FILE_READ,
                    RunnerEvents.AFTER_FILE_READ
                ]
            );
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
