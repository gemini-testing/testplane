'use strict';

const SkippedTestRunner = require('src/runner/test-runner/skipped-test-runner');
const Events = require('src/constants/runner-events');
const {Test, Suite} = require('src/test-reader/test-object');

describe('runner/test-runner/skipped-test-runner', () => {
    const sandbox = sinon.sandbox.create();

    afterEach(() => {
        sandbox.restore();
    });

    describe('constructor', () => {
        it('should clone passed test', () => {
            const test = new Test({title: 'foo bar'});
            sandbox.spy(test, 'clone');

            SkippedTestRunner.create(test);

            assert.calledOnce(test.clone);
        });
    });

    describe('run', () => {
        [
            'TEST_BEGIN',
            'TEST_PENDING',
            'TEST_END'
        ].forEach((event) => {
            it(`should emit ${event}`, async () => {
                const onEvent = sinon.stub().named(`on${event}`);
                const test = new Test({});

                const runner = SkippedTestRunner.create(test)
                    .on(Events[event], onEvent);

                await runner.run();

                assert.calledOnceWith(onEvent, sinon.match(test));
            });

            it(`should not emit ${event} if test is disabled`, async () => {
                const onEvent = sinon.stub().named(`on${event}`);
                const test = Object.assign(new Test({}), {disabled: true});

                const runner = SkippedTestRunner.create(test)
                    .on(Events[event], onEvent);

                await runner.run();

                assert.notCalled(onEvent);
            });

            it(`should not emit ${event} if test silently skipped`, async () => {
                const onEvent = sinon.stub().named(`on${event}`);
                const test = Object.assign(new Test({}), {silentSkip: true});

                const runner = SkippedTestRunner.create(test)
                    .on(Events[event], onEvent);

                await runner.run();

                assert.notCalled(onEvent);
            });

            it(`should not emit ${event} if test from describe which is silently skipped`, async () => {
                const onEvent = sinon.stub().named(`on${event}`);
                const suite1 = Object.assign(new Suite(), {silentSkip: true});
                const suite2 = Object.assign(new Suite(), {parent: suite1});
                const test = Object.assign(new Test({}), {parent: suite2});

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

            const runner = SkippedTestRunner.create(new Test({}))
                .on(Events.TEST_BEGIN, onTestBegin)
                .on(Events.TEST_PENDING, onTestPending)
                .on(Events.TEST_END, onTestEnd);

            await runner.run();

            assert.callOrder(onTestBegin, onTestPending, onTestEnd);
        });
    });
});
