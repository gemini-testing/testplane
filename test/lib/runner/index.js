'use strict';

const EventEmitter = require('events').EventEmitter;
const path = require('path');
const BrowserAgent = require('gemini-core').BrowserAgent;
const _ = require('lodash');
const proxyquire = require('proxyquire');
const q = require('q');
const eventsUtils = require('gemini-core').events.utils;

const BrowserPool = require('lib/browser-pool');
const RuntimeConfig = require('lib/config/runtime-config');
const MochaRunner = require('lib/runner/mocha-runner');
const TestSkipper = require('lib/runner/test-skipper');
const RunnerEvents = require('lib/constants/runner-events');
const logger = require('lib/utils/logger');

const makeConfigStub = require('../../utils').makeConfigStub;

describe('Runner', () => {
    const sandbox = sinon.sandbox.create();

    let Runner, workerFarm, workers;

    const mkMochaRunner = () => {
        sandbox.stub(MochaRunner, 'create');

        const mochaRunner = new EventEmitter();
        mochaRunner.init = sandbox.stub().returnsThis();
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
        const runner = opts.runner || new Runner(opts.config || makeConfigStub({browsers: opts.browsers}));

        return runner.run(tests);
    };

    beforeEach(() => {
        workers = {
            init: sandbox.stub().yields(),
            syncConfig: sandbox.stub().yields()
        };

        workerFarm = sandbox.stub().returns(workers);
        workerFarm.end = sandbox.stub();

        Runner = proxyquire('../../../lib/runner', {'worker-farm': workerFarm});

        sandbox.stub(BrowserPool, 'create');

        sandbox.stub(MochaRunner, 'prepare');
        sandbox.stub(MochaRunner.prototype, 'init').returnsThis();
        sandbox.stub(MochaRunner.prototype, 'run').returns(q());

        sandbox.stub(logger, 'warn');
        sandbox.stub(RuntimeConfig, 'getInstance');
    });

    afterEach(() => sandbox.restore());

    describe('constructor', () => {
        it('should create browser pool', () => {
            const config = makeConfigStub();
            const runner = new Runner(config);

            assert.calledOnceWith(BrowserPool.create, config, runner);
        });

        it('should prepare mocha runner', () => {
            Runner.create(makeConfigStub());

            assert.calledOnce(MochaRunner.prepare);
        });
    });

    describe('run', () => {
        describe('worker farm', () => {
            it('should create a worker farm', () => {
                mkMochaRunner();

                return run_({config: makeConfigStub({system: {workers: 100500}})})
                    .then(() => {
                        assert.calledOnceWith(workerFarm, {
                            maxConcurrentWorkers: 100500,
                            maxConcurrentCallsPerWorker: Infinity,
                            autoStart: true
                        }, path.join(process.cwd(), 'lib/worker/index.js'), [
                            {name: 'init', broadcast: true},
                            {name: 'syncConfig', broadcast: true},
                            'runTest'
                        ]);
                    });
            });

            it('should create a worker farm before RUNNER_START event', () => {
                const onRunnerStart = sinon.stub().named('onRunnerStart').returns(q());
                const runner = new Runner(makeConfigStub());

                runner.on(RunnerEvents.RUNNER_START, onRunnerStart);

                return run_({runner})
                    .then(() => assert.callOrder(workerFarm, onRunnerStart));
            });

            it('should init workers', () => {
                const runner = new Runner(makeConfigStub({configPath: 'some-config-path'}));

                RuntimeConfig.getInstance.returns({runtime: 'config'});

                return runner.run({bro: ['file1', 'file2']})
                    .then(() => assert.calledOnceWith(workers.init, {bro: ['file1', 'file2']}, 'some-config-path', {runtime: 'config'}));
            });

            it('should sync serialized config with workers', () => {
                mkMochaRunner();

                const config = makeConfigStub();
                config.serialize.returns({foo: 'bar'});

                return run_({config})
                    .then(() => assert.calledOnceWith(workers.syncConfig, {foo: 'bar'}));
            });

            it('should sync config after all RUNNER_START handler have finished', () => {
                const onRunnerStart = sinon.stub().named('onRunnerStart').returns(q().then(() => q.delay(1)));
                const runner = new Runner(makeConfigStub());

                runner.on(RunnerEvents.RUNNER_START, onRunnerStart);

                return run_({runner})
                    .then(() => assert.callOrder(onRunnerStart, workers.syncConfig));
            });

            it('should pass workers to each mocha runner', () => {
                return run_({browsers: ['bro1', 'bro2']})
                    .then(() => assert.alwaysCalledWith(MochaRunner.prototype.run, workers));
            });
        });

        describe('RUNNER_START event', () => {
            it('should pass a runner to a RUNNER_START handler', () => {
                const onRunnerStart = sinon.stub().named('onRunnerStart').returns(q());
                const runner = new Runner(makeConfigStub());

                runner.on(RunnerEvents.RUNNER_START, onRunnerStart);

                return run_({runner})
                    .then(() => assert.calledOnceWith(onRunnerStart, runner));
            });

            it('should start mocha runner only after RUNNER_START handler finish', () => {
                const mediator = sinon.spy().named('mediator');
                const onRunnerStart = sinon.stub().named('onRunnerStart').callsFake(() => q.delay(1).then(mediator));
                const runner = new Runner(makeConfigStub());

                runner.on(RunnerEvents.RUNNER_START, onRunnerStart);

                return run_({runner})
                    .then(() => assert.callOrder(mediator, MochaRunner.prototype.run));
            });

            it('should not run any mocha runner if RUNNER_START handler failed', () => {
                const onRunnerStart = sinon.stub().named('onRunnerStart').returns(q.reject('some-error'));
                const runner = new Runner(makeConfigStub());

                runner.on(RunnerEvents.RUNNER_START, onRunnerStart);

                return assert.isRejected(run_({runner}), /some-error/)
                    .then(() => assert.notCalled(MochaRunner.prototype.run));
            });
        });

        it('should emit BEGIN event between runner init and run calls', () => {
            const onBegin = sinon.stub().named('onBegin');
            const runner = new Runner(makeConfigStub());

            runner.on(RunnerEvents.BEGIN, onBegin);

            return run_({runner})
                .then(() => {
                    assert.callOrder(
                        MochaRunner.prototype.init,
                        onBegin,
                        MochaRunner.prototype.run
                    );
                });
        });

        it('should create mocha runners for all browsers from config', () => {
            mkMochaRunner();

            return run_({browsers: ['browser1', 'browser2']})
                .then(() => {
                    assert.calledTwice(MochaRunner.create);
                    assert.calledWith(MochaRunner.create, 'browser1');
                    assert.calledWith(MochaRunner.create, 'browser2');
                });
        });

        it('should pass config to a mocha runner', () => {
            mkMochaRunner();

            return run_({config: makeConfigStub({plugins: {foo: 'bar'}})})
                .then(() => assert.calledOnceWith(
                    MochaRunner.create,
                    sinon.match.any,
                    sinon.match({plugins: {foo: 'bar'}})
                ));
        });

        it('should create mocha runners with the same browser pool', () => {
            mkMochaRunner();

            BrowserPool.create.returns({browser: 'pool'});

            return run_({browsers: ['browser1', 'browser2']})
                .then(() => {
                    assert.calledTwice(MochaRunner.create);
                    assert.calledWith(MochaRunner.create, sinon.match.any, sinon.match.any, {browser: 'pool'});
                    assert.calledWith(MochaRunner.create, sinon.match.any, sinon.match.any, {browser: 'pool'});
                });
        });

        it('should create test skipper with browsers from config', () => {
            sandbox.stub(TestSkipper, 'create');

            Runner.create({some: 'config'});

            assert.calledOnceWith(TestSkipper.create, {some: 'config'});
        });

        it('should create mocha runner with test skipper', () => {
            mkMochaRunner();

            return run_()
                .then(() => {
                    assert.calledOnceWith(MochaRunner.create,
                        sinon.match.any, sinon.match.any, sinon.match.any, sinon.match.instanceOf(TestSkipper));
                });
        });

        it('should init mocha runner with passed tests', () => {
            return run_({files: ['test1', 'test2']})
                .then(() => assert.calledOnceWith(MochaRunner.prototype.init, ['test1', 'test2']));
        });

        it('should wait until all mocha runners will finish', () => {
            const firstResolveMarker = sandbox.stub().named('First resolve marker');
            const secondResolveMarker = sandbox.stub().named('Second resolve marker');

            MochaRunner.prototype.run
                .onFirstCall().callsFake(() => q().then(firstResolveMarker))
                .onSecondCall().callsFake(() => q.delay(1).then(secondResolveMarker));

            return run_({browsers: ['browser1', 'browser2']})
                .then(() => {
                    assert.calledOnce(firstResolveMarker);
                    assert.calledOnce(secondResolveMarker);
                });
        });

        describe('Mocha runners', () => {
            let mochaRunner;

            beforeEach(() => mochaRunner = mkMochaRunner());

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
                    sandbox.stub(eventsUtils, 'passthroughEvent');
                    const runner = new Runner(makeConfigStub());

                    return run_({runner})
                        .then(() => {
                            assert.calledOnceWith(eventsUtils.passthroughEvent,
                                sinon.match.instanceOf(EventEmitter),
                                sinon.match.instanceOf(Runner),
                                mochaRunnerEvents
                            );
                        });
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

            it('should fail with original error if RUNNER_END handler is failed too', () => {
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

        it('should passthrough BEFORE_FILE_READ and AFTER_FILE_READ events synchronously', () => {
            sandbox.stub(eventsUtils, 'passthroughEvent');
            const runner = new Runner(makeConfigStub());

            runner.buildSuiteTree([{}]);

            assert.calledWith(eventsUtils.passthroughEvent,
                sinon.match.instanceOf(EventEmitter),
                sinon.match.instanceOf(Runner),
                [
                    RunnerEvents.BEFORE_FILE_READ,
                    RunnerEvents.AFTER_FILE_READ
                ]
            );
        });

        it('should create mocha runner with the specified config, browser pool and test skipper', () => {
            const config = makeConfigStub();
            const browserPool = {baz: 'bar'};

            BrowserPool.create.returns(browserPool);

            const runner = new Runner(config);
            const createMochaRunner = sinon.spy(MochaRunner, 'create');

            runner.buildSuiteTree({bro: []});

            assert.calledOnceWith(
                createMochaRunner,
                'bro', config, browserPool, sinon.match.instanceOf(TestSkipper)
            );
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

            assert.calledOnceWith(MochaRunner.prototype.buildSuiteTree, ['some/path/file1.js', 'other/path/file2.js']);
        });
    });
});
