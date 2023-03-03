'use strict';

const SuiteMonitor = require('src/runner/suite-monitor');
const Events = require('src/constants/runner-events');
const {makeSuite, makeTest} = require('../../utils');

describe('suite-monitor', () => {
    describe('SUITE_BEGIN', () => {
        let onSuiteBegin;
        let suiteMonitor;

        beforeEach(() => {
            onSuiteBegin = sinon.stub().named('onSuiteBegin');
            suiteMonitor = SuiteMonitor.create()
                .on(Events.SUITE_BEGIN, onSuiteBegin);
        });

        it('should not emit SUITE_BEGIN for root suite', () => {
            const root = makeSuite({root: true});
            const suite = makeSuite({parent: root});
            const test = makeTest({parent: suite});

            suiteMonitor.testBegin(test);

            assert.calledOnce(onSuiteBegin);
            assert.neverCalledWith(onSuiteBegin, root);
        });

        it('should emit SUITE_BEGIN for all test parents', () => {
            const suite1 = makeSuite();
            const suite2 = makeSuite({parent: suite1});
            const test = makeTest({parent: suite2});

            suiteMonitor.testBegin(test);

            assert.calledTwice(onSuiteBegin);
            assert.calledWith(onSuiteBegin, suite1);
            assert.calledWith(onSuiteBegin, suite2);
        });

        it('should emit SUITE_BEGIN events from top to bottom', () => {
            const suite1 = makeSuite();
            const suite2 = makeSuite({parent: suite1});
            const test = makeTest({parent: suite2});

            const suites = [];
            onSuiteBegin.callsFake((suite) => suites.push(suite));

            suiteMonitor.testBegin(test);

            assert.deepEqual(suites, [suite1, suite2]);
        });

        it('should emit SUITE_BEGIN only for first test in suite', () => {
            const suite = makeSuite();
            const test1 = makeTest({parent: suite});
            const test2 = makeTest({parent: suite});

            suiteMonitor.testBegin(test1);
            suiteMonitor.testBegin(test2);

            assert.calledOnce(onSuiteBegin);
        });

        it('should emit SUITE_BEGIN only once for suite with tests and suites', () => {
            const topLevelSuite = makeSuite();
            const topLevelTest = makeTest({parent: topLevelSuite});
            const suite = makeSuite({parent: topLevelSuite});
            const test = makeTest({parent: suite});

            suiteMonitor.testBegin(topLevelTest);
            suiteMonitor.testBegin(test);

            assert.calledOnce(onSuiteBegin.withArgs(topLevelSuite));
        });

        it('should not emit SUITE_BEGIN again after retry', () => {
            const suite = makeSuite();
            const test = makeTest({parent: suite});

            suiteMonitor.testBegin(test);
            suiteMonitor.testRetry(test);
            suiteMonitor.testEnd(test);
            suiteMonitor.testBegin(test);

            assert.calledOnce(onSuiteBegin);
        });
    });

    describe('SUITE_END', () => {
        let onSuiteEnd;
        let suiteMonitor;

        beforeEach(() => {
            onSuiteEnd = sinon.stub().named('onSuiteEnd');
            suiteMonitor = SuiteMonitor.create()
                .on(Events.SUITE_END, onSuiteEnd);
        });

        it('should not emit SUITE_END for root suite', () => {
            const root = makeSuite({root: true});
            const suite = makeSuite({parent: root});
            const test = makeTest({parent: suite});

            suiteMonitor.testBegin(test);
            suiteMonitor.testEnd(test);

            assert.calledOnce(onSuiteEnd);
            assert.neverCalledWith(onSuiteEnd, root);
        });

        it('should emit SUITE_END for all test parents', () => {
            const suite1 = makeSuite();
            const suite2 = makeSuite({parent: suite1});
            const test = makeTest({parent: suite2});

            suiteMonitor.testBegin(test);
            suiteMonitor.testEnd(test);

            assert.calledTwice(onSuiteEnd);
            assert.calledWith(onSuiteEnd, suite1);
            assert.calledWith(onSuiteEnd, suite2);
        });

        it('should emit SUITE_END events from bottom to up', () => {
            const suite1 = makeSuite();
            const suite2 = makeSuite({parent: suite1});
            const test = makeTest({parent: suite2});

            const suites = [];
            onSuiteEnd.callsFake((suite) => suites.push(suite));

            suiteMonitor.testBegin(test);
            suiteMonitor.testEnd(test);

            assert.deepEqual(suites, [suite2, suite1]);
        });

        it('should emit SUITE_END only for first test in suite', () => {
            const suite = makeSuite();
            const test1 = makeTest({parent: suite});
            const test2 = makeTest({parent: suite});

            suiteMonitor.testBegin(test1);
            suiteMonitor.testBegin(test2);
            suiteMonitor.testEnd(test1);
            suiteMonitor.testEnd(test2);

            assert.calledOnce(onSuiteEnd);
        });

        it('should emit SUITE_END only once for suite with tests and suites', () => {
            const topLevelSuite = makeSuite();
            const topLevelTest = makeTest({parent: topLevelSuite});
            const suite = makeSuite({parent: topLevelSuite});
            const test = makeTest({parent: suite});

            suiteMonitor.testBegin(topLevelTest);
            suiteMonitor.testBegin(test);
            suiteMonitor.testEnd(topLevelTest);
            suiteMonitor.testEnd(test);

            assert.calledOnce(onSuiteEnd.withArgs(topLevelSuite));
        });

        it('should not emit SUITE_END for suites with retrying tests', () => {
            const suite = makeSuite();
            const test = makeTest({parent: suite});

            suiteMonitor.testBegin(test);
            suiteMonitor.testRetry(test);
            suiteMonitor.testEnd(test);

            assert.notCalled(onSuiteEnd);
        });

        it('should emit SUITE_END for suites after test retried', () => {
            const suite = makeSuite();
            const test = makeTest({parent: suite});

            suiteMonitor.testBegin(test);
            suiteMonitor.testRetry(test);
            suiteMonitor.testEnd(test);

            suiteMonitor.testBegin(test);
            suiteMonitor.testEnd(test);

            assert.calledOnce(onSuiteEnd);
        });

        it('should not emit SUITE_END if suite still has retrying tests', () => {
            const suite = makeSuite();
            const test1 = makeTest({parent: suite});
            const test2 = makeTest({parent: suite});

            suiteMonitor.testBegin(test1);
            suiteMonitor.testBegin(test2);
            suiteMonitor.testRetry(test1);
            suiteMonitor.testRetry(test2);
            suiteMonitor.testEnd(test1);
            suiteMonitor.testEnd(test2);

            suiteMonitor.testBegin(test1);
            suiteMonitor.testEnd(test1);

            assert.notCalled(onSuiteEnd);
        });
    });
});
