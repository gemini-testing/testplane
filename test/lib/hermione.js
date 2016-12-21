'use strict';

const EventEmitter = require('events').EventEmitter;
const pluginsLoader = require('plugins-loader');
const q = require('q');
const Config = require('../../lib/config');
const Hermione = require('../../lib/hermione');
const RunnerEvents = require('../../lib/constants/runner-events');
const RunnerFacade = require('../../lib/hermione-facade');
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
        beforeEach(() => sandbox.stub(Runner, 'create').returns(sinon.createStubInstance(Runner)));

        const stubRunner = (runFn) => {
            const runner = new EventEmitter();

            runner.run = sandbox.stub(Runner.prototype, 'run', runFn && runFn.bind(null, runner));
            Runner.create.returns(runner);
            return runner;
        };

        const runHermione = (paths, opts) => Hermione.create().run(paths, opts);

        it('should create runner', () => {
            return runHermione()
                .then(() => assert.calledOnce(Runner.create));
        });

        it('should create runner with config', () => {
            const config = makeConfigStub();
            Config.create.returns(config);

            return runHermione()
                .then(() => assert.calledWith(Runner.create, config));
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

            it('should load plugins for hermione facade instance', () => {
                const config = makeConfigStub();

                Config.create.returns(config);

                return runHermione()
                    .then(() => assert.calledWith(pluginsLoader.load, sinon.match.instanceOf(RunnerFacade)));
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
                stubRunner();

                return runHermione()
                    .then(() => assert.calledOnce(Runner.prototype.run));
            });

            it('should use revealed sets', () => {
                stubRunner();

                sets.reveal.returns(q({bro: ['some/path/file.js']}));

                return runHermione()
                    .then(() => assert.calledWith(Runner.prototype.run, {bro: ['some/path/file.js']}));
            });

            it('should return "true" if there are no failed tests', () => {
                return runHermione()
                    .then((success) => assert.isTrue(success));
            });

            it('should return "false" if there are failed suites', () => {
                stubRunner((runner) => runner.emit(RunnerEvents.SUITE_FAIL));

                return runHermione()
                    .then((success) => assert.isFalse(success));
            });

            it('should return "false" if there are failed tests', () => {
                stubRunner((runner) => runner.emit(RunnerEvents.TEST_FAIL));

                return runHermione()
                    .then((success) => assert.isFalse(success));
            }) ;

            it('should return "false" if there were some errors', () => {
                stubRunner((runner) => runner.emit(RunnerEvents.ERROR));

                return runHermione()
                    .then((success) => assert.isFalse(success));
            });
        });
    });

    describe('readTests', () => {
        beforeEach(() => sandbox.stub(Runner.prototype, 'buildSuiteTree'));

        it('should create runner with specified config', () => {
            const config = makeConfigStub();
            const createRunner = sandbox.spy(Runner, 'create');
            Config.create.returns(config);

            return Hermione
                .create(config)
                .readTests()
                .then(() => {
                    assert.calledOnce(createRunner);
                    assert.calledWith(createRunner, config);
                });
        });

        it('should reveal sets using specified paths, browsers and sets from config', () => {
            const config = makeConfigStub({sets: {all: {}}});
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
                .create(config)
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
});
