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
const Hermione = require('lib/hermione');
const RunnerEvents = require('lib/constants/runner-events');
const signalHandler = require('lib/signal-handler');
const Runner = require('lib/runner');
const sets = require('lib/sets');
const logger = require('lib/utils/logger');
const {makeConfigStub} = require('../utils');

describe('hermione', () => {
    const sandbox = sinon.sandbox.create();

    const mkRunnerStub_ = (runFn) => {
        const runner = new AsyncEmitter();

        runner.run = sandbox.stub(Runner.prototype, 'run').callsFake(runFn && runFn.bind(null, runner));
        sandbox.stub(Runner, 'create').returns(runner);
        return runner;
    };

    beforeEach(() => {
        sandbox.stub(sets, 'reveal').returns(q());

        sandbox.stub(logger, 'warn');
        sandbox.stub(Config, 'create').returns(makeConfigStub());

        sandbox.stub(pluginsLoader, 'load').returns([]);

        sandbox.stub(RuntimeConfig, 'getInstance').returns({extend: sandbox.stub()});
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

        it('should warn about unknown browsers from cli', () => {
            mkRunnerStub_();

            return runHermione([], {browsers: ['bro3']})
                .then(() => assert.calledWithMatch(logger.warn, /Unknown browser ids: bro3/));
        });

        it('should init runtime config', () => {
            mkRunnerStub_();

            return runHermione([], {updateRefs: true})
                .then(() => {
                    assert.calledOnce(RuntimeConfig.getInstance);
                    assert.calledOnceWith(RuntimeConfig.getInstance.lastCall.returnValue.extend, {updateRefs: true});
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

            it('should throw if reporter was not found for given identifier', () => {
                const options = {reporters: ['unknown-reporter']};

                const run = () => Hermione.create().run(null, options);

                assert.throws(run, 'No such reporter: unknown-reporter');
            });

            it('should throw if reporter is not string or function', () => {
                const options = {reporters: [1234]};

                const run = () => Hermione.create().run(null, options);

                assert.throws(run, TypeError, 'Reporter must be a string or a function');
            });
        });

        describe('sets revealing', () => {
            beforeEach(() => mkRunnerStub_());

            it('should reveal sets', () => {
                return runHermione()
                    .then(() => assert.calledOnce(sets.reveal));
            });

            it('should reveal sets using passed paths', () => {
                return runHermione(['first.js', 'second.js'])
                    .then(() => {
                        assert.calledWith(sets.reveal, sinon.match.any, sinon.match({paths: ['first.js', 'second.js']}));
                    });
            });

            it('should reveal sets using passed browsers', () => {
                return runHermione(null, {browsers: ['bro1', 'bro2']})
                    .then(() => assert.calledWithMatch(sets.reveal, sinon.match.any, {browsers: ['bro1', 'bro2']}));
            });

            it('should reveal sets using passed sets from config', () => {
                const config = makeConfigStub({sets: {all: {}}});
                Config.create.returns(config);

                return runHermione()
                    .then(() => assert.calledWith(sets.reveal, config.sets));
            });
        });

        describe('running of tests', () => {
            it('should run tests', () => {
                mkRunnerStub_();

                return runHermione()
                    .then(() => assert.calledOnce(Runner.prototype.run));
            });

            it('should use revealed sets', () => {
                mkRunnerStub_();

                sets.reveal.returns(q({bro: ['some/path/file.js']}));

                return runHermione()
                    .then(() => assert.calledWith(Runner.prototype.run, {bro: ['some/path/file.js']}));
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

            it('should return "false" if there were some errors', () => {
                mkRunnerStub_((runner) => runner.emit(RunnerEvents.ERROR));

                return runHermione()
                    .then((success) => assert.isFalse(success));
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

    describe('readTests', () => {
        beforeEach(() => sandbox.stub(Runner.prototype, 'buildSuiteTree'));

        it('should read test files using specified paths, browsers and config', () => {
            const config = makeConfigStub();
            Config.create.returns(config);

            return Hermione
                .create(config)
                .readTests(['some/path'], ['bro1', 'bro2'])
                .then(() => {
                    assert.calledWith(sets.reveal, config.sets, {paths: ['some/path'], browsers: ['bro1', 'bro2']});
                });
        });

        it('should passthrough all synchronous runner events', () => {
            const runner = mkRunnerStub_();
            runner.buildSuiteTree = () => Promise.resolve({});
            const hermione = Hermione.create(makeConfigStub());

            return hermione.readTests()
                .then(() => {
                    _.forEach(RunnerEvents.getSync(), (event, name) => {
                        const spy = sinon.spy().named(`${name} handler`);
                        hermione.on(event, spy);

                        runner.emit(event);

                        assert.calledOnce(spy);
                    });
                });
        });

        it('should not passthrough runner events on silent read', () => {
            const runner = mkRunnerStub_();
            runner.buildSuiteTree = () => Promise.resolve({});
            const hermione = Hermione.create(makeConfigStub());

            return hermione.readTests(null, null, {silent: true})
                .then(() => {
                    _.forEach(RunnerEvents.getSync(), (event, name) => {
                        const spy = sinon.spy().named(`${name} handler`);
                        hermione.on(event, spy);

                        runner.emit(event);

                        assert.notCalled(spy);
                    });
                });
        });

        describe('INIT', () => {
            it('should emit INIT on read', () => {
                const onInit = sinon.spy();
                const hermione = Hermione.create()
                    .on(RunnerEvents.INIT, onInit);

                return hermione.readTests()
                    .then(() => assert.calledOnce(onInit));
            });

            it('should reject on INIT handler fail', () => {
                const hermione = Hermione.create()
                    .on(RunnerEvents.INIT, () => q.reject('o.O'));

                return assert.isRejected(hermione.readTests(), /o.O/);
            });

            it('should wait INIT handler before reading tests', () => {
                const afterInit = sinon.spy();
                const hermione = Hermione.create()
                    .on(RunnerEvents.INIT, () => q.delay(20).then(afterInit));

                return hermione.readTests()
                    .then(() => assert.callOrder(afterInit, Runner.prototype.buildSuiteTree));
            });

            it('should not emit INIT on silent read', () => {
                const onInit = sinon.spy();
                const hermione = Hermione.create()
                    .on(RunnerEvents.INIT, onInit);

                return hermione.readTests(null, null, {silent: true})
                    .then(() => assert.notCalled(onInit));
            });

            it('should send INIT event only once', () => {
                const onInit = sinon.spy();
                const hermione = Hermione.create();
                hermione.on(RunnerEvents.INIT, onInit);

                return hermione.readTests()
                    .then(() => hermione.readTests())
                    .then(() => assert.calledOnce(onInit));
            });
        });

        it('should build suite tree using tests', () => {
            const config = makeConfigStub();
            Config.create.returns(config);

            sets.reveal.returns(q(['some/path/file.js']));

            return Hermione
                .create(makeConfigStub())
                .readTests()
                .then(() => {
                    assert.calledOnce(Runner.prototype.buildSuiteTree);
                    assert.calledWith(Runner.prototype.buildSuiteTree, ['some/path/file.js']);
                });
        });

        it('should return suite tree for specified browsers', () => {
            const suiteTreeStub = {};
            Runner.prototype.buildSuiteTree.returns({bro: suiteTreeStub});

            return Hermione
                .create()
                .readTests()
                .then((suiteTree) => assert.deepEqual(suiteTree, {bro: suiteTreeStub}));
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

        it('should return "true" after some error', () => {
            const hermione = Hermione.create(makeConfigStub());

            mkRunnerStub_((runner) => {
                runner.emit(RunnerEvents.ERROR);

                assert.isTrue(hermione.isFailed());
            });

            return hermione.run();
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
