'use strict';

const EventEmitter = require('events').EventEmitter;
const pluginsLoader = require('plugins-loader');
const proxyquire = require('proxyquire');
const q = require('q');
const Config = require('../../lib/config');
const RunnerEvents = require('../../lib/constants/runner-events');
const RunnerFacade = require('../../lib/hermione-facade');
const Runner = require('../../lib/runner');
const makeConfigStub = require('../utils').makeConfigStub;

describe('hermione', () => {
    const sandbox = sinon.sandbox.create();

    let Hermione;
    let testsReader;

    beforeEach(() => {
        testsReader = sandbox.stub().returns(q());

        Hermione = proxyquire('../../lib/hermione', {
            './tests-reader': testsReader
        });

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

        describe('loading of plugins', () => {
            it('should load plugins', () => {
                return runHermione()
                    .then(() => assert.calledOnce(pluginsLoader.load));
            });

            it('should load plugins for hermione facade instance', () => {
                const config = makeConfigStub();
                const runner = stubRunner();

                Config.create.returns(config);

                return runHermione()
                    .then(() => assert.calledWith(pluginsLoader.load, new RunnerFacade(runner, config)));
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

        describe('reading of tests', () => {
            it('should read tests', () => {
                return runHermione()
                    .then(() => assert.calledOnce(testsReader));
            });

            it('should pass paths to a tests reader', () => {
                return runHermione(['first.js', 'second.js'])
                    .then(() => assert.calledWith(testsReader, ['first.js', 'second.js']));
            });

            it('should pass browsers to a tests reader', () => {
                return runHermione(null, {browsers: ['bro1', 'bro2']})
                    .then(() => assert.calledWith(testsReader, sinon.match.any, ['bro1', 'bro2']));
            });

            it('should pass config to a tests reader', () => {
                const config = makeConfigStub();
                Config.create.returns(config);

                return runHermione()
                    .then(() => assert.calledWith(testsReader, sinon.match.any, sinon.match.any, config));
            });

            it('should extend config with pass mocha options before reading of tests', () => {
                return runHermione(null, {grep: 'some-pattern'})
                    .then(() => {
                        const config = testsReader.lastCall.args[2];
                        assert.deepPropertyVal(config, 'system.mochaOpts.grep', 'some-pattern');
                    });
            });
        });

        describe('running of tests', () => {
            it('should run tests', () => {
                stubRunner();

                return runHermione()
                    .then(() => assert.calledOnce(Runner.prototype.run));
            });

            it('should run read tests', () => {
                stubRunner();

                testsReader.returns(q(['first.js', 'second.js']));

                return runHermione()
                    .then(() => assert.calledWith(Runner.prototype.run, ['first.js', 'second.js']));
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

        it('should read test files using specified paths, browsers and config', () => {
            const config = makeConfigStub();
            Config.create.returns(config);

            return Hermione
                .create(config)
                .readTests(['some/path'], ['bro1', 'bro2'])
                .then(() => assert.calledWith(testsReader, ['some/path'], ['bro1', 'bro2'], config));
        });

        it('should build suite tree using tests', () => {
            const config = makeConfigStub();
            Config.create.returns(config);

            testsReader.returns(q(['some/path/file.js']));

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
