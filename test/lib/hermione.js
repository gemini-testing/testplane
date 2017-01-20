'use strict';

const _ = require('lodash');
const qUtils = require('qemitter/utils');
const QEmitter = require('qemitter');
const EventEmitter = require('events').EventEmitter;
const pluginsLoader = require('plugins-loader');
const q = require('q');

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

    beforeEach(() => {
        sandbox.stub(sets, 'reveal').returns(q());

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

        const mkRunnerStub_ = (runFn) => {
            const runner = new QEmitter();

            runner.run = sandbox.stub(Runner.prototype, 'run', runFn && runFn.bind(null, runner));
            sandbox.stub(Runner, 'create').returns(runner);
            return runner;
        };

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

                sets.reveal.returns(q({bro: ['some/path/file.js']}));

                return runHermione()
                    .then(() => assert.calledWith(Runner.prototype.run, {bro: ['some/path/file.js']}));
            });

            it('should return "true" if there are no failed tests', () => {
                return runHermione()
                    .then((success) => assert.isTrue(success));
            });

            it('should return "false" if there are failed suites', () => {
                mkRunnerStub_((runner) => runner.emit(RunnerEvents.SUITE_FAIL));

                return runHermione()
                    .then((success) => assert.isFalse(success));
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
                sandbox.stub(qUtils, 'passthroughEvent');
                const runner = mkRunnerStub_();
                const hermione = Hermione.create(makeConfigStub());

                return hermione.run()
                    .then(() => {
                        assert.calledWith(qUtils.passthroughEvent,
                            runner,
                            sinon.match.instanceOf(Hermione),
                            _.values(RunnerEvents.getSync())
                        );
                        assert.callOrder(qUtils.passthroughEvent, runner.run);
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
                sandbox.stub(qUtils, 'passthroughEventAsync');
                const runner = mkRunnerStub_();
                const hermione = Hermione.create(makeConfigStub());

                return hermione.run()
                    .then(() => {
                        assert.calledWith(qUtils.passthroughEventAsync,
                            runner,
                            sinon.match.instanceOf(Hermione),
                            _.values(RunnerEvents.getAsync())
                        );
                        assert.callOrder(qUtils.passthroughEventAsync, runner.run);
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
                sandbox.stub(qUtils, 'passthroughEventAsync');

                const runner = mkRunnerStub_();
                const hermione = Hermione.create(makeConfigStub());

                return hermione.run()
                    .then(() => {
                        assert.calledWith(qUtils.passthroughEventAsync,
                            sinon.match.instanceOf(QEmitter),
                            sinon.match.instanceOf(Hermione),
                            RunnerEvents.EXIT
                        );
                        assert.callOrder(qUtils.passthroughEventAsync, runner.run);
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
            const hermione = Hermione.create(makeConfigStub());
            const expectedEvents = _.extend({EXIT: 'exit'}, RunnerEvents);

            assert.deepEqual(hermione.events, expectedEvents);
        });

        it('hermione configuration', () => {
            const config = makeConfigStub();
            const hermione = Hermione.create(config);

            assert.deepEqual(hermione.config, config);
        });
    });
});
