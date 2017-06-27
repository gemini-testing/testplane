'use strict';

const _ = require('lodash');
const Promise = require('bluebird');
const pluginsLoader = require('plugins-loader');
const EventEmitter = require('events').EventEmitter;
const AsyncEmitter = require('gemini-core').AsyncEmitter;
const PassthroughEmitter = require('gemini-core').PassthroughEmitter;

const Config = require('../../lib/config');
const Hermione = require('../../lib/hermione');
const RunnerEvents = require('../../lib/constants/runner-events');
const signalHandler = require('../../lib/signal-handler');
const Runner = require('../../lib/runner');
const sets = require('../../lib/sets');
const logger = require('../../lib/utils').logger;
const makeConfigStub = require('../utils').makeConfigStub;

describe('hermione', () => {
    const sandbox = sinon.sandbox.create();

    const mkRunnerStub_ = (runFn) => {
        const runner = new PassthroughEmitter();

        runner.run = sandbox.stub(Runner.prototype, 'run').callsFake(runFn && runFn.bind(null, runner));
        sandbox.stub(Runner, 'create').returns(runner);
        return runner;
    };

    beforeEach(() => {
        sandbox.stub(sets, 'reveal').returns(Promise.resolve());

        sandbox.stub(logger, 'warn');
        sandbox.stub(Config, 'create').returns(makeConfigStub());

        sandbox.stub(pluginsLoader, 'load');
    });

    afterEach(() => sandbox.restore());

    describe('constructor', () => {
        beforeEach(() => {
            sandbox.stub(Runner, 'create').returns(new EventEmitter());
        });

        it('should create config', () => {
            Hermione.create();

            assert.calledOnce(Config.create);
        });

        it('should create config from passed path', () => {
            Hermione.create('.hermione.conf.js');

            assert.calledWith(Config.create, '.hermione.conf.js');
        });

        it('should create config from passed object', () => {
            Hermione.create({some: 'config'});

            assert.calledWith(Config.create, {some: 'config'});
        });

        it('should create config with passed options', () => {
            Hermione.create(null, {some: 'options'});

            assert.calledWith(Config.create, sinon.match.any, {some: 'options'});
        });
    });

    describe('run', () => {
        const runHermione = (paths, opts) => Hermione.create().run(paths, opts);

        it('should create runner', () => {
            mkRunnerStub_();

            return Hermione.create(makeConfigStub())
                .run(() => assert.calledOnce(Runner.create));
        });

        it('should create runner with config', () => {
            mkRunnerStub_();

            const config = makeConfigStub();
            Config.create.returns(config);

            return Hermione.create(config)
                .run(() => assert.calledWith(Runner.create, config));
        });

        it('should warn about unknown browsers from cli', () => {
            return runHermione([], {browsers: ['bro3']})
                .then(() => assert.calledWithMatch(logger.warn, /Unknown browser ids: bro3/));
        });

        describe('loading of plugins', () => {
            it('should load plugins', () => {
                return runHermione()
                    .then(() => assert.calledOnce(pluginsLoader.load));
            });

            it('should load plugins for hermione instance', () => {
                return runHermione()
                    .then(() => assert.calledWith(pluginsLoader.load, sinon.match.instanceOf(Hermione)));
            });

            it('should load plugins from config', () => {
                Config.create.returns(makeConfigStub({plugins: {'some-plugin': true}}));

                return runHermione()
                    .then(() => assert.calledWith(pluginsLoader.load, sinon.match.any, {'some-plugin': true}));
            });

            it('should load plugins with appropriate prefix', () => {
                return runHermione()
                    .then(() => assert.calledWith(pluginsLoader.load, sinon.match.any, sinon.match.any, 'hermione-'));
            });

            it('should load plugins before creating any runner', () => {
                sandbox.spy(Runner, 'create');

                return runHermione()
                    .then(() => assert.callOrder(pluginsLoader.load, Runner.create));
            });
        });

        describe('sets revealing', () => {
            it('should reveal sets', () => {
                return runHermione()
                    .then(() => assert.calledOnce(sets.reveal));
            });

            it('should reveal sets using passed paths', () => {
                return runHermione(['first.js', 'second.js'])
                    .then(() => assert.calledWith(sets.reveal, sinon.match.any, {paths: ['first.js', 'second.js']}));
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

                sets.reveal.returns(Promise.resolve({bro: ['some/path/file.js']}));

                return runHermione()
                    .then(() => assert.calledWith(Runner.prototype.run, {bro: ['some/path/file.js']}));
            });

            it('should return "true" if there are no failed tests', () => {
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
            it('all runner events', () => {
                const runner = mkRunnerStub_();
                const hermione = Hermione.create(makeConfigStub());

                return hermione.run()
                    .then(() => {
                        _.forEach(RunnerEvents.getAll(), (event, name) => {
                            const spy = sinon.spy().named(`${name} handler`);
                            hermione.on(event, spy);

                            _.has(RunnerEvents.getAsync(), name)
                                ? runner.emitAndWait(event)
                                : runner.emit(event);

                            assert.calledOnce(spy);
                        });
                    });
            });

            it('all runner events before "Runner.run" called', () => {
                const runner = mkRunnerStub_();
                const hermione = Hermione.create(makeConfigStub());
                sandbox.stub(hermione, 'passthroughEvent');

                return hermione.run()
                    .then(() => {
                        assert.calledWith(hermione.passthroughEvent,
                            runner,
                            _.values(RunnerEvents.getAll())
                        );
                        assert.callOrder(hermione.passthroughEvent, runner.run);
                    });
            });

            it('all runner events with passed event data', () => {
                const runner = mkRunnerStub_();
                const hermione = Hermione.create(makeConfigStub());

                return hermione.run()
                    .then(() => {
                        _.forEach(_.omit(hermione.events, 'EXIT'), (event, name) => {
                            const spy = sinon.spy().named(`${name} handler`);
                            hermione.on(event, spy);

                            runner.emit(event, 'some-data');

                            assert.calledWith(spy, 'some-data');
                        });
                    });
            });

            it('"exit" event from signalHandler', () => {
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
                const runner = mkRunnerStub_();
                const hermione = Hermione.create(makeConfigStub());

                sandbox.stub(hermione, 'passthroughEvent');

                return hermione.run()
                    .then(() => {
                        assert.calledWith(hermione.passthroughEvent,
                            sinon.match.instanceOf(AsyncEmitter),
                            RunnerEvents.EXIT
                        );
                        assert.callOrder(hermione.passthroughEvent, runner.run);
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

        it('should load plugins from config', () => {
            Config.create.returns(makeConfigStub({plugins: {'some-plugin': {}}}));

            return Hermione
                .create(Config.create())
                .readTests()
                .then(() => {
                    assert.calledWith(
                        pluginsLoader.load,
                        sinon.match.instanceOf(Hermione), {'some-plugin': {}}
                    );
                });
        });

        it('should not load plugins from config if option "loadPlugins" is set to "false"', () => {
            Config.create.returns(makeConfigStub({plugins: {'some-plugin': {}}}));

            return Hermione
                .create(Config.create())
                .readTests(null, null, {loadPlugins: false})
                .then(() => assert.notCalled(pluginsLoader.load));
        });

        it('should not passthrough synchronous runner events if option "loadPlugins" is set to "false"', () => {
            const runner = mkRunnerStub_();
            runner.buildSuiteTree = () => Promise.resolve({});
            const hermione = Hermione.create(makeConfigStub());

            return hermione.readTests(null, null, {loadPlugins: false})
                .then(() => {
                    _.forEach(RunnerEvents.getSync(), (event, name) => {
                        const spy = sinon.spy().named(`${name} handler`);
                        hermione.on(event, spy);

                        runner.emit(event);

                        assert.notCalled(spy);
                    });
                });
        });

        it('should build suite tree using tests', () => {
            const config = makeConfigStub();
            Config.create.returns(config);

            sets.reveal.returns(Promise.resolve(['some/path/file.js']));

            return Hermione
                .create(makeConfigStub())
                .readTests()
                .then(() => assert.calledOnceWith(Runner.prototype.buildSuiteTree, ['some/path/file.js']));
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
            const hermione = Hermione.create(makeConfigStub());
            const expectedEvents = _.extend({EXIT: 'exit'}, RunnerEvents);

            assert.deepEqual(hermione.events, expectedEvents);
        });

        it('hermione configuration', () => {
            const config = {foo: 'bar'};

            Config.create.returns(config);

            const hermione = Hermione.create();

            assert.deepEqual(hermione.config, config);
        });
    });

    describe('isFailed', () => {
        it('should return "false" by default', () => {
            assert.isFalse(Hermione.create(makeConfigStub()).isFailed());
        });

        it('should return "false" if there are no failed tests or errors', () => {
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
});
