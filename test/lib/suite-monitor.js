'use strict';

const SuiteMonitor = require('../../lib/suite-monitor');
const RunnerEvents = require('../../lib/constants/runner-events');
const {makeSuite, makeTest} = require('../utils');

describe('suite-monitor', () => {
    ['SUITE_BEGIN', 'SUITE_END'].forEach((event) => {
        describe(`should emit ${event} event only once`, () => {
            it('for the same suite', () => {
                const suiteMonitor = SuiteMonitor.create();
                const spy = sinon.spy().named(`${event} handler`);
                const suite1 = makeSuite({id: () => '12345', title: 'suite1'});

                suiteMonitor.on(RunnerEvents[event], spy);

                suiteMonitor.suiteBegin(suite1);
                suiteMonitor.suiteBegin(suite1);
                suiteMonitor.suiteEnd(suite1);
                suiteMonitor.suiteEnd(suite1);

                assert.calledOnce(spy);
                assert.calledWithMatch(spy, {title: 'suite1'});
            });

            it('for each new suite', () => {
                const suiteMonitor = SuiteMonitor.create();
                const spy = sinon.spy().named(`${event} handler`);
                const suite1 = makeSuite({id: () => '12345', title: 'suite1'});
                const suite2 = makeSuite({id: () => '54321', title: 'suite2'});

                suiteMonitor.on(RunnerEvents[event], spy);

                suiteMonitor.suiteBegin(suite1);
                suiteMonitor.suiteBegin(suite2);
                suiteMonitor.suiteEnd(suite2);
                suiteMonitor.suiteEnd(suite1);

                assert.calledTwice(spy);
                assert.calledWithMatch(spy, {title: 'suite1'});
                assert.calledWithMatch(spy, {title: 'suite2'});
            });

            it('for each parent suite of retried test', () => {
                const suiteMonitor = SuiteMonitor.create();
                const spy = sinon.spy().named(`${event} handler`);
                const suite1 = makeSuite({id: () => '12345', title: 'suite1'});
                const suite2 = makeSuite({id: () => '54321', title: 'suite2', parent: suite1});
                const test = makeTest({parent: suite2});

                suiteMonitor.on(RunnerEvents[event], spy);

                suiteMonitor.suiteBegin(suite1);
                suiteMonitor.suiteBegin(suite2);
                suiteMonitor.testRetry(test);
                suiteMonitor.suiteEnd(suite2);
                suiteMonitor.suiteEnd(suite1);

                suiteMonitor.suiteBegin(suite1);
                suiteMonitor.suiteBegin(suite2);
                suiteMonitor.suiteEnd(suite2);
                suiteMonitor.suiteEnd(suite1);

                assert.calledTwice(spy);
                assert.calledWithMatch(spy, {title: 'suite1'});
                assert.calledWithMatch(spy, {title: 'suite2'});
            });
        });
    });
});
