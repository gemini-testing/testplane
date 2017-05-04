'use strict';

const EventEmitter = require('events').EventEmitter;
const _ = require('lodash');
const q = require('q');
const BrowserAgent = require('../../../../lib/browser-agent');
const RunnerEvents = require('../../../../lib/constants/runner-events');
const MochaAdapter = require('../../../../lib/runner/mocha-runner/mocha-adapter');
const MochaRunner = require('../../../../lib/runner/mocha-runner');
const RetryMochaRunner = require('../../../../lib/runner/mocha-runner/retry-mocha-runner');
const TestSkipper = require('../../../../lib/runner/test-skipper');
const MochaBuilder = require('../../../../lib/runner/mocha-runner/mocha-builder');

describe('mocha-runner', () => {
    const sandbox = sinon.sandbox.create();

    const stubConfig_ = (config) => {
        return _.defaults(config || {}, {
            system: {mochaOpts: {}, ctx: {}},
            forBrowser: sandbox.stub().returns({})
        });
    };
    const createMochaRunner_ = () => {
        return new MochaRunner(
            stubConfig_(),
            sinon.createStubInstance(BrowserAgent),
            sinon.createStubInstance(TestSkipper)
        );
    };

    const init_ = (suites) => createMochaRunner_().init(suites || ['test_suite']);
    const run_ = (suites) => init_(suites).run();

    // We can't call constructor because it creates mocha instance inside
    const mkMochaAdapterStub_ = () => Object.create(MochaAdapter.prototype);

    beforeEach(() => {
        sandbox.stub(MochaAdapter, 'prepare');

        sandbox.stub(RetryMochaRunner.prototype, 'run');

        sandbox.stub(MochaBuilder.prototype, 'buildAdapters');
    });

    afterEach(() => sandbox.restore());

    describe('constructor', () => {
        it('should create mocha adapter builder', () => {
            sandbox.spy(MochaBuilder, 'create');

            const config = stubConfig_({system: {foo: 'bar'}});
            const browserAgent = {browserId: 'bro'};
            const testSkipper = {baz: 'qux'};

            MochaRunner.create(config, browserAgent, testSkipper);

            assert.calledOnceWith(MochaBuilder.create, {foo: 'bar'}, browserAgent, testSkipper);
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

                    assert.calledOnce(spy);
                    assert.calledWith(spy, 'some-data');
                });
            });
        });
    });

    describe('prepare', () => {
        it('should prepare mocha adapter', () => {
            MochaRunner.prepare();

            assert.calledOnce(MochaAdapter.prepare);
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
    });

    describe('run', () => {
        it('should wrap each mocha instance into a retry runner', () => {
            const mocha1 = sinon.createStubInstance(MochaAdapter);
            const mocha2 = sinon.createStubInstance(MochaAdapter);

            MochaBuilder.prototype.buildAdapters.returns([mocha1, mocha2]);
            sandbox.spy(RetryMochaRunner, 'create');

            return run_()
                .then(() => {
                    assert.calledTwice(RetryMochaRunner.create);
                    assert.calledWith(RetryMochaRunner.create, mocha1);
                    assert.calledWith(RetryMochaRunner.create, mocha2);
                });
        });

        it('should create a retry runner for a passed browser', () => {
            MochaBuilder.prototype.buildAdapters.returns([sinon.createStubInstance(MochaAdapter)]);
            sandbox.spy(RetryMochaRunner, 'create');

            const config = stubConfig_();
            config.forBrowser.withArgs('bro').returns({retry: 10});

            return MochaRunner.create(config, {browserId: 'bro'}).init().run()
                .then(() => assert.calledOnceWith(RetryMochaRunner.create, sinon.match.any, {retry: 10}));
        });

        it('should run mocha instances via a retry runner', () => {
            const mocha = sinon.createStubInstance(MochaAdapter);
            MochaBuilder.prototype.buildAdapters.returns([mocha]);

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
                sinon.createStubInstance(MochaAdapter),
                sinon.createStubInstance(MochaAdapter)
            ]);

            RetryMochaRunner.prototype.run
                .onFirstCall().callsFake(() => q().then(firstResolveMarker))
                .onSecondCall().callsFake(() => q.delay(1).then(secondResolveMarker));

            return run_()
                .then(() => {
                    assert.called(firstResolveMarker);
                    assert.called(secondResolveMarker);
                });
        });

        it('should be rejected if one of mocha instances rejected on run', () => {
            MochaBuilder.prototype.buildAdapters.returns([sinon.createStubInstance(MochaAdapter)]);

            RetryMochaRunner.prototype.run.returns(q.reject('Error'));

            return assert.isRejected(run_(), /Error/);
        });

        describe('should passthrough events from a', () => {
            const testPassthroughing = (event, from) => {
                RetryMochaRunner.prototype.run.callsFake(() => from.emit(event, 'some-data'));

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
                        const mocha = mkMochaAdapterStub_();
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

                        MochaBuilder.prototype.buildAdapters.returns([mkMochaAdapterStub_()]);

                        return testPassthroughing(event, retryMochaRunner);
                    });
                });
            });
        });
    });

    describe('buildSuiteTree', () => {
        it('should build suite tree for specified paths', () => {
            MochaBuilder.prototype.buildAdapters.returns([sinon.createStubInstance(MochaAdapter)]);

            const mochaRunner = createMochaRunner_();
            mochaRunner.buildSuiteTree(['some/path']);

            assert.calledOnceWith(MochaBuilder.prototype.buildAdapters, ['some/path'], {singleInstance: true});
        });

        it('should return suite of mocha-adapter', () => {
            const mochaRunner = createMochaRunner_();
            const suiteStub = sandbox.stub();
            MochaBuilder.prototype.buildAdapters.returns([_.extend(mkMochaAdapterStub_(), {suite: suiteStub})]);

            const suiteTree = mochaRunner.buildSuiteTree(['some/path']);
            assert.deepEqual(suiteTree, suiteStub);
        });

        describe('should passthrough events from a mocha runner', () => {
            const events = [
                RunnerEvents.BEFORE_FILE_READ,
                RunnerEvents.AFTER_FILE_READ
            ];

            events.forEach((event) => {
                it(`${event}`, () => {
                    MochaBuilder.prototype.buildAdapters.callsFake(function() {
                        this.emit(event, 'some-data');
                        return [mkMochaAdapterStub_()];
                    });

                    const mochaRunner = createMochaRunner_();
                    const spy = sinon.spy();

                    mochaRunner.on(event, spy);
                    mochaRunner.buildSuiteTree(['path/to/file']);

                    assert.calledOnce(spy);
                    assert.calledWith(spy, 'some-data');
                });
            });
        });
    });
});
