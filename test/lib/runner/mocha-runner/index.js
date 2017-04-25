'use strict';

const _ = require('lodash');
const q = require('q');
const BrowserAgent = require('../../../../lib/browser-agent');
const RunnerEvents = require('../../../../lib/constants/runner-events');
const MochaAdapter = require('../../../../lib/runner/mocha-runner/mocha-adapter');
const MochaRunner = require('../../../../lib/runner/mocha-runner');
const RetryMochaRunner = require('../../../../lib/runner/mocha-runner/retry-mocha-runner');
const TestSkipper = require('../../../../lib/runner/test-skipper');

describe('mocha-runner', () => {
    const sandbox = sinon.sandbox.create();

    const stubConfig = () => ({system: {mochaOpts: {}, ctx: {}}, forBrowser: sandbox.stub().returns({})});
    const mochaRunnerInit = () => {
        return new MochaRunner(
            stubConfig(),
            sinon.createStubInstance(BrowserAgent),
            sinon.createStubInstance(TestSkipper)
        );
    };

    const run_ = (suites) => {
        return mochaRunnerInit().run(suites || ['test_suite']);
    };

    // We can't call constructor because it creates mocha instance inside
    const mkMochaAdapterStub_ = () => Object.create(MochaAdapter.prototype);

    beforeEach(() => {
        sandbox.stub(MochaAdapter, 'init');
        sandbox.stub(MochaAdapter.prototype, 'attachTitleValidator').returnsThis();
        sandbox.stub(MochaAdapter.prototype, 'applySkip').returnsThis();
        sandbox.stub(MochaAdapter.prototype, 'loadFiles').returnsThis();
        sandbox.stub(MochaAdapter.prototype, 'run').returnsThis();

        sandbox.spy(RetryMochaRunner, 'create');
        sandbox.stub(RetryMochaRunner.prototype, 'run');
    });

    afterEach(() => sandbox.restore());

    describe('init', () => {
        it('should init mocha adapter', () => {
            MochaRunner.init();

            assert.calledOnce(MochaAdapter.init);
        });
    });

    describe('run', () => {
        beforeEach(() => sandbox.stub(MochaAdapter, 'create').callsFake(() => mkMochaAdapterStub_()));

        it('should create mocha instance for each file', () => {
            return run_(['path/to/file', 'path/to/other/file'])
                .then(() => {
                    assert.calledTwice(MochaAdapter.prototype.loadFiles);
                    assert.calledWith(MochaAdapter.prototype.loadFiles, ['path/to/file']);
                    assert.calledWith(MochaAdapter.prototype.loadFiles, ['path/to/other/file']);

                    const mochaInstances = MochaAdapter.prototype.loadFiles.thisValues;

                    assert.notStrictEqual(mochaInstances[0], mochaInstances[1]);
                });
        });

        it('should wrap each mocha instance into a retry runner', () => {
            const config = stubConfig();

            config.forBrowser.withArgs('some-bro').returns({retry: 10});

            return MochaRunner.create(config, {browserId: 'some-bro'}).run(['path/to/file', 'path/to/other/file'])
                .then(() => {
                    const mochaInstances = MochaAdapter.prototype.loadFiles.thisValues;

                    assert.calledTwice(RetryMochaRunner.create);
                    assert.calledWith(RetryMochaRunner.create, mochaInstances[0], {retry: 10});
                    assert.calledWith(RetryMochaRunner.create, mochaInstances[1], {retry: 10});
                });
        });

        it('should share single opts object between all mocha instances', () => {
            return run_(['path/to/file', 'path/to/other/file'])
                .then(() => assert.equal(
                    MochaAdapter.create.firstCall.args[0],
                    MochaAdapter.create.secondCall.args[0]
                ));
        });

        it('should share a ctx from config between all mocha instances', () => {
            return run_(['path/to/file', 'path/to/other/file'])
                .then(() => assert.equal(
                    MochaAdapter.create.firstCall.args[2],
                    MochaAdapter.create.secondCall.args[2]
                ));
        });

        it('should skip test using test skipper', () => {
            return run_()
                .then(() => assert.calledWith(MochaAdapter.prototype.applySkip, sinon.match.instanceOf(TestSkipper)));
        });

        it('should skip test before file adding', () => {
            return run_()
                .then(() => {
                    assert.callOrder(
                        MochaAdapter.prototype.applySkip,
                        MochaAdapter.prototype.loadFiles
                    );
                });
        });

        it('should call title vaidator for each file', () => {
            return run_(['some/path/file.js', 'other/path/file.js'])
                .then(() => {
                    assert.calledTwice(MochaAdapter.prototype.attachTitleValidator);
                    assert.calledWith(MochaAdapter.prototype.attachTitleValidator, {});
                });
        });

        it('should run all mocha instances via a retry runner', () => {
            return run_(['some/file', 'other/file'])
                .then(() => {
                    assert.notCalled(MochaAdapter.prototype.run);
                    assert.calledTwice(RetryMochaRunner.prototype.run);
                });
        });

        it('should create all mocha instances before run any of them', () => {
            MochaAdapter.create.restore();
            RetryMochaRunner.prototype.run.restore();

            const order = [];
            sandbox.stub(MochaAdapter, 'create').callsFake(() => {
                order.push('create');
                return mkMochaAdapterStub_();
            });
            sandbox.stub(RetryMochaRunner.prototype, 'run').callsFake(() => order.push('run'));

            return run_(['some/file', 'other/file'])
                .then(() => assert.deepEqual(order, ['create', 'create', 'run', 'run']));
        });

        it('should wait until all mocha instances will finish their work', () => {
            const firstResolveMarker = sandbox.stub().named('First resolve marker');
            const secondResolveMarker = sandbox.stub().named('Second resolve marker');

            RetryMochaRunner.prototype.run.onFirstCall().returns(q().then(firstResolveMarker));
            RetryMochaRunner.prototype.run.onSecondCall().returns(q.delay(1).then(secondResolveMarker));

            return run_(['path/to/suite', 'path/to/another/suite'])
                .then(() => {
                    assert.called(firstResolveMarker);
                    assert.called(secondResolveMarker);
                });
        });

        it('should be rejected if one of mocha instances rejected on run', () => {
            RetryMochaRunner.prototype.run.returns(q.reject('Error'));

            return assert.isRejected(run_(), /Error/);
        });

        describe('should passthrough events from a', () => {
            const testPassthroughing = (event, from) => {
                RetryMochaRunner.prototype.run.restore();
                sandbox.stub(RetryMochaRunner.prototype, 'run').callsFake(() => from.emit(event, 'some-data'));

                const mochaRunner = mochaRunnerInit();
                const spy = sinon.spy();

                mochaRunner.on(event, spy);

                return mochaRunner.run(['path/to/file'])
                    .then(() => {
                        assert.calledOnce(spy);
                        assert.calledWith(spy, 'some-data');
                    });
            };

            describe('mocha runner', () => {
                const events = [
                    RunnerEvents.BEFORE_FILE_READ,
                    RunnerEvents.AFTER_FILE_READ,

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
                        const mochaAdapter = mkMochaAdapterStub_();
                        MochaAdapter.create.returns(mochaAdapter);

                        return testPassthroughing(event, mochaAdapter);
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
                        RetryMochaRunner.create.restore();
                        sandbox.stub(RetryMochaRunner, 'create').returns(retryMochaRunner);

                        return testPassthroughing(event, retryMochaRunner);
                    });
                });
            });
        });
    });

    describe('buildSuiteTree', () => {
        beforeEach(() => sandbox.stub(MochaAdapter, 'create').returns(mkMochaAdapterStub_()));

        it('should build suite tree for specified paths', () => {
            const mochaRunner = mochaRunnerInit();

            mochaRunner.buildSuiteTree(['some/path']);

            assert.called(MochaAdapter.create);
            assert.calledWith(MochaAdapter.prototype.loadFiles, ['some/path']);
        });

        it('should call title validator for passed files', () => {
            const mochaRunner = mochaRunnerInit();
            mochaRunner.buildSuiteTree(['some/path/file1.js', 'other/path/file2.js']);

            assert.calledOnce(MochaAdapter.prototype.attachTitleValidator);
            assert.calledWith(MochaAdapter.prototype.attachTitleValidator, {});
        });

        it('should skip test using test skipper', () => {
            const mochaRunner = mochaRunnerInit();

            mochaRunner.buildSuiteTree(['some/path']);
            assert.calledWith(MochaAdapter.prototype.applySkip, sinon.match.instanceOf(TestSkipper));
        });

        it('should build suite tree if passed specified as string', () => {
            const mochaRunner = mochaRunnerInit();

            mochaRunner.buildSuiteTree('some/path');

            assert.called(MochaAdapter.create);
            assert.calledWith(MochaAdapter.prototype.loadFiles, ['some/path']);
        });

        it('should return suite of mocha-adapter', () => {
            MochaAdapter.create.restore();
            sandbox.stub(MochaAdapter, 'create');

            const mochaRunner = mochaRunnerInit();
            const suiteStub = sandbox.stub();
            MochaAdapter.create.returns(_.extend(Object.create(MochaAdapter.prototype), {suite: suiteStub}));

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
                    const mochaAdapter = mkMochaAdapterStub_();
                    MochaAdapter.create.returns(mochaAdapter);

                    MochaAdapter.prototype.loadFiles.restore();
                    sandbox.stub(MochaAdapter.prototype, 'loadFiles').callsFake(function() {
                        events.forEach((event) => mochaAdapter.emit(event, 'some-data'));
                        return this;
                    });

                    const mochaRunner = mochaRunnerInit();
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
