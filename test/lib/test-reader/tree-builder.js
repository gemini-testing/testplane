'use strict';

const {TreeBuilder} = require('src/test-reader/tree-builder');
const {Suite, Test, Hook} = require('src/test-reader/test-object');

describe('test-reader/tree-builder', () => {
    const sandbox = sinon.sandbox.create();

    beforeEach(() => {
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe('addSuite', () => {
        beforeEach(() => {
            sandbox.stub(Suite.prototype, 'addSuite');
        });

        it('should be chainable', () => {
            const builder = new TreeBuilder();

            const res = builder.addSuite();

            assert.equal(res, builder);
        });

        it('should set first passed suite as root suite', () => {
            const suiteFoo = new Suite({title: 'foo'});
            const suiteBar = new Suite({title: 'bar'});
            const builder = new TreeBuilder()
                .addSuite(suiteFoo)
                .addSuite(suiteBar);

            assert.equal(builder.getRootSuite(), suiteFoo);
        });

        it('should link suite with its parent', () => {
            const parentSuite = new Suite({title: 'foo'});
            const childSuite = new Suite({title: 'bar'});

            new TreeBuilder()
                .addSuite(childSuite, parentSuite);

            assert.calledOnceWith(Suite.prototype.addSuite, childSuite);
            assert.calledOn(Suite.prototype.addSuite, parentSuite);
        });

        it('should apply traps for suite', () => {
            const trapFoo = sinon.spy().named('trapFoo');
            const trapBar = sinon.spy().named('trapBar');
            const suite = new Suite({});

            new TreeBuilder()
                .addTrap(trapFoo)
                .addTrap(trapBar)
                .addSuite(suite);

            assert.calledOnceWith(trapFoo, suite);
            assert.calledOnceWith(trapBar, suite);
            assert.callOrder(trapFoo, trapBar);
        });

        it('should apply traps only once', () => {
            const trapFoo = sinon.spy().named('trapFoo');
            const trapBar = sinon.spy().named('trapBar');

            new TreeBuilder()
                .addTrap(trapFoo)
                .addTrap(trapBar)
                .addSuite(new Suite({}))
                .addSuite(new Suite({}));

            assert.calledOnce(trapFoo);
            assert.calledOnce(trapBar);
        });

        it('should apply traps after linking with parent', () => {
            const trapFoo = sinon.spy().named('trapFoo');

            new TreeBuilder()
                .addTrap(trapFoo)
                .addSuite(new Suite({}), new Suite({}));

            assert.callOrder(Suite.prototype.addSuite, trapFoo);
        });
    });

    describe('addTest', () => {
        beforeEach(() => {
            sandbox.stub(Suite.prototype, 'addTest');
        });

        it('should be chainable', () => {
            const builder = new TreeBuilder();

            const res = builder.addTest(new Test({}), new Suite({}));

            assert.equal(res, builder);
        });

        it('should fail if no parent passed', () => {
            const builder = new TreeBuilder();

            assert.throws(() => builder.addTest(new Test({})), 'of undefined');
        });

        it('should link test with its parent', () => {
            const suite = new Suite({title: 'foo'});
            const test = new Test({title: 'bar'});

            new TreeBuilder()
                .addTest(test, suite);

            assert.calledOnceWith(Suite.prototype.addTest, test);
            assert.calledOn(Suite.prototype.addTest, suite);
        });

        it('should apply traps for test', () => {
            const trapFoo = sinon.spy().named('trapFoo');
            const trapBar = sinon.spy().named('trapBar');
            const test = new Test({});

            new TreeBuilder()
                .addTrap(trapFoo)
                .addTrap(trapBar)
                .addTest(test, new Suite({}));

            assert.calledOnceWith(trapFoo, test);
            assert.calledOnceWith(trapBar, test);
            assert.callOrder(trapFoo, trapBar);
        });

        it('should apply traps only once', () => {
            const trapFoo = sinon.spy().named('trapFoo');
            const trapBar = sinon.spy().named('trapBar');

            new TreeBuilder()
                .addTrap(trapFoo)
                .addTrap(trapBar)
                .addTest(new Test({}), new Suite({}))
                .addTest(new Test({}), new Suite({}));

            assert.calledOnce(trapFoo);
            assert.calledOnce(trapBar);
        });

        it('should apply traps after linking with parent', () => {
            const trapFoo = sinon.spy().named('trapFoo');

            new TreeBuilder()
                .addTrap(trapFoo)
                .addTest(new Test({}), new Suite({}));

            assert.callOrder(Suite.prototype.addTest, trapFoo);
        });
    });

    describe('addBeforeEachHook', () => {
        beforeEach(() => {
            sandbox.stub(Suite.prototype, 'addBeforeEachHook');
        });

        it('should be chainable', () => {
            const builder = new TreeBuilder();

            const res = builder.addBeforeEachHook(new Hook({}), new Suite({}));

            assert.equal(res, builder);
        });

        it('should fail if no parent passed', () => {
            const builder = new TreeBuilder();

            assert.throws(() => builder.addBeforeEachHook(new Hook({})), 'of undefined');
        });

        it('should link hook with its parent', () => {
            const suite = new Suite({title: 'foo'});
            const hook = new Hook({title: 'bar'});

            new TreeBuilder()
                .addBeforeEachHook(hook, suite);

            assert.calledOnceWith(Suite.prototype.addBeforeEachHook, hook);
            assert.calledOn(Suite.prototype.addBeforeEachHook, suite);
        });

        it('should not apply traps for hook', () => {
            const trap = sinon.spy().named('trap');

            new TreeBuilder()
                .addTrap(trap)
                .addBeforeEachHook(new Hook({}), new Suite({}));

            assert.notCalled(trap);
        });
    });

    describe('addAfterEachHook', () => {
        beforeEach(() => {
            sandbox.stub(Suite.prototype, 'addAfterEachHook');
        });

        it('should be chainable', () => {
            const builder = new TreeBuilder();

            const res = builder.addAfterEachHook(new Hook({}), new Suite({}));

            assert.equal(res, builder);
        });

        it('should fail if no parent passed', () => {
            const builder = new TreeBuilder();

            assert.throws(() => builder.addAfterEachHook(new Hook({})), 'of undefined');
        });

        it('should link hook with its parent', () => {
            const suite = new Suite({title: 'foo'});
            const hook = new Hook({title: 'bar'});

            new TreeBuilder()
                .addAfterEachHook(hook, suite);

            assert.calledOnceWith(Suite.prototype.addAfterEachHook, hook);
            assert.calledOn(Suite.prototype.addAfterEachHook, suite);
        });

        it('should not apply traps for hook', () => {
            const trap = sinon.spy().named('trap');

            new TreeBuilder()
                .addTrap(trap)
                .addAfterEachHook(new Hook({}), new Suite({}));

            assert.notCalled(trap);
        });
    });

    describe('addTrap', () => {
        it('should be chainable', () => {
            const builder = new TreeBuilder();

            const res = builder.addTrap(() => {});

            assert.equal(res, builder);
        });
    });

    describe('addTestFilter', () => {
        beforeEach(() => {
            sandbox.stub(Suite.prototype, 'filterTests');
        });

        it('should be chainable', () => {
            const builder = new TreeBuilder();

            const res = builder.addTestFilter(() => true);

            assert.equal(res, builder);
        });

        it('should not apply filter on site', () => {
            new TreeBuilder()
                .addSuite(new Suite())
                .addTestFilter(() => true);

            assert.notCalled(Suite.prototype.filterTests);
        });
    });

    describe('applyFilters', () => {
        beforeEach(() => {
            sandbox.stub(Suite.prototype, 'filterTests');
        });

        it('should be chainable', () => {
            const builder = new TreeBuilder();

            const res = builder.applyFilters();

            assert.equal(res, builder);
        });

        it('should be chainable on actual filter', () => {
            const builder = new TreeBuilder();

            const res = builder
                .addSuite(new Suite())
                .addTestFilter(() => true)
                .applyFilters();

            assert.equal(res, builder);
        });

        it('should not process tests if no any suite added', () => {
            new TreeBuilder()
                .addTestFilter(() => true)
                .applyFilters();

            assert.notCalled(Suite.prototype.filterTests);
        });

        it('should not process tests if no filter added', () => {
            new TreeBuilder()
                .addSuite(new Suite())
                .applyFilters();

            assert.notCalled(Suite.prototype.filterTests);
        });

        it('should process tests on apply', () => {
            new TreeBuilder()
                .addSuite(new Suite())
                .addTestFilter(() => true)
                .applyFilters();

            assert.calledOnce(Suite.prototype.filterTests);
        });

        it('should process tests only through root suite', () => {
            const rootSuite = new Suite();
            const childSuite = new Suite({title: 'foo'});

            new TreeBuilder()
                .addSuite(rootSuite)
                .addSuite(childSuite, rootSuite)
                .addTestFilter(() => true)
                .applyFilters();

            assert.calledOnce(Suite.prototype.filterTests);
            assert.calledOn(Suite.prototype.filterTests, rootSuite);
        });

        it('should filter tests on apply', () => {
            new TreeBuilder()
                .addSuite(new Suite())
                .addTestFilter((test) => test.title !== 'foo')
                .addTestFilter((test) => test.title !== 'baz')
                .applyFilters();

            const filter = Suite.prototype.filterTests.lastCall.args[0];

            assert.isFalse(filter(new Test({title: 'foo'})));
            assert.isTrue(filter(new Test({title: 'bar'})));
            assert.isFalse(filter(new Test({title: 'baz'})));
        });
    });
});
