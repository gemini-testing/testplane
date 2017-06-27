'use strict';

const EventEmitter = require('events').EventEmitter;
const Promise = require('bluebird');
const BrowserAgent = require('gemini-core').BrowserAgent;
const RunnerEvents = require('../../../../lib/constants/runner-events');
const MochaRunner = require('../../../../lib/runner/mocha-runner');
const RetryMochaRunner = require('../../../../lib/runner/mocha-runner/retry-mocha-runner');
const TestSkipper = require('../../../../lib/runner/test-skipper');
const MochaBuilder = require('../../../../lib/runner/mocha-runner/mocha-builder');
const MochaStub = require('../../_mocha');
const makeConfigStub = require('../../../utils').makeConfigStub;

describe('mocha-runner', () => {
    const sandbox = sinon.sandbox.create();

    const createMochaStub_ = () => {
        const mocha = new MochaStub();
        mocha.disableHooksInSkippedSuites = sandbox.stub();
        return mocha;
    };

    const createMochaRunner_ = () => {
        return new MochaRunner(
            'bro',
            makeConfigStub({browsers: ['bro']}),
            sinon.createStubInstance(BrowserAgent),
            sinon.createStubInstance(TestSkipper)
        );
    };

    const init_ = (suites) => createMochaRunner_().init(suites || ['test_suite']);
    const run_ = (suites) => init_(suites).run();

    beforeEach(() => {
        sandbox.stub(RetryMochaRunner.prototype, 'run');

        sandbox.stub(MochaBuilder, 'prepare');
        sandbox.stub(MochaBuilder.prototype, 'buildAdapters').returns([]);
        sandbox.stub(MochaBuilder.prototype, 'buildSingleAdapter');
    });

    afterEach(() => sandbox.restore());

    describe('constructor', () => {
        it('should create mocha adapter builder', () => {
            sandbox.spy(MochaBuilder, 'create');

            MochaRunner.create('bro', makeConfigStub({system: {foo: 'bar'}}), {browser: 'pool'}, {test: 'skipper'});

            assert.calledOnceWith(MochaBuilder.create, 'bro', {foo: 'bar'}, {browser: 'pool'}, {test: 'skipper'});
        });

        describe('should passthrough events from a mocha builder', () => {
            const events = [
                RunnerEvents.BEFORE_FILE_READ,
                RunnerEvents.AFTER_FILE_READ
            ];

            events.forEach((event) => {
                it(`${event}`, () => {
                    const mochaBuilder = new EventEmitter();
                    sandbox.stub(MochaBuilder, 'create').returns(mochaBuilder);

                    const mochaRunner = createMochaRunner_();
                    const spy = sinon.spy();

                    mochaRunner.on(event, spy);
                    mochaBuilder.emit(event, 'some-data');

                    assert.calledOnceWith(spy, 'some-data');
                });
            });
        });
    });

    describe('prepare', () => {
        it('should prepare mocha builder', () => {
            MochaRunner.prepare();

            assert.calledOnce(MochaBuilder.prepare);
        });
    });

    describe('init', () => {
        it('should pass files to mocha adapter builder', () => {
            init_(['some/file', 'other/file']);

            assert.calledOnceWith(MochaBuilder.prototype.buildAdapters, ['some/file', 'other/file']);
        });

        it('should return an instance of mocha runner', () => {
            const mochaRunner = createMochaRunner_();

            assert.deepEqual(mochaRunner.init(), mochaRunner);
        });

        it('should throw in case of duplicate test titles in mocha adapters in different files', () => {
            const mocha1 = createMochaStub_();
            const mocha2 = createMochaStub_();

            mocha1.updateSuiteTree((suite) => {
                return suite
                    .addTest({title: 'some test', file: 'first file'});
            });

            mocha2.updateSuiteTree((suite) => {
                return suite
                    .addTest({title: 'some test', file: 'second file'});
            });

            MochaBuilder.prototype.buildAdapters.returns([mocha1, mocha2]);

            assert.throws(() => init_(),
                'Tests with the same title \'some test\' in files \'first file\' and \'second file\' can\'t be used');
        });

        it('should throw in case of duplicate test titles in mocha adapters in the same file', () => {
            const mocha1 = createMochaStub_();
            const mocha2 = createMochaStub_();

            mocha1.updateSuiteTree((suite) => {
                return suite
                    .addTest({title: 'some test', file: 'some file'});
            });

            mocha2.updateSuiteTree((suite) => {
                return suite
                    .addTest({title: 'some test', file: 'some file'});
            });

            MochaBuilder.prototype.buildAdapters.returns([mocha1, mocha2]);

            assert.throws(() => init_(),
                'Tests with the same title \'some test\' in file \'some file\' can\'t be used');
        });

        it('should does not throw on mocha adapters without duplicates', () => {
            const mocha1 = createMochaStub_();
            const mocha2 = createMochaStub_();

            mocha1.updateSuiteTree((suite) => {
                return suite
                    .addTest({title: 'first test', file: 'first file'});
            });

            mocha2.updateSuiteTree((suite) => {
                return suite
                    .addTest({title: 'second test', file: 'second file'});
            });

            MochaBuilder.prototype.buildAdapters.returns([mocha1, mocha2]);

            assert.doesNotThrow(() => init_());
        });

        it('should switch of hooks in skipped suites', () => {
            const mocha1 = createMochaStub_();
            const mocha2 = createMochaStub_();

            MochaBuilder.prototype.buildAdapters.returns([mocha1, mocha2]);

            init_();

            assert.calledOnce(mocha1.disableHooksInSkippedSuites);
            assert.calledOnce(mocha2.disableHooksInSkippedSuites);
        });
    });

    describe('run', () => {
        it('should wrap each mocha instance into a retry runner', () => {
            const mocha1 = createMochaStub_();
            const mocha2 = createMochaStub_();

            MochaBuilder.prototype.buildAdapters.returns([mocha1, mocha2]);
            sandbox.spy(RetryMochaRunner, 'create');
            RetryMochaRunner.prototype.run.returns(Promise.resolve());

            return run_()
                .then(() => {
                    assert.calledTwice(RetryMochaRunner.create);
                    assert.calledWith(RetryMochaRunner.create, mocha1);
                    assert.calledWith(RetryMochaRunner.create, mocha2);
                });
        });

        it('should create a retry runner for a passed browser', () => {
            MochaBuilder.prototype.buildAdapters.returns([createMochaStub_()]);
            sandbox.spy(RetryMochaRunner, 'create');
            RetryMochaRunner.prototype.run.returns(Promise.resolve());

            const config = makeConfigStub({browsers: ['bro'], retry: 10});

            return MochaRunner.create('bro', config).init().run()
                .then(() => assert.calledOnceWith(RetryMochaRunner.create, sinon.match.any, config.forBrowser('bro')));
        });

        it('should run mocha instances via a retry runner', () => {
            const mocha = createMochaStub_();
            sandbox.stub(mocha, 'run');
            MochaBuilder.prototype.buildAdapters.returns([mocha]);
            RetryMochaRunner.prototype.run.returns(Promise.resolve());

            return run_()
                .then(() => {
                    assert.notCalled(mocha.run);
                    assert.calledOnce(RetryMochaRunner.prototype.run);
                });
        });

        it('should wait until all mocha instances will finish their work', () => {
            const firstResolveMarker = sandbox.stub().named('First resolve marker');
            const secondResolveMarker = sandbox.stub().named('Second resolve marker');

            MochaBuilder.prototype.buildAdapters.returns([
                createMochaStub_(),
                createMochaStub_()
            ]);

            RetryMochaRunner.prototype.run
                .onFirstCall().callsFake(() => Promise.resolve().then(firstResolveMarker))
                .onSecondCall().callsFake(() => Promise.delay(1).then(secondResolveMarker));

            return run_()
                .then(() => {
                    assert.called(firstResolveMarker);
                    assert.called(secondResolveMarker);
                });
        });

        it('should be rejected if one of mocha instances rejected on run', () => {
            MochaBuilder.prototype.buildAdapters.returns([createMochaStub_()]);

            RetryMochaRunner.prototype.run.returns(Promise.reject('Error'));

            return assert.isRejected(run_(), /Error/);
        });

        describe('should passthrough events from a', () => {
            const testPassthroughing = (event, from) => {
                RetryMochaRunner.prototype.run.callsFake(() => {
                    from.emit(event, 'some-data');
                    return Promise.resolve();
                });

                const mochaRunner = createMochaRunner_();
                const spy = sinon.spy();

                mochaRunner.on(event, spy);

                return mochaRunner.init().run()
                    .then(() => assert.calledOnceWith(spy, 'some-data'));
            };

            describe('mocha runner', () => {
                const events = [
                    RunnerEvents.SUITE_BEGIN,
                    RunnerEvents.SUITE_END,

                    RunnerEvents.TEST_BEGIN,
                    RunnerEvents.TEST_END,

                    RunnerEvents.TEST_PASS,
                    RunnerEvents.TEST_PENDING,

                    RunnerEvents.INFO,
                    RunnerEvents.WARNING
                ];

                events.forEach((event) => {
                    it(`${event}`, () => {
                        const mocha = createMochaStub_();
                        MochaBuilder.prototype.buildAdapters.returns([mocha]);

                        return testPassthroughing(event, mocha);
                    });
                });
            });

            describe('retry wrapper', () => {
                const events = [
                    RunnerEvents.TEST_FAIL,
                    RunnerEvents.RETRY,
                    RunnerEvents.ERROR
                ];

                events.forEach((event) => {
                    it(`${event}`, () => {
                        const retryMochaRunner = Object.create(RetryMochaRunner.prototype);
                        sandbox.stub(RetryMochaRunner, 'create').returns(retryMochaRunner);

                        MochaBuilder.prototype.buildAdapters.returns([createMochaStub_()]);

                        return testPassthroughing(event, retryMochaRunner);
                    });
                });
            });
        });
    });

    describe('buildSuiteTree', () => {
        it('should build suite tree for specified paths', () => {
            MochaBuilder.prototype.buildSingleAdapter.returns([createMochaStub_()]);

            const mochaRunner = createMochaRunner_();
            mochaRunner.buildSuiteTree(['some/path']);

            assert.calledOnceWith(MochaBuilder.prototype.buildSingleAdapter, ['some/path']);
        });

        it('should return suite of mocha-adapter', () => {
            const mocha = createMochaStub_();
            const mochaRunner = createMochaRunner_();

            MochaBuilder.prototype.buildSingleAdapter.returns(mocha);

            assert.deepEqual(mochaRunner.buildSuiteTree(), mocha.suite);
        });

        it('should throw in case of duplicate test titles in different files', () => {
            const mocha = createMochaStub_();
            const mochaRunner = createMochaRunner_();

            mocha.updateSuiteTree((suite) => {
                return suite
                    .addTest({title: 'some test', file: 'first file'})
                    .addTest({title: 'some test', file: 'second file'});
            });

            MochaBuilder.prototype.buildSingleAdapter.returns(mocha);

            assert.throws(() => mochaRunner.buildSuiteTree(),
                'Tests with the same title \'some test\' in files \'first file\' and \'second file\' can\'t be used');
        });

        it('should throw in case of duplicate test titles in the same file', () => {
            const mocha = createMochaStub_();
            const mochaRunner = createMochaRunner_();

            mocha.updateSuiteTree((suite) => {
                return suite
                    .addTest({title: 'some test', file: 'some file'})
                    .addTest({title: 'some test', file: 'some file'});
            });

            MochaBuilder.prototype.buildSingleAdapter.returns(mocha);

            assert.throws(() => mochaRunner.buildSuiteTree(),
                'Tests with the same title \'some test\' in file \'some file\' can\'t be used');
        });

        describe('should passthrough events from a mocha runner', () => {
            const events = [
                RunnerEvents.BEFORE_FILE_READ,
                RunnerEvents.AFTER_FILE_READ
            ];

            events.forEach((event) => {
                it(`${event}`, () => {
                    MochaBuilder.prototype.buildSingleAdapter.callsFake(function() {
                        this.emit(event, 'some-data');
                        return [createMochaStub_()];
                    });

                    const mochaRunner = createMochaRunner_();
                    const spy = sinon.spy();

                    mochaRunner.on(event, spy);
                    mochaRunner.buildSuiteTree(['path/to/file']);

                    assert.calledOnceWith(spy, 'some-data');
                });
            });
        });
    });
});
