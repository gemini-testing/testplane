'use strict';

const _ = require('lodash');
const {temp} = require('gemini-core');
const Promise = require('bluebird');

const BrowserPool = require('lib/browser-pool');
const RuntimeConfig = require('lib/config/runtime-config');
const RunnerStats = require('lib/stats');
const RunnerEvents = require('lib/constants/runner-events');
const logger = require('lib/utils/logger');
const Workers = require('lib/runner/workers');
const Runner = require('lib/runner');
const BrowserRunner = require('lib/runner/browser-runner');
const TestCollection = require('lib/test-collection');

const {makeConfigStub, makeTest} = require('../../utils');

describe('Runner', () => {
    const sandbox = sinon.sandbox.create();

    const run_ = (opts = {}) => {
        const config = opts.config || makeConfigStub();
        const runner = opts.runner || new Runner(config);

        return runner.run(opts.testCollection || TestCollection.create());
    };

    beforeEach(() => {
        sandbox.stub(Workers.prototype);
        sandbox.stub(Workers, 'create').returns(Object.create(Workers.prototype));

        sandbox.stub(BrowserPool, 'create').returns({cancel: sandbox.spy()});

        sandbox.stub(temp, 'init');
        sandbox.stub(temp, 'serialize');

        sandbox.stub(logger, 'warn');
        sandbox.stub(RuntimeConfig, 'getInstance').returns({extend: () => {}});

        sandbox.stub(TestCollection.prototype);

        sandbox.spy(BrowserRunner, 'create');
        sandbox.stub(BrowserRunner.prototype, 'browserId');
        sandbox.stub(BrowserRunner.prototype, 'run').resolves();
        sandbox.stub(BrowserRunner.prototype, 'addTestToRun').resolves();
    });

    afterEach(() => sandbox.restore());

    describe('constructor', () => {
        it('should create browser pool', () => {
            const config = makeConfigStub();
            const runner = new Runner(config);

            assert.calledOnceWith(BrowserPool.create, config, runner);
        });

        it('should init temp with dir from config', () => {
            const config = makeConfigStub({system: {tempDir: 'some/dir'}});

            Runner.create(config);

            assert.calledOnceWith(temp.init, 'some/dir');
        });

        it('should extend runtime config with temp options', () => {
            const extend = sandbox.stub();
            RuntimeConfig.getInstance.returns({extend});

            temp.serialize.returns({some: 'opts'});

            Runner.create(makeConfigStub());

            assert.calledOnceWith(extend, {tempOpts: {some: 'opts'}});
        });
    });

    describe('run', () => {
        beforeEach(() => {
            TestCollection.prototype.getBrowsers.returns(['defaultBrowser']);
        });

        describe('workers', () => {
            it('should create workers', async () => {
                const config = makeConfigStub();
                const runner = new Runner(config);

                await run_({runner});

                assert.calledOnceWith(Workers.create, config);
            });

            it('should create workers before RUNNER_START event', async () => {
                const onRunnerStart = sinon.stub().named('onRunnerStart').resolves();
                const runner = new Runner(makeConfigStub())
                    .on(RunnerEvents.RUNNER_START, onRunnerStart);

                await run_({runner});

                assert.callOrder(Workers.create, onRunnerStart);
            });

            it('should pass workers to each browser runner', async () => {
                const workers = Object.create(Workers.prototype);
                Workers.create.returns(workers);

                TestCollection.prototype.getBrowsers.returns(['bro1', 'bro2']);
                await run_();

                assert.alwaysCalledWith(BrowserRunner.prototype.run, sinon.match.any, workers);
            });

            it('should end workers after work is done', async () => {
                await run_();

                assert.calledOnce(Workers.prototype.end);
            });

            it('should end workers on fail', async () => {
                const runner = new Runner(makeConfigStub())
                    .on(RunnerEvents.RUNNER_START, () => Promise.reject('o.O'));

                await run_({runner}).catch(() => {});

                assert.calledOnce(Workers.prototype.end);
            });
        });

        describe('RUNNER_START event', () => {
            it('should pass a runner to a RUNNER_START handler', async () => {
                const onRunnerStart = sinon.stub().named('onRunnerStart').resolves();
                const runner = new Runner(makeConfigStub())
                    .on(RunnerEvents.RUNNER_START, onRunnerStart);

                await run_({runner});

                assert.calledOnceWith(onRunnerStart, runner);
            });

            it('should start browser runner only after RUNNER_START handler finish', async () => {
                const mediator = sinon.spy().named('mediator');
                const onRunnerStart = sinon.stub().named('onRunnerStart').callsFake(() => Promise.delay(10).then(mediator));
                const runner = new Runner(makeConfigStub())
                    .on(RunnerEvents.RUNNER_START, onRunnerStart);

                await run_({runner});

                assert.callOrder(mediator, BrowserRunner.prototype.run);
            });

            it('should not run any browser runner if RUNNER_START handler failed', async () => {
                const onRunnerStart = sinon.stub().named('onRunnerStart').rejects('some-error');
                const runner = new Runner(makeConfigStub())
                    .on(RunnerEvents.RUNNER_START, onRunnerStart);

                await run_({runner}).catch(() => {});

                assert.notCalled(BrowserRunner.prototype.run);
            });
        });

        it('should emit BEGIN event only after RUNNER_START handler finish', async () => {
            const mediator = sinon.spy().named('mediator');
            const onRunnerStart = sinon.stub().named('onRunnerStart').callsFake(() => Promise.delay(10).then(mediator));
            const onBegin = sinon.stub().named('onBegin');

            const runner = new Runner(makeConfigStub())
                .on(RunnerEvents.RUNNER_START, onRunnerStart)
                .on(RunnerEvents.BEGIN, onBegin);

            await run_({runner});

            assert.callOrder(onRunnerStart, mediator, onBegin);
        });

        it('should create browser runners for all browsers from config', async () => {
            TestCollection.prototype.getBrowsers.returns(['foo', 'bar']);

            await run_();

            assert.calledTwice(BrowserRunner.create);
            assert.calledWith(BrowserRunner.create, 'foo');
            assert.calledWith(BrowserRunner.create, 'bar');
        });

        it('should pass config to the browser runner', async () => {
            const config = makeConfigStub();

            await run_({config});

            assert.calledOnceWith(BrowserRunner.create, sinon.match.any, config);
        });

        it('should create browser runners with the same browser pool', async () => {
            TestCollection.prototype.getBrowsers.returns(['foo', 'bar']);
            const pool = Object.create(null);

            BrowserPool.create.returns(pool);

            await run_();

            assert.calledTwice(BrowserRunner.create);
            assert.calledWith(BrowserRunner.create, sinon.match.any, sinon.match.any, pool);
            assert.calledWith(BrowserRunner.create, sinon.match.any, sinon.match.any, pool);
        });

        it('should pass test collection to browser runner', async () => {
            const testCollection = TestCollection.create();
            TestCollection.prototype.getBrowsers.returns(['foo']);

            await run_({testCollection});

            assert.calledOnceWith(BrowserRunner.prototype.run, testCollection);
        });

        it('should aggregate statistic for all browsers', async () => {
            const emitTestResult = (title) => function() {
                this.emit(RunnerEvents.TEST_PASS, makeTest({title}));
                return Promise.resolve();
            };

            TestCollection.prototype.getBrowsers.returns(['foo', 'bar']);
            BrowserRunner.prototype.run
                .onFirstCall().callsFake(emitTestResult('test1'))
                .onSecondCall().callsFake(emitTestResult('test2'));

            const onRunnerEnd = sinon.stub().named('onRunnerEnd');
            const runner = new Runner(makeConfigStub())
                .on(RunnerEvents.RUNNER_END, onRunnerEnd);

            await run_({runner});

            assert.equal(onRunnerEnd.firstCall.args[0].total, 2);
        });

        it('should wait until all browser runners will finish', async () => {
            const firstResolveMarker = sandbox.stub().named('First resolve marker');
            const secondResolveMarker = sandbox.stub().named('Second resolve marker');

            TestCollection.prototype.getBrowsers.returns(['foo', 'bar']);
            BrowserRunner.prototype.run
                .onFirstCall().callsFake(() => Promise.resolve().then(firstResolveMarker))
                .onSecondCall().callsFake(() => Promise.delay(1).then(secondResolveMarker));

            await run_();

            assert.calledOnce(firstResolveMarker);
            assert.calledOnce(secondResolveMarker);
        });

        _.forEach(RunnerEvents.getSync(), (event, name) => {
            it(`should passthrough ${name} event from browser runner`, async () => {
                BrowserRunner.prototype.run.callsFake(function() {
                    this.emit(event, {foo: 'bar'});
                    return Promise.resolve();
                });

                sandbox.stub(RunnerStats.prototype, 'attachRunner');

                const onEvent = sinon.stub().named(`on${name}`);
                const runner = new Runner(makeConfigStub())
                    .on(event, onEvent);

                await run_({runner});

                assert.calledOnceWith(onEvent, {foo: 'bar'});
            });
        });

        describe('RUNNER_END event', () => {
            it('should be emitted after browser runners finish', async () => {
                const onRunnerEnd = sinon.spy().named('onRunnerEnd');

                const runner = new Runner(makeConfigStub())
                    .on(RunnerEvents.RUNNER_END, onRunnerEnd);

                await run_({runner});

                assert.callOrder(BrowserRunner.prototype.run, onRunnerEnd);
            });

            it('runner should wait until RUNNER_END handler finished', async () => {
                const finMarker = sinon.spy().named('finMarker');
                const onRunnerEnd = sinon.stub().named('onRunnerEnd').callsFake(() => Promise.delay(1).then(finMarker));

                const runner = new Runner(makeConfigStub())
                    .on(RunnerEvents.RUNNER_END, onRunnerEnd);

                await run_({runner});

                assert.calledOnce(finMarker);
            });

            it('should be emitted even if RUNNER_START handler failed', async () => {
                const onRunnerStart = sinon.stub().named('onRunnerStart').rejects();
                const onRunnerEnd = sinon.spy().named('onRunnerEnd');
                const runner = new Runner(makeConfigStub())
                    .on(RunnerEvents.RUNNER_START, onRunnerStart)
                    .on(RunnerEvents.RUNNER_END, onRunnerEnd);

                await run_({runner}).catch(() => {});

                assert.calledOnce(onRunnerEnd);
            });

            it('should be emitted even if some browser runner failed', async () => {
                const onRunnerEnd = sinon.spy().named('onRunnerEnd');
                const runner = new Runner(makeConfigStub())
                    .on(RunnerEvents.RUNNER_END, onRunnerEnd);

                BrowserRunner.prototype.run.callsFake(() => Promise.reject());

                await run_({runner}).catch(() => {});

                assert.calledOnce(onRunnerEnd);
            });

            it('should pass test statistic to a RUNNER_END handler', async () => {
                sandbox.stub(RunnerStats.prototype, 'getResult').returns({foo: 'bar'});

                const onRunnerEnd = sinon.stub().named('onRunnerEnd');
                const runner = new Runner(makeConfigStub())
                    .on(RunnerEvents.RUNNER_END, onRunnerEnd);

                await run_({runner});

                assert.calledOnceWith(onRunnerEnd, {foo: 'bar'});
            });

            it('should fail with original error if RUNNER_END handler is failed too', () => {
                const runner = new Runner(makeConfigStub())
                    .on(RunnerEvents.RUNNER_END, () => Promise.reject('handler-error'));

                BrowserRunner.prototype.run.callsFake(() => Promise.reject('run-error'));

                return assert.isRejected(run_({runner}), /run-error/);
            });
        });
    });

    describe('addTestToRun', () => {
        beforeEach(() => {
            TestCollection.prototype.getBrowsers.returns([]);
        });

        it('should create new browser runner if there is no active one', async () => {
            const config = makeConfigStub({browser: ['bro1']});
            const pool = {};
            BrowserPool.create.returns(pool);
            const workers = Object.create(Workers.prototype);
            Workers.create.returns(workers);
            const runner = new Runner(config);
            const test = {};
            await run_({runner});

            runner.addTestToRun(test, 'bro2');

            assert.calledOnceWith(BrowserRunner.create, 'bro2', config, pool);
            assert.calledOnceWith(BrowserRunner.prototype.run, TestCollection.create({bro2: [test]}), workers);
        });

        it('should pass test to the browser runner', async () => {
            const runner = new Runner(makeConfigStub());
            const test = {};

            BrowserRunner.prototype.browserId.returns('bro');
            BrowserRunner.prototype.run.callsFake(() => runner.addTestToRun(test, 'bro'));
            TestCollection.prototype.getBrowsers.returns(['bro']);

            await run_({runner});

            assert.calledWith(BrowserRunner.prototype.addTestToRun, test);
        });

        it('should return false when runner is not running', async () => {
            const runner = new Runner(makeConfigStub());

            const added = runner.addTestToRun({});

            assert.isFalse(added);
            assert.notCalled(BrowserRunner.prototype.addTestToRun);
            assert.notCalled(BrowserRunner.prototype.run);
        });

        it('should return false when workers is ended', async () => {
            const runner = new Runner(makeConfigStub());
            await run_({runner});
            Workers.prototype.isEnded.returns(true);

            const added = runner.addTestToRun({});

            assert.isFalse(added);
            assert.notCalled(BrowserRunner.prototype.addTestToRun);
            assert.notCalled(BrowserRunner.prototype.run);
        });

        it('should return false when runner is cancelled', async () => {
            const runner = new Runner(makeConfigStub());
            run_({runner});

            runner.cancel();
            const added = runner.addTestToRun({});

            assert.isFalse(added);
            assert.notCalled(BrowserRunner.prototype.addTestToRun);
            assert.notCalled(BrowserRunner.prototype.run);
        });
    });

    describe('cancel', () => {
        let cancelStub;

        beforeEach(() => {
            cancelStub = sandbox.stub();
            BrowserPool.create.returns({cancel: cancelStub});

            sandbox.stub(BrowserRunner.prototype, 'cancel');
        });

        it('should cancel browser pool', () => {
            const runner = new Runner(makeConfigStub());

            runner.cancel();

            assert.calledOnce(cancelStub);
        });

        it('should cancel all executing browser runners', async () => {
            TestCollection.prototype.getBrowsers.returns(['foo', 'bar']);

            const runner = new Runner(makeConfigStub());

            BrowserRunner.prototype.run.onSecondCall().callsFake(() => {
                runner.cancel();
                return Promise.resolve();
            });

            await run_({runner});

            assert.calledTwice(BrowserRunner.prototype.cancel);
        });

        it('should not cancel finished browser runner', async () => {
            TestCollection.prototype.getBrowsers.returns(['foo', 'bar']);

            const runner = new Runner(makeConfigStub());

            await run_({runner});
            runner.cancel();

            assert.notCalled(BrowserRunner.prototype.cancel);
        });

        it('shuld not run browser runners if cancelled', async () => {
            TestCollection.prototype.getBrowsers.returns(['foo', 'bar']);

            const runner = new Runner(makeConfigStub())
                .on(RunnerEvents.RUNNER_START, () => runner.cancel());

            await run_({runner});

            assert.notCalled(BrowserRunner.prototype.run);
            assert.notCalled(BrowserRunner.prototype.cancel);
        });
    });
});
