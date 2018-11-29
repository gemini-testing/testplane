'use strict';

const _ = require('lodash');
const eventsUtils = require('gemini-core').events.utils;
const {AsyncEmitter} = require('gemini-core').events;
const {EventEmitter} = require('events');
const pluginsLoader = require('plugins-loader');
const q = require('q');
const Promise = require('bluebird');
const proxyquire = require('proxyquire').noCallThru();

const Config = require('lib/config');
const RuntimeConfig = require('lib/config/runtime-config');
const Errors = require('lib/errors');
const Hermione = require('lib/hermione');
const TestReader = require('lib/test-reader');
const TestCollection = require('lib/test-collection');
const RunnerEvents = require('lib/constants/runner-events');
const signalHandler = require('lib/signal-handler');
const Runner = require('lib/runner');
const logger = require('lib/utils/logger');
const {makeConfigStub} = require('../utils');

describe('hermione', () => {
    const sandbox = sinon.sandbox.create();

    const mkRunnerStub_ = (runFn) => {
        const runner = new AsyncEmitter();

        runner.run = sandbox.stub(Runner.prototype, 'run').callsFake(runFn && runFn.bind(null, runner));
        runner.addTestToRun = sandbox.stub(Runner.prototype, 'addTestToRun');

        sandbox.stub(Runner, 'create').returns(runner);
        return runner;
    };

    beforeEach(() => {
        sandbox.stub(logger, 'warn');
        sandbox.stub(Config, 'create').returns(makeConfigStub());

        sandbox.stub(pluginsLoader, 'load').returns([]);

        sandbox.stub(RuntimeConfig, 'getInstance').returns({extend: sandbox.stub()});

        sandbox.stub(TestReader.prototype, 'read').resolves();
    });

    afterEach(() => sandbox.restore());

    describe('constructor', () => {
        beforeEach(() => {
            sandbox.stub(Runner, 'create').returns(new EventEmitter());
        });

        it('should create a config from the passed path', () => {
            Hermione.create('some-config-path.js');

            assert.calledOnceWith(Config.create, 'some-config-path.js');
        });

        it('should load plugins', () => {
            Hermione.create();

            assert.calledOnce(pluginsLoader.load);
        });

        it('should load plugins for hermione instance', () => {
            Hermione.create();

            assert.calledWith(pluginsLoader.load, sinon.match.instanceOf(Hermione));
        });

        it('should load plugins from config', () => {
            Config.create.returns(makeConfigStub({plugins: {'some-plugin': true}}));

            Hermione.create();

            assert.calledWith(pluginsLoader.load, sinon.match.any, {'some-plugin': true});
        });

        it('should load plugins with appropriate prefix', () => {
            Hermione.create();

            assert.calledWith(pluginsLoader.load, sinon.match.any, sinon.match.any, 'hermione-');
        });
    });

    describe('extendCli', () => {
        it ('should emit CLI event with passed parser', () => {
            const hermione = Hermione.create();
            const onCli = sinon.spy().named('onCli');
            const parser = {foo: 'bar'};

            hermione.on(RunnerEvents.CLI, onCli);

            hermione.extendCli(parser);

            assert.calledOnceWith(onCli, parser);
        });
    });

    describe('run', () => {
        const runHermione = (paths, opts) => Hermione.create().run(paths, opts);

        beforeEach(() => {
            sandbox.stub(TestCollection.prototype, 'getBrowsers').returns([]);
            sandbox.stub(Hermione.prototype, 'halt');
        });

        it('should create runner', () => {
            mkRunnerStub_();

            return runHermione()
                .then(() => assert.calledOnce(Runner.create));
        });

        it('should create runner with config', () => {
            mkRunnerStub_();

            const config = makeConfigStub();
            Config.create.returns(config);

            return Hermione.create(config)
                .run(() => assert.calledWith(Runner.create, config));
        });

        it('should create runner with interceptors', async () => {
            mkRunnerStub_();

            const hermione = Hermione.create();
            const fooHandler = () => {};
            const barHandler = () => {};

            hermione
                .intercept('foo', fooHandler)
                .intercept('bar', barHandler);

            await hermione.run();

            assert.calledWith(Runner.create, sinon.match.any, [
                {event: 'foo', handler: fooHandler},
                {event: 'bar', handler: barHandler}
            ]);
        });

        it('should warn about unknown browsers from cli', () => {
            mkRunnerStub_();

            return runHermione([], {browsers: ['bro3']})
                .then(() => assert.calledWithMatch(logger.warn, /Unknown browser ids: bro3/));
        });

        it('should init runtime config', () => {
            mkRunnerStub_();

            return runHermione([], {updateRefs: true, inspectMode: {inspect: true}})
                .then(() => {
                    assert.calledOnce(RuntimeConfig.getInstance);
                    assert.calledOnceWith(
                        RuntimeConfig.getInstance.lastCall.returnValue.extend,
                        {updateRefs: true, inspectMode: {inspect: true}}
                    );
                });
        });

        describe('INIT', () => {
            beforeEach(() => mkRunnerStub_());

            it('should emit INIT on run', () => {
                const onInit = sinon.spy();
                const hermione = Hermione.create()
                    .on(RunnerEvents.INIT, onInit);

                return hermione.run()
                    .then(() => assert.calledOnce(onInit));
            });

            it('should reject on INIT handler fail', () => {
                const hermione = Hermione.create()
                    .on(RunnerEvents.INIT, () => q.reject('o.O'));

                return assert.isRejected(hermione.run(), /o.O/);
            });

            it('should wait INIT handler before running tests', () => {
                const afterInit = sinon.spy();
                const hermione = Hermione.create()
                    .on(RunnerEvents.INIT, () => q.delay(20).then(afterInit));

                return hermione.run()
                    .then(() => assert.callOrder(afterInit, Runner.prototype.run));
            });

            it('should send INIT event only once', () => {
                const onInit = sinon.spy().named('onInit');
                const hermione = Hermione.create();
                hermione.on(RunnerEvents.INIT, onInit);

                return hermione.run()
                    .then(() => hermione.run())
                    .then(() => assert.calledOnce(onInit));
            });
        });

        describe('reporters', () => {
            let Hermione;
            let attachRunner;
            let runner;

            const createReporter = () => {
                return function Reporter() {
                    this.attachRunner = attachRunner;
                };
            };

            beforeEach(() => {
                Hermione = proxyquire('lib/hermione', {
                    './reporters/reporter': createReporter()
                });

                runner = mkRunnerStub_();
                attachRunner = sandbox.stub();
            });

            it('should accept reporter specified as string', () => {
                const options = {reporters: ['reporter']};

                return Hermione.create()
                    .run(null, options)
                    .then(() => assert.calledOnceWith(attachRunner, runner));
            });

            it('should accept reporter specified as function', () => {
                const options = {reporters: [createReporter()]};

                return Hermione.create()
                    .run(null, options)
                    .then(() => assert.calledOnceWith(attachRunner, runner));
            });

            it('should fail if reporter was not found for given identifier', () => {
                const options = {reporters: ['unknown-reporter']};

                const hermione = Hermione.create();

                return assert.isRejected(hermione.run(null, options), 'No such reporter: unknown-reporter');
            });

            it('should fail if reporter is not string or function', () => {
                const options = {reporters: [1234]};

                const hermione = Hermione.create();

                return assert.isRejected(hermione.run(null, options), 'Reporter must be a string or a function');
            });
        });

        describe('reading the tests', () => {
            it('should read tests', async () => {
                const testPaths = ['foo/bar'];
                const browsers = ['bro1', 'bro2'];
                const grep = 'baz.*';
                const sets = ['set1', 'set2'];

                sandbox.spy(Hermione.prototype, 'readTests');

                await runHermione(testPaths, {browsers, grep, sets});

                assert.calledOnceWith(Hermione.prototype.readTests, testPaths, {browsers, grep, sets});
            });

            it('should accept test collection as first parameter', async () => {
                const testCollection = Object.create(TestCollection.prototype);
                sandbox.stub(Runner.prototype, 'run');

                await runHermione(testCollection);

                assert.calledOnceWith(Runner.prototype.run, testCollection);
            });

            it('should not read tests if test collection passed instead of paths', async () => {
                const testCollection = Object.create(TestCollection.prototype);
                sandbox.spy(Hermione.prototype, 'readTests');

                await runHermione(testCollection);

                assert.notCalled(Hermione.prototype.readTests);
            });
        });

        describe('running of tests', () => {
            it('should run tests', () => {
                mkRunnerStub_();

                return runHermione()
                    .then(() => assert.calledOnce(Runner.prototype.run));
            });

            it('should use read tests', async () => {
                mkRunnerStub_();

                const testCollection = TestCollection.create();
                sandbox.stub(Hermione.prototype, 'readTests').resolves(testCollection);

                await runHermione();

                assert.calledWith(Runner.prototype.run, testCollection);
            });

            it('should return "true" if there are no failed tests', () => {
                mkRunnerStub_();

                return runHermione()
                    .then((success) => assert.isTrue(success));
            });

            it('should return "false" if there are failed tests', () => {
                mkRunnerStub_((runner) => runner.emit(RunnerEvents.TEST_FAIL));

                return runHermione()
                    .then((success) => assert.isFalse(success));
            }) ;

            it('should halt if there were some errors', () => {
                const hermione = Hermione.create();
                const err = new Error();

                mkRunnerStub_((runner) => runner.emit(RunnerEvents.ERROR, err));

                return hermione.run()
                    .then(() => assert.calledOnceWith(hermione.halt, err));
            });
        });

        describe('should passthrough', () => {
            it('all synchronous runner events', () => {
                const runner = mkRunnerStub_();
                const hermione = Hermione.create(makeConfigStub());

                return hermione.run()
                    .then(() => {
                        _.forEach(RunnerEvents.getSync(), (event, name) => {
                            const spy = sinon.spy().named(`${name} handler`);
                            hermione.on(event, spy);

                            runner.emit(event);

                            assert.calledOnce(spy);
                        });
                    });
            });

            it('synchronous runner events before "Runner.run" called', () => {
                sandbox.stub(eventsUtils, 'passthroughEvent');
                const runner = mkRunnerStub_();
                const hermione = Hermione.create(makeConfigStub());

                return hermione.run()
                    .then(() => {
                        assert.calledWith(eventsUtils.passthroughEvent,
                            runner,
                            sinon.match.instanceOf(Hermione),
                            _.values(RunnerEvents.getSync())
                        );
                        assert.callOrder(eventsUtils.passthroughEvent, runner.run);
                    });
            });

            it('all asynchronous runner events', () => {
                const runner = mkRunnerStub_();
                const hermione = Hermione.create(makeConfigStub());

                return hermione.run()
                    .then(() => {
                        _.forEach(RunnerEvents.getAsync(), (event, name) => {
                            const spy = sinon.spy().named(`${name} handler`);
                            hermione.on(event, spy);

                            runner.emitAndWait(event);

                            assert.calledOnce(spy);
                        });
                    });
            });

            it('asynchronous runner events before "Runner.run" called', () => {
                sandbox.stub(eventsUtils, 'passthroughEventAsync');
                const runner = mkRunnerStub_();
                const hermione = Hermione.create(makeConfigStub());

                return hermione.run()
                    .then(() => {
                        assert.calledWith(eventsUtils.passthroughEventAsync,
                            runner,
                            sinon.match.instanceOf(Hermione),
                            _.values(RunnerEvents.getAsync())
                        );
                        assert.callOrder(eventsUtils.passthroughEventAsync, runner.run);
                    });
            });

            it('all runner events with passed event data', () => {
                const runner = mkRunnerStub_();
                const hermione = Hermione.create(makeConfigStub());

                return hermione.run()
                    .then(() => {
                        _.forEach(_.omit(hermione.events, ['EXIT', 'NEW_BROWSER']), (event, name) => {
                            const spy = sinon.spy().named(`${name} handler`);
                            hermione.on(event, spy);

                            runner.emit(event, 'some-data');

                            assert.calledWith(spy, 'some-data');
                        });
                    });
            });

            it('exit event from signalHandler', () => {
                mkRunnerStub_();

                const hermione = Hermione.create(makeConfigStub());
                const onExit = sinon.spy().named('onExit');

                return hermione.run()
                    .then(() => {
                        hermione.on('exit', onExit);

                        signalHandler.emitAndWait('exit');

                        assert.calledOnce(onExit);
                    });
            });

            it('exit event before "Runner.run" called', () => {
                sandbox.stub(eventsUtils, 'passthroughEventAsync');

                const runner = mkRunnerStub_();
                const hermione = Hermione.create(makeConfigStub());

                return hermione.run()
                    .then(() => {
                        assert.calledWith(eventsUtils.passthroughEventAsync,
                            sinon.match.instanceOf(AsyncEmitter),
                            sinon.match.instanceOf(Hermione),
                            RunnerEvents.EXIT
                        );
                        assert.callOrder(eventsUtils.passthroughEventAsync, runner.run);
                    });
            });
        });
    });

    describe('addTestToRun', () => {
        it('should pass test to the existing runner', async () => {
            const runner = mkRunnerStub_();
            const hermione = Hermione.create();
            const test = {};

            await hermione.run();
            hermione.addTestToRun(test, 'bro');

            assert.calledOnceWith(runner.addTestToRun, test, 'bro');
        });

        it('should return false when hermione is not running', () => {
            const runner = mkRunnerStub_();
            const hermione = Hermione.create();

            const added = hermione.addTestToRun({});

            assert.isFalse(added);
            assert.notCalled(runner.addTestToRun);
        });
    });

    describe('readTests', () => {
        beforeEach(() => {
            sandbox.spy(TestReader, 'create');

            sandbox.stub(TestCollection, 'create').returns(Object.create(TestCollection.prototype));
        });

        it('should create test reader', async () => {
            const config = makeConfigStub();
            Config.create.returns(config);

            const hermione = Hermione.create(config);

            await hermione.readTests();

            assert.calledOnceWith(TestReader.create, config);
        });

        [
            'BEFORE_FILE_READ',
            'AFTER_FILE_READ'
        ].forEach((event) => {
            it(`should passthrough ${event} event from test reader`, async () => {
                const eventHandler = sandbox.stub();
                const hermione = Hermione.create(makeConfigStub())
                    .on(RunnerEvents[event], eventHandler);

                TestReader.prototype.read.callsFake(function() {
                    this.emit(RunnerEvents[event], {foo: 'bar'});
                });

                await hermione.readTests();

                assert.calledOnceWith(eventHandler, {foo: 'bar'});
            });

            it(`should not passthrough ${event} event from test reader with silent option`, async () => {
                const eventHandler = sandbox.stub();
                const hermione = Hermione.create(makeConfigStub())
                    .on(RunnerEvents[event], eventHandler);

                TestReader.prototype.read.callsFake(function() {
                    this.emit(RunnerEvents[event]);
                });

                await hermione.readTests(null, {silent: true});

                assert.notCalled(eventHandler);
            });
        });

        it('should read passed test files', async () => {
            const hermione = Hermione.create(makeConfigStub());

            await hermione.readTests(
                ['foo/bar'],
                {
                    browsers: ['bro'],
                    ignore: 'baz/qux',
                    sets: ['s1', 's2'],
                    grep: 'grep'
                }
            );

            assert.calledOnceWith(TestReader.prototype.read, {
                paths: ['foo/bar'],
                browsers: ['bro'],
                ignore: 'baz/qux',
                sets: ['s1', 's2'],
                grep: 'grep'
            });
        });

        it('should return TestCollection', async () => {
            const tests = {someBro: ['test', 'otherTest']};

            TestReader.prototype.read.returns(tests);
            const testCollection = TestCollection.create();
            TestCollection.create.withArgs(tests).returns(testCollection);

            const hermione = Hermione.create(makeConfigStub());
            const result = await hermione.readTests();

            assert.equal(result, testCollection);
        });

        describe('INIT', () => {
            it('should emit INIT on read', async () => {
                const onInit = sinon.spy();
                const hermione = Hermione.create()
                    .on(RunnerEvents.INIT, onInit);

                await hermione.readTests();

                assert.calledOnce(onInit);
            });

            it('should reject on INIT handler fail', () => {
                const hermione = Hermione.create()
                    .on(RunnerEvents.INIT, () => Promise.reject('o.O'));

                return assert.isRejected(hermione.readTests(), /o.O/);
            });

            it('should wait INIT handler before reading tests', async () => {
                const afterInit = sinon.spy();
                const hermione = Hermione.create()
                    .on(RunnerEvents.INIT, () => Promise.delay(20).then(afterInit));

                await hermione.readTests();

                assert.callOrder(afterInit, TestReader.prototype.read);
            });

            it('should not emit INIT on silent read', async () => {
                const onInit = sinon.spy();
                const hermione = Hermione.create()
                    .on(RunnerEvents.INIT, onInit);

                await hermione.readTests(null, {silent: true});

                assert.notCalled(onInit);
            });

            it('should send INIT event only once', async () => {
                const onInit = sinon.spy();
                const hermione = Hermione.create();
                hermione.on(RunnerEvents.INIT, onInit);

                await hermione.readTests();
                await hermione.readTests();

                assert.calledOnce(onInit);
            });
        });

        describe('AFTER_TESTS_READ', () => {
            it('should emit AFTER_TESTS_READ on read', async () => {
                const onAfterTestsRead = sinon.spy();
                const hermione = Hermione.create()
                    .on(RunnerEvents.AFTER_TESTS_READ, onAfterTestsRead);

                await hermione.readTests();

                assert.calledOnce(onAfterTestsRead);
            });

            it('should pass test collection with AFTER_TESTS_READ event', async () => {
                const onAfterTestsRead = sinon.spy();
                const hermione = Hermione.create()
                    .on(RunnerEvents.AFTER_TESTS_READ, onAfterTestsRead);

                const collection = await hermione.readTests();

                assert.calledWith(onAfterTestsRead, collection);
            });

            it('should not emit AFTER_TESTS_READ in silent mode', async () => {
                const onAfterTestsRead = sinon.spy();
                const hermione = Hermione.create()
                    .on(RunnerEvents.AFTER_TESTS_READ, onAfterTestsRead);

                await hermione.readTests(null, {silent: true});

                assert.notCalled(onAfterTestsRead);
            });
        });
    });

    describe('should provide access to', () => {
        it('hermione events', () => {
            const expectedEvents = _.extend({NEW_BROWSER: 'newBrowser'}, RunnerEvents);

            assert.deepEqual(Hermione.create(makeConfigStub()).events, expectedEvents);
        });

        it('hermione configuration', () => {
            const config = {foo: 'bar'};

            Config.create.returns(config);

            assert.deepEqual(Hermione.create().config, config);
        });

        it('hermione errors', () => {
            assert.deepEqual(Hermione.create().errors, Errors);
        });
    });

    describe('isFailed', () => {
        it('should return "false" by default', () => {
            assert.isFalse(Hermione.create(makeConfigStub()).isFailed());
        });

        it('should return "false" if there are no failed tests or errors', () => {
            mkRunnerStub_();

            const hermione = Hermione.create(makeConfigStub());

            return hermione.run()
                .then(() => assert.isFalse(hermione.isFailed()));
        });

        it('should return "true" after some test fail', () => {
            const hermione = Hermione.create(makeConfigStub());

            mkRunnerStub_((runner) => {
                runner.emit(RunnerEvents.TEST_FAIL);

                assert.isTrue(hermione.isFailed());
            });

            return hermione.run();
        });
    });

    describe('isWorker', () => {
        it('should return "false"', () => {
            const hermione = Hermione.create();

            assert.isFalse(hermione.isWorker());
        });
    });

    describe('halt', () => {
        let hermione;

        beforeEach(() => {
            hermione = Hermione.create();

            sandbox.stub(logger, 'error');
            sandbox.stub(process, 'exit');
            sandbox.stub(Runner.prototype, 'run').callsFake(() => hermione.emitAndWait(RunnerEvents.RUNNER_START));
            sandbox.stub(Runner.prototype, 'cancel');
        });

        it('should log provided error', () => {
            hermione.on(RunnerEvents.RUNNER_START, () => {
                hermione.halt(new Error('test error'));
            });

            return hermione.run()
                .finally(() => {
                    assert.calledOnceWith(logger.error, sinon.match(/Error: test error/));
                });
        });

        it('should cancel test runner', () => {
            hermione.on(RunnerEvents.RUNNER_START, () => {
                hermione.halt(new Error('test error'));
            });

            return hermione.run()
                .finally(() => {
                    assert.calledOnce(Runner.prototype.cancel);
                });
        });

        it('should mark test run as failed', () => {
            hermione.on(RunnerEvents.RUNNER_START, () => {
                hermione.halt(new Error('test error'));
            });

            return hermione.run()
                .finally(() => {
                    assert.isTrue(hermione.isFailed());
                });
        });

        describe('shutdown timeout', () => {
            it('should force exit if timeout is reached', () => {
                hermione.on(RunnerEvents.RUNNER_START, () => {
                    hermione.halt(new Error('test error'), 250);
                });

                return hermione.run()
                    .finally(() => Promise.delay(300))
                    .then(() => {
                        assert.calledWithMatch(logger.error, /Forcing shutdown.../);
                        assert.calledOnceWith(process.exit, 1);
                    });
            });

            it('should do nothing if timeout is set to zero', () => {
                sandbox.spy(global, 'setTimeout');
                hermione.on(RunnerEvents.RUNNER_START, () => {
                    hermione.halt(new Error('test error'), 0);
                });

                return hermione.run()
                    .finally(() => {
                        assert.notCalled(global.setTimeout);
                    });
            });
        });
    });
});
