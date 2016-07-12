'use strict';

var _ = require('lodash'),
    RetryManager = require('../../../lib/retry-manager'),
    RunnerEvents = require('../../../lib/constants/runner-events'),
    Matcher = require('../../../lib/retry-manager/matcher'),
    utils = require('./utils'),
    makeTestStub = utils.makeTestStub,
    makeSuiteStub = utils.makeSuiteStub;

describe('retry-manager', function() {
    var sandbox = sinon.sandbox.create();

    function mkMgr_(configOpts) {
        configOpts = _.defaults(configOpts || {}, {
            retry: 0
        });

        var config = utils.makeConfigStub(configOpts);
        return new RetryManager(config);
    }

    beforeEach(function() {
        sandbox.stub(Matcher, 'create');

        Matcher.create.returns({file: 'default-file', browser: 'default-browser'});
    });

    afterEach(function() {
        sandbox.restore();
    });

    describe('handleTestFail', function() {
        it('should emit TEST_FAIL by default', function() {
            var retryManager = mkMgr_({browsers: ['browser']}),
                onTestFail = sinon.spy().named('onTestFail'),
                someTest = makeTestStub({browserId: 'browser'});

            retryManager.on(RunnerEvents.TEST_FAIL, onTestFail);

            retryManager.handleTestFail(someTest);

            assert.calledOnce(onTestFail);
            assert.calledWith(onTestFail, someTest);
        });

        it('should emit RETRY instead of TEST_FAIL if retries set in config', function() {
            var retryManager = mkMgr_({browsers: ['browser'], retry: 2}),
                onRetry = sinon.spy().named('onRetry'),
                onTestFail = sinon.spy().named('onTestFail');

            retryManager.on(RunnerEvents.TEST_FAIL, onTestFail);
            retryManager.on(RunnerEvents.RETRY, onRetry);

            retryManager.handleTestFail(makeTestStub({browserId: 'browser'}));

            assert.notCalled(onTestFail);
            assert.calledOnce(onRetry);
            assert.calledWithMatch(onRetry, {
                browserId: 'browser',
                retriesLeft: 1
            });
        });

        it('should emit TEST_FAIL if no retries left', function() {
            var retryManager = mkMgr_({browsers: ['browser'], retry: 1}),
                onRetry = sinon.spy().named('onRetry'),
                onTestFail = sinon.spy().named('onTestFail');

            retryManager.on(RunnerEvents.TEST_FAIL, onTestFail);
            retryManager.on(RunnerEvents.RETRY, onRetry);

            retryManager.handleTestFail(makeTestStub({browserId: 'browser'}));
            retryManager.retry(_.noop);

            retryManager.handleTestFail(makeTestStub({browserId: 'browser'}));

            assert.calledOnce(onRetry);
            assert.calledOnce(onTestFail);
        });

        it('should submit failed test for retry', function() {
            var retryManager = mkMgr_({browsers: ['browser'], retry: 2}),
                someTest = makeTestStub({
                    title: 'some-test',
                    browserId: 'browser'
                });

            retryManager.handleTestFail(someTest);

            assert.calledWith(Matcher.create, sinon.match(someTest), 'browser');
        });

        it('should submit all suite nested tests if hook failed', function() {
            var retryManager = mkMgr_({browsers: ['browser'], retry: 2}),
                test1 = makeTestStub(),
                test2 = makeTestStub(),
                test3 = makeTestStub(),
                someSuite = makeSuiteStub({
                    suites: [
                        makeSuiteStub({
                            tests: [test1, test2]
                        })
                    ],
                    tests: [test3]
                });

            retryManager.handleTestFail(makeTestStub({
                title: 'some-test',
                browserId: 'browser',
                hook: {parent: someSuite}
            }));

            assert.calledThrice(Matcher.create);
            assert.calledWith(Matcher.create, test1, 'browser');
            assert.calledWith(Matcher.create, test2, 'browser');
            assert.calledWith(Matcher.create, test3, 'browser');
        });
    });

    describe('handleSuiteFail', () => {
        it('should emit SUITE_FAIL by default', () => {
            const retryManager = mkMgr_({browsers: ['browser']});
            const onSuiteFail = sinon.spy().named('onSuiteFail');
            const beforeAllHook = {browserId: 'browser'};

            retryManager.on(RunnerEvents.SUITE_FAIL, onSuiteFail);

            retryManager.handleSuiteFail(beforeAllHook);

            assert.calledOnce(onSuiteFail);
            assert.calledWith(onSuiteFail, beforeAllHook);
        });

        it('should emit RETRY instead of SUITE_FAIL if retries set in config', () => {
            const retryManager = mkMgr_({browsers: ['browser'], retry: 2});
            const onRetry = sinon.spy().named('onRetry');
            const onSuiteFail = sinon.spy().named('onSuiteFail');
            const someTest = makeTestStub();

            retryManager.on(RunnerEvents.SUITE_FAIL, onSuiteFail);
            retryManager.on(RunnerEvents.RETRY, onRetry);

            retryManager.handleSuiteFail({browserId: 'browser', parent: {tests: [someTest]}});

            assert.notCalled(onSuiteFail);
            assert.calledOnce(onRetry);
            assert.calledWithMatch(onRetry, {
                browserId: 'browser',
                parent: {tests: [someTest]},
                retriesLeft: 1
            });
        });

        it('should emit SUITE_FAIL if no retries left', () => {
            const retryManager = mkMgr_({browsers: ['browser'], retry: 1});
            const onRetry = sinon.spy().named('onRetry');
            const onSuiteFail = sinon.spy().named('onSuiteFail');

            retryManager.on(RunnerEvents.SUITE_FAIL, onSuiteFail);
            retryManager.on(RunnerEvents.RETRY, onRetry);

            retryManager.handleSuiteFail({browserId: 'browser', parent: {tests: [makeTestStub()]}});
            retryManager.retry(_.noop);

            retryManager.handleSuiteFail({browserId: 'browser', parent: {tests: [makeTestStub()]}});

            assert.calledOnce(onRetry);
            assert.calledOnce(onSuiteFail);
        });

        it('should submit failed tests for retry', () => {
            const retryManager = mkMgr_({browsers: ['browser'], retry: 2});
            const someTest = makeTestStub({browserId: 'browserId'});
            const beforeAllHook = {browserId: 'browser', parent: {tests: [someTest]}};

            retryManager.handleSuiteFail(beforeAllHook);

            assert.calledWith(Matcher.create, sinon.match(someTest), 'browser');
        });

        it('should submit all suite nested tests for retry', () => {
            const retryManager = mkMgr_({browsers: ['browser'], retry: 2});
            const test1 = makeTestStub();
            const test2 = makeTestStub();
            const test3 = makeTestStub();
            const beforeAllHook = {
                browserId: 'browser',
                parent: {
                    suites: [
                        makeSuiteStub({
                            tests: [test1, test2]
                        })
                    ],
                    tests: [test3]
                }
            };

            retryManager.handleSuiteFail(beforeAllHook);

            assert.calledThrice(Matcher.create);
            assert.calledWith(Matcher.create, test1, 'browser');
            assert.calledWith(Matcher.create, test2, 'browser');
            assert.calledWith(Matcher.create, test3, 'browser');
        });
    });

    describe('handleError', function() {
        it('should emit ERROR if no runnable passed', function() {
            var retryManager = mkMgr_(),
                onError = sinon.spy();

            retryManager.on(RunnerEvents.ERROR, onError);

            retryManager.handleError('some-error');

            assert.calledOnce(onError);
            assert.calledWith(onError, 'some-error');
        });

        it('should emit ERROR if failed runnable no parent', function() {
            var retryManager = mkMgr_({browsers: ['browser'], retry: 2}),
                onRetry = sinon.spy().named('onRetry'),
                onError = sinon.spy().named('onError');

            retryManager.on(RunnerEvents.ERROR, onError);
            retryManager.on(RunnerEvents.RETRY, onRetry);

            retryManager.handleError('some-error', {browserId: 'browser'});

            assert.notCalled(onRetry);
            assert.calledOnce(onError);
        });

        it('should emit RETRY instead of ERROR if retries set in config', function() {
            var retryManager = mkMgr_({browsers: ['browser'], retry: 2}),
                onRetry = sinon.spy().named('onRetry'),
                onError = sinon.spy().named('onError');

            retryManager.on(RunnerEvents.ERROR, onError);
            retryManager.on(RunnerEvents.RETRY, onRetry);

            retryManager.handleError('some-error', {
                browserId: 'browser',
                parent: makeSuiteStub()
            });

            assert.notCalled(onError);
            assert.calledOnce(onRetry);
            assert.calledWithMatch(onRetry, {
                browserId: 'browser',
                retriesLeft: 1,
                err: 'some-error'
            });
        });

        it('should emit ERROR if no retries left', function() {
            var retryManager = mkMgr_({browsers: ['browser'], retry: 1}),
                onRetry = sinon.spy().named('onRetry'),
                onError = sinon.spy().named('onError');

            retryManager.on(RunnerEvents.ERROR, onError);
            retryManager.on(RunnerEvents.RETRY, onRetry);

            var fail = {
                browserId: 'browser',
                parent: makeSuiteStub({
                    tests: [makeTestStub()]
                })
            };

            retryManager.handleError('some-error', fail);
            retryManager.retry(_.noop);

            retryManager.handleError('some-error', fail);

            assert.calledOnce(onRetry);
            assert.calledOnce(onError);
        });

        it('should submit all parent`s suites and tests for retry', function() {
            var retryManager = mkMgr_({browsers: ['browser'], retry: 2}),
                test1 = makeTestStub(),
                test2 = makeTestStub(),
                test3 = makeTestStub(),
                someSuite = makeSuiteStub({
                    suites: [
                        makeSuiteStub({
                            tests: [test1, test2]
                        })
                    ],
                    tests: [test3]
                });

            retryManager.handleError('some-error', {
                browserId: 'browser',
                parent: someSuite
            });

            assert.calledThrice(Matcher.create);
            assert.calledWith(Matcher.create, test1, 'browser');
            assert.calledWith(Matcher.create, test2, 'browser');
            assert.calledWith(Matcher.create, test3, 'browser');
        });
    });

    describe('retry', function() {
        it('should not retry if no fails registered', function() {
            var retryManager = mkMgr_(),
                runFn = sinon.spy().named('runFn');

            retryManager.retry(runFn);

            assert.notCalled(runFn);
        });

        it('should retry if there were some test fails', function() {
            var retryManager = mkMgr_({browsers: ['browser'], retry: 2}),
                runFn = sinon.spy().named('runFn');

            retryManager.handleTestFail(makeTestStub({browserId: 'browser'}));

            retryManager.retry(runFn);

            assert.calledOnce(runFn);
        });

        it('should retry if there were some errors', function() {
            var retryManager = mkMgr_({browsers: ['browser'], retry: 2}),
                runFn = sinon.spy().named('runFn');

            retryManager.handleError('some-error', {
                browserId: 'browser',
                parent: makeSuiteStub({
                    tests: [makeTestStub()]
                })
            });

            retryManager.retry(runFn);

            assert.calledOnce(runFn);
        });

        it('should retry only once', function() {
            var retryManager = mkMgr_({browsers: ['browser'], retry: 2}),
                runFn = sinon.spy().named('runFn');

            retryManager.handleTestFail(makeTestStub({browserId: 'browser'}));
            retryManager.retry(runFn);

            retryManager.retry(runFn);

            assert.calledOnce(runFn);
        });

        it('should retry in all files from all matchers', function() {
            var retryManager = mkMgr_({browsers: ['b1', 'b2'], retry: 2});

            Matcher.create
                .onFirstCall().returns({file: 'some/file', browser: 'b1'})
                .onSecondCall().returns({file: 'other/file', browser: 'b2'})
                .onThirdCall().returns({file: 'some/file', browser: 'b1'});

            retryManager.handleTestFail(makeTestStub({browserId: 'b1'}));
            retryManager.handleTestFail(makeTestStub({browserId: 'b2'}));
            retryManager.handleTestFail(makeTestStub({browserId: 'b2'}));

            var runFn = sinon.spy().named('runFn');
            retryManager.retry(runFn);

            assert.calledWith(runFn, {
                b1: ['some/file'],
                b2: ['other/file']
            });
        });

        it('should retry in all browsers from all matchers', function() {
            var retryManager = mkMgr_({browsers: ['b1', 'b2'], retry: 2});

            Matcher.create
                .withArgs(sinon.match.any, 'b1').returns({file: 'some/file', browser: 'b1'})
                .withArgs(sinon.match.any, 'b2').returns({file: 'some/file', browser: 'b2'});

            retryManager.handleTestFail(makeTestStub({browserId: 'b1'}));
            retryManager.handleTestFail(makeTestStub({browserId: 'b2'}));

            var runFn = sinon.spy().named('runFn');
            retryManager.retry(runFn);

            assert.calledWith(runFn, {
                b1: ['some/file'],
                b2: ['some/file']
            });
        });

        describe('filter function', function() {
            function initFilterFn_(matcher1, matcher2) {
                var retryManager = mkMgr_({browsers: ['b1', 'b2'], retry: 2});

                Matcher.create
                    .onFirstCall().returns(matcher1)
                    .onSecondCall().returns(matcher2);

                retryManager.handleTestFail(makeTestStub({browserId: 'b1'}));
                retryManager.handleTestFail(makeTestStub({browserId: 'b1'}));

                var runFn = sinon.stub().named('runFn');
                retryManager.retry(runFn);

                return runFn.firstCall.args[1];
            }

            it('should test all matchers on retry', function() {
                var matcher1 = sinon.createStubInstance(Matcher),
                    matcher2 = sinon.createStubInstance(Matcher),
                    filterFn = initFilterFn_(matcher1, matcher2);

                filterFn();

                assert.calledOnce(matcher1.test);
                assert.calledOnce(matcher2.test);
            });

            it('should skip test if no matchers matches it', function() {
                var matcher1 = sinon.createStubInstance(Matcher),
                    matcher2 = sinon.createStubInstance(Matcher),
                    filterFn = initFilterFn_(matcher1, matcher2);

                matcher1.test.returns(false);
                matcher2.test.returns(false);

                assert.isFalse(filterFn());
            });

            it('should allow to run test if any Matcher matches it', function() {
                var matcher1 = sinon.createStubInstance(Matcher),
                    matcher2 = sinon.createStubInstance(Matcher),
                    filterFn = initFilterFn_(matcher1, matcher2);

                matcher1.test.returns(false);
                matcher2.test.returns(true);

                assert.isTrue(filterFn());
            });
        });
    });
});
