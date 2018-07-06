'use strict';

const SkippedTestRunner = require('lib/runner/test-runner/skipped-test-runner');
const Events = require('lib/constants/runner-events');
const {makeTest, makeSuite} = require('../../../utils');

describe('runner/test-runner/skipped-test-runner', () => {
    describe('run', () => {
        [
            'TEST_BEGIN',
            'TEST_PENDING',
            'TEST_END'
        ].forEach((event) => {
            it(`should emit ${event}`, async () => {
                const onEvent = sinon.stub().named(`on${event}`);
                const test = makeTest();

                const runner = SkippedTestRunner.create(test)
                    .on(Events[event], onEvent);

                await runner.run();

                assert.calledOnceWith(onEvent, sinon.match(test));
            });

            it(`should not emit ${event} if test is disabled`, async () => {
                const onEvent = sinon.stub().named(`on${event}`);
                const test = makeTest({disabled: true});

                const runner = SkippedTestRunner.create(test)
                    .on(Events[event], onEvent);

                await runner.run();

                assert.notCalled(onEvent);
            });

            it(`should not emit ${event} if test silently skipped`, async () => {
                const onEvent = sinon.stub().named(`on${event}`);
                const test = makeTest({silentSkip: true});

                const runner = SkippedTestRunner.create(test)
                    .on(Events[event], onEvent);

                await runner.run();

                assert.notCalled(onEvent);
            });

            it(`should not emit ${event} if test from describe which is silently skipped`, async () => {
                const onEvent = sinon.stub().named(`on${event}`);
                const suite1 = makeSuite({silentSkip: true});
                const suite2 = makeSuite({parent: suite1});
                const test = makeTest({parent: suite2});

                const runner = SkippedTestRunner.create(test)
                    .on(Events[event], onEvent);

                await runner.run();

                assert.notCalled(onEvent);
            });
        });

        it('should emit events in right order', async () => {
            const onTestBegin = sinon.stub().named(`onTestBegin`);
            const onTestPending = sinon.stub().named(`onTestPending`);
            const onTestEnd = sinon.stub().named(`onTestEnd`);

            const runner = SkippedTestRunner.create(makeTest)
                .on(Events.TEST_BEGIN, onTestBegin)
                .on(Events.TEST_PENDING, onTestPending)
                .on(Events.TEST_END, onTestEnd);

            await runner.run();

            assert.callOrder(onTestBegin, onTestPending, onTestEnd);
        });
    });
});
