'use strict';

const {Suite, Test, Hook} = require('lib/test-reader/test-object');
const {ConfigurableTestObject} = require('lib/test-reader/test-object/configurable-test-object');

describe('test-reader/test-object/suite', () => {
    const sandbox = sinon.sandbox.create();

    afterEach(() => {
        sandbox.restore();
    });

    it('should be an instance of configurable test object', () => {
        const suite = new Suite();

        assert.instanceOf(suite, ConfigurableTestObject);
    });

    describe('create', () => {
        it('should create Suite object', () => {
            const suite = Suite.create();

            assert.instanceOf(suite, Suite);
        });
    });

    describe('constructor', () => {
        before(() => {
            const stub = sandbox.stub();
            Object.setPrototypeOf(stub, Object.getPrototypeOf(Suite));
            Object.setPrototypeOf(Suite, stub);
        });

        after(() => {
            Object.setPrototypeOf(Suite, Object.getPrototypeOf(Object.getPrototypeOf(Suite)));
        });

        afterEach(() => {
            sandbox.reset();
        });

        it('should pass base properties to base class constructor', () => {
            const title = 'foo bar';
            const file = 'baz/qux.js';
            const id = 'bazqux100500';

            new Suite({title, file, id});

            assert.calledWithMatch(Object.getPrototypeOf(Suite), {title, file, id});
        });
    });

    [
        ['addSuite', Suite],
        ['addTest', Test],
        ['addBeforeEachHook', Hook],
        ['addAfterEachHook', Hook]
    ].forEach(([method, ChildClass]) => {
        describe(method, () => {
            it('should be chainable', () => {
                const suite = new Suite();

                const res = suite[method](new ChildClass({}));

                assert.equal(res, suite);
            });

            it('should set parent to added object', () => {
                const suite = new Suite();
                const child = new ChildClass({});

                suite[method](child);

                assert.equal(child.parent, suite);
            });
        });
    });

    [
        ['beforeEach', 'addBeforeEachHook', '"before each" hook'],
        ['afterEach', 'addAfterEachHook', '"after each" hook']
    ].forEach(([createMethod, addMethod, title]) => {
        describe(createMethod, () => {
            it('should create hook', () => {
                const fn = sinon.spy();
                const suite = new Suite();

                sandbox.spy(Hook, 'create');

                suite[createMethod](fn);

                assert.calledOnceWith(Hook.create, {title, fn});
            });

            it('should add created hook', () => {
                const hook = new Hook({});
                sandbox.stub(Hook, 'create').returns(hook);

                const suite = new Suite();
                sandbox.spy(suite, addMethod);

                suite[createMethod](() => {});

                assert.calledOnceWith(suite[addMethod], hook);
            });
        });
    });

    describe('eachTest', () => {
        it('should iterate over added tests recursively', () => {
            const titles = [];

            new Suite({})
                .addTest(new Test({title: 'foo'}))
                .addSuite(
                    new Suite({})
                        .addTest(new Test({title: 'bar'}))
                        .addSuite(
                            new Suite({})
                                .addTest(new Test({title: 'baz'}))
                        )
                )
                .addTest(new Test({title: 'qux'}))
                .eachTest((t) => titles.push(t.title));

            assert.deepEqual(titles, ['foo', 'qux', 'bar', 'baz']);
        });
    });

    describe('getTests', () => {
        it('should return tests for whole tree', () => {
            const testFoo = new Test({title: 'foo'});
            const testBar = new Test({title: 'bar'});
            const testBaz = new Test({title: 'baz'});
            const testQux = new Test({title: 'qux'});

            const tests = new Suite({})
                .addTest(testFoo)
                .addSuite(
                    new Suite({})
                        .addTest(testBar)
                        .addSuite(
                            new Suite({})
                                .addTest(testBaz)
                        )
                )
                .addTest(testQux)
                .getTests();

            assert.deepEqual(tests, [testFoo, testQux, testBar, testBaz]);
        });
    });

    describe('filterTests', () => {
        it('should be chainable', () => {
            const suite = new Suite();

            const res = suite.filterTests(() => true);

            assert.equal(res, suite);
        });

        it('should leave only accepted tests', () => {
            const testFoo = new Test({title: 'foo'});
            const testBar = new Test({title: 'bar'});
            const testBaz = new Test({title: 'baz'});
            const testQux = new Test({title: 'qux'});

            const tests = new Suite({})
                .addTest(testFoo)
                .addSuite(
                    new Suite({})
                        .addTest(testBar)
                        .addSuite(
                            new Suite({})
                                .addTest(testBaz)
                        )
                )
                .addTest(testQux)
                .filterTests((t) => ['bar', 'qux'].includes(t.title))
                .getTests();

            assert.deepEqual(tests, [testQux, testBar]);
        });
    });

    describe('root', () => {
        it('should be true if no parent set', () => {
            const suite = new Suite();

            assert.isTrue(suite.root);
        });

        it('should be false if parent set', () => {
            const suite = new Suite();
            suite.parent = new Suite();

            assert.isFalse(suite.root);
        });
    });

    describe('suites', () => {
        it('should return only own children', () => {
            const suiteFoo = new Suite({title: 'foo'});
            const suiteBar = new Suite({title: 'bar'});
            const suiteBaz = new Suite({title: 'baz'});

            suiteBar.addSuite(suiteBaz);

            const suite = new Suite({});
            suite.addSuite(suiteFoo);
            suite.addSuite(suiteBar);

            assert.deepEqual(suite.suites, [suiteFoo, suiteBar]);
        });
    });

    [
        ['tests', 'addTest', Test],
        ['beforeEachHooks', 'addBeforeEachHook', Hook],
        ['afterEachHooks', 'addAfterEachHook', Hook]
    ].forEach(([getter, addMethod, ChildClass]) => {
        describe(getter, () => {
            it('should return only own children', () => {
                const childFoo = new ChildClass({title: 'foo'});
                const childBar = new ChildClass({title: 'bar'});
                const childBaz = new ChildClass({title: 'baz'});

                const childSuite = new Suite({});
                childSuite[addMethod](childBaz);

                const suite = new Suite({});
                suite[addMethod](childFoo);
                suite[addMethod](childBar);
                suite.addSuite(childSuite);

                const children = suite[getter];

                assert.deepEqual(children, [childFoo, childBar]);
            });
        });
    });
});
