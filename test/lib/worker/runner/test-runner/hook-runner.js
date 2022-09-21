'use strict';

const Promise = require('bluebird');
const HookRunner = require('build/worker/runner/test-runner/hook-runner');
const ExecutionThread = require('build/worker/runner/test-runner/execution-thread');
const {Suite, Test} = require('../../../_mocha');

describe('worker/runner/test-runner/hook-runner', () => {
    const sandbox = sinon.sandbox.create();

    const mkRunner_ = (opts = {}) => {
        const test = opts.test || Test.create(Suite.create());

        return HookRunner.create(test, Object.create(ExecutionThread.prototype));
    };

    beforeEach(() => {
        sandbox.stub(ExecutionThread.prototype, 'run').callsFake(async (runnable) => {
            await runnable.fn();
        });
    });

    afterEach(() => sandbox.restore());

    describe('runBeforeEachHooks', () => {
        it('should run hook in execution thread', async () => {
            const test = Test.create();

            const suite = Suite.create()
                .beforeEach(() => {})
                .addTest(test);

            await mkRunner_({test}).runBeforeEachHooks();

            assert.calledWithMatch(ExecutionThread.prototype.run, suite.beforeEachHooks[0]);
        });

        it('should protect hook from modification during run in execution thread', async () => {
            const test = Test.create();

            const suite = Suite.create()
                .beforeEach(() => {})
                .addTest(test);

            ExecutionThread.prototype.run.callsFake((hook) => hook.foo = 'bar');

            await mkRunner_({test}).runBeforeEachHooks();

            assert.notProperty(suite.beforeEachHooks[0], 'foo');
        });

        it('should call beforeEach hooks for all parents', async () => {
            const topLevelHook1 = sinon.spy().named('topLevelHook1');
            const topLevelHook2 = sinon.spy().named('topLevelHook2');
            const hook1 = sinon.spy().named('hook1');
            const hook2 = sinon.spy().named('hook2');

            const test = Test.create();

            Suite.create()
                .beforeEach(topLevelHook1)
                .beforeEach(topLevelHook2)
                .addSuite(
                    Suite.create()
                        .beforeEach(hook1)
                        .beforeEach(hook2)
                        .addTest(test)
                );

            await mkRunner_({test}).runBeforeEachHooks();

            assert.callOrder(
                topLevelHook1,
                topLevelHook2,
                hook1,
                hook2
            );
        });

        it('should wait until first hook finished before next hook started', async () => {
            const afterFirstHook = sinon.spy().named('afterFirstHook');
            const firstHook = sinon.stub().callsFake(() => Promise.delay(10).then(afterFirstHook));
            const secondHook = sinon.spy().named('secondHook');

            const test = Test.create();

            Suite.create()
                .beforeEach(firstHook)
                .beforeEach(secondHook)
                .addTest(test);

            await mkRunner_({test}).runBeforeEachHooks();

            assert.callOrder(
                afterFirstHook,
                secondHook
            );
        });

        it('should wait until parent hook finished before child hook start', async () => {
            const afterParentHook = sinon.spy().named('afterParentHook');
            const parentHook = sinon.stub().callsFake(() => Promise.delay(10).then(afterParentHook));
            const childHook = sinon.spy().named('childHook');

            const test = Test.create();

            Suite.create()
                .beforeEach(parentHook)
                .addSuite(
                    Suite.create()
                        .beforeEach(childHook)
                        .addTest(test)
                );

            await mkRunner_({test}).runBeforeEachHooks();

            assert.callOrder(
                afterParentHook,
                childHook
            );
        });

        it('should fail on first hook fail', async () => {
            const secondParentHook = sinon.spy().named('secondParentHook');
            const childHook = sinon.spy().named('childHook');

            const test = Test.create();

            Suite.create()
                .beforeEach(() => Promise.reject(new Error('foo')))
                .beforeEach(secondParentHook)
                .addSuite(
                    Suite.create()
                        .beforeEach(childHook)
                        .addTest(test)
                );

            const runner = mkRunner_({test});

            await assert.isRejected(runner.runBeforeEachHooks(), /foo/);
            assert.notCalled(secondParentHook);
            assert.notCalled(childHook);
        });
    });

    describe('runAfterEachHooks', () => {
        it('should run hook in execution thread', async () => {
            const test = Test.create();

            const suite = Suite.create()
                .afterEach(() => {})
                .addTest(test);

            await mkRunner_({test}).runAfterEachHooks();

            assert.calledWithMatch(ExecutionThread.prototype.run, suite.afterEachHooks[0]);
        });

        it('should protect hook from modification during run in execution thread', async () => {
            const test = Test.create();

            const suite = Suite.create()
                .afterEach(() => {})
                .addTest(test);

            ExecutionThread.prototype.run.callsFake((hook) => hook.foo = 'bar');

            await mkRunner_({test}).runAfterEachHooks();

            assert.notProperty(suite.afterEachHooks[0], 'foo');
        });

        it('should call afterEach hooks for all parents', async () => {
            const topLevelHook1 = sinon.spy().named('topLevelHook1');
            const topLevelHook2 = sinon.spy().named('topLevelHook2');
            const hook1 = sinon.spy().named('hook1');
            const hook2 = sinon.spy().named('hook2');

            const test = Test.create();

            Suite.create()
                .afterEach(topLevelHook1)
                .afterEach(topLevelHook2)
                .addSuite(
                    Suite.create()
                        .afterEach(hook1)
                        .afterEach(hook2)
                        .addTest(test)
                );

            await mkRunner_({test}).runAfterEachHooks();

            assert.callOrder(
                hook1,
                hook2,
                topLevelHook1,
                topLevelHook2
            );
        });

        it('should wait until first hook finished before next hook started', async () => {
            const afterFirstHook = sinon.spy().named('afterFirstHook');
            const firstHook = sinon.stub().callsFake(() => Promise.delay(10).then(afterFirstHook));
            const secondHook = sinon.spy().named('secondHook');

            const test = Test.create();

            Suite.create()
                .afterEach(firstHook)
                .afterEach(secondHook)
                .addTest(test);

            await mkRunner_({test}).runAfterEachHooks();

            assert.callOrder(
                afterFirstHook,
                secondHook
            );
        });

        it('should wait until child hook finished before parent hook start', async () => {
            const afterChildHook = sinon.spy().named('afterChildHook');
            const childHook = sinon.stub().callsFake(() => Promise.delay(10).then(afterChildHook));
            const parentHook = sinon.spy().named('parentHook');

            const test = Test.create();

            Suite.create()
                .afterEach(parentHook)
                .addSuite(
                    Suite.create()
                        .afterEach(childHook)
                        .addTest(test)
                );

            await mkRunner_({test}).runAfterEachHooks();

            assert.callOrder(
                afterChildHook,
                parentHook
            );
        });

        it('should fail on first hook fail in suite', async () => {
            const secondHook = sinon.spy().named('secondHook');

            const test = Test.create();

            Suite.create()
                .afterEach(() => Promise.reject(new Error('foo')))
                .afterEach(secondHook)
                .addTest(test);

            const runner = mkRunner_({test});

            await assert.isRejected(runner.runAfterEachHooks(), /foo/);
            assert.notCalled(secondHook);
        });

        it('should run parent hook even if child hook failed', async () => {
            const parentHook = sinon.spy().named('parentHook');

            const test = Test.create();

            Suite.create()
                .afterEach(parentHook)
                .addSuite(
                    Suite.create()
                        .afterEach(() => Promise.reject(new Error('foo')))
                        .addTest(test)
                );

            const runner = mkRunner_({test});

            await assert.isRejected(runner.runAfterEachHooks(), /foo/);
            assert.calledOnce(parentHook);
        });

        it('should reject with child hook error if both child and parent hooks failed', async () => {
            const test = Test.create();

            Suite.create()
                .afterEach(() => Promise.reject(new Error('bar')))
                .addSuite(
                    Suite.create()
                        .afterEach(() => Promise.reject(new Error('foo')))
                        .addTest(test)
                );

            const runner = mkRunner_({test});

            await assert.isRejected(runner.runAfterEachHooks(), /foo/);
        });

        it('should run only parent afterEach hook if parent beforeEach hook failed', async () => {
            const parentHook = sinon.spy().named('parentHook');
            const childHook = sinon.spy().named('childHook');

            const test = Test.create();

            Suite.create()
                .beforeEach(() => Promise.reject(new Error()))
                .afterEach(parentHook)
                .addSuite(
                    Suite.create()
                        .afterEach(childHook)
                        .addTest(test)
                );

            const runner = mkRunner_({test});
            await runner.runBeforeEachHooks().catch(() => {});

            await runner.runAfterEachHooks();

            assert.calledOnce(parentHook);
            assert.notCalled(childHook);
        });
    });
});
