'use strict';

const {TreeBuilderDecorator} = require('lib/test-reader/mocha-reader/tree-builder-decorator');
const {TreeBuilder} = require('lib/test-reader/tree-builder');
const {Suite, Test, Hook} = require('lib/test-reader/test-object');
const crypto = require('lib/utils/crypto');

describe('test-reader/mocha-reader/tree-builder-decorator', () => {
    const sandbox = sinon.sandbox.create();

    const mkDecorator_ = (baseDecorator) => {
        return TreeBuilderDecorator.create(baseDecorator || sinon.createStubInstance(TreeBuilder));
    };

    const mkMochaSuite_ = (opts = {}) => {
        return {
            'mocha_id': 'some-default-id',
            title: 'some default title',
            file: 'some/default/file',
            pending: false,
            parent: null,
            timeout: sinon.stub().named('timeout'),
            ...opts
        };
    };

    const mkMochaTest_ = (opts = {}) => {
        return {
            title: 'some default title',
            file: 'some/default/file',
            fn: sinon.spy().named('someDefaultFn'),
            pending: false,
            parent: mkMochaSuite_(),
            timeout: sinon.stub().named('timeout'),
            fullTitle: sinon.stub().named('fullTitle'),
            ...opts
        };
    };

    const mkMochaHook_ = (opts = {}) => {
        return {
            fn: sinon.spy().named('someDefaultFn'),
            parent: mkMochaSuite_(),
            ...opts
        };
    };

    beforeEach(() => {
        sandbox.stub(crypto, 'getShortMD5');

        sandbox.stub(Suite, 'create').returns(new Suite());

        sandbox.stub(Test, 'create').returns(new Test({}));

        sandbox.stub(Hook, 'create').returns(new Hook({}));
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe('addSuite', () => {
        it('should be chainable', () => {
            const decorator = mkDecorator_();

            const res = decorator.addSuite(mkMochaSuite_());

            assert.equal(res, decorator);
        });

        it('should create suite', () => {
            mkDecorator_()
                .addSuite(mkMochaSuite_());

            assert.calledOnce(Suite.create);
        });

        it('should pass title to suite constructor', () => {
            mkDecorator_()
                .addSuite(mkMochaSuite_({title: 'foo bar'}));

            assert.calledWithMatch(Suite.create, {title: 'foo bar'});
        });

        it('should pass file to suite constructor', () => {
            mkDecorator_()
                .addSuite(mkMochaSuite_({file: 'foo/bar.js'}));

            assert.calledWithMatch(Suite.create, {file: 'foo/bar.js'});
        });

        it('should pass id based on file and parse position to suite constructor', () => {
            crypto.getShortMD5
                .withArgs('foo/bar.js').returns('foobar')
                .withArgs('baz/qux.js').returns('bazqux');

            mkDecorator_()
                .addSuite(mkMochaSuite_({'mocha_id': '00', file: 'foo/bar.js'}))
                .addSuite(mkMochaSuite_({'mocha_id': '01', file: 'baz/qux.js'}))
                .addSuite(mkMochaSuite_({'mocha_id': '02', file: 'foo/bar.js'}));

            assert.calledWithMatch(Suite.create, {file: 'foo/bar.js', id: 'foobar0'});
            assert.calledWithMatch(Suite.create, {file: 'baz/qux.js', id: 'bazqux1'});
            assert.calledWithMatch(Suite.create, {file: 'foo/bar.js', id: 'foobar2'});
        });

        it('should passthrough mocha id to suite constructor for root suite', () => {
            mkDecorator_()
                .addSuite(mkMochaSuite_({'mocha_id': 'foobar', root: true}));

            assert.calledWithMatch(Suite.create, {id: 'foobar'});
            assert.notCalled(crypto.getShortMD5);
        });

        it('should apply timeout to created suite if no parent', () => {
            const suite = new Suite({});
            Suite.create.returns(suite);

            mkDecorator_()
                .addSuite(mkMochaSuite_({timeout: () => 100500}));

            assert.equal(suite.timeout, 100500);
        });

        it('should not apply timeout if it is the same as parent timeout', () => {
            const suite = new Suite({});
            const timeout = sinon.spy().named('timeout');
            sandbox.stub(suite, 'timeout').set((val) => timeout(val));
            Suite.create.returns(suite);

            mkDecorator_()
                .addSuite(mkMochaSuite_({
                    parent: mkMochaSuite_({timeout: () => 100500}),
                    timeout: () => 100500
                }));

            assert.notCalled(timeout);
        });

        it('should apply timeout if it differs from parent timeout', () => {
            const suite = new Suite({});
            const timeout = sinon.spy().named('timeout');
            sandbox.stub(suite, 'timeout').set(timeout);
            Suite.create.returns(suite);

            mkDecorator_()
                .addSuite(mkMochaSuite_({
                    parent: mkMochaSuite_({timeout: () => 500100}),
                    timeout: () => 100500
                }));

            assert.calledOnceWith(timeout, 100500);
        });

        it('should skip pending suite', () => {
            const suite = new Suite({});
            sandbox.spy(suite, 'skip');
            Suite.create.returns(suite);

            mkDecorator_()
                .addSuite(mkMochaSuite_({pending: true}));

            assert.calledOnceWith(suite.skip, {reason: 'Skipped by mocha interface'});
        });

        it('should not skip regular suite', () => {
            const suite = new Suite({});
            sandbox.spy(suite, 'skip');
            Suite.create.returns(suite);

            mkDecorator_()
                .addSuite(mkMochaSuite_());

            assert.notCalled(suite.skip);
        });

        it('should pass created suite to base tree builder', () => {
            const treeBuilder = sinon.createStubInstance(TreeBuilder);
            const suite = new Suite();
            Suite.create.returns(suite);

            mkDecorator_(treeBuilder)
                .addSuite(mkMochaSuite_());

            assert.calledOnceWith(treeBuilder.addSuite, suite);
        });

        it('should pass null as a parent suite to base tree builder if no parent', () => {
            const treeBuilder = sinon.createStubInstance(TreeBuilder);

            mkDecorator_(treeBuilder)
                .addSuite(mkMochaSuite_());

            assert.calledOnceWith(treeBuilder.addSuite, sinon.match.any, null);
        });

        it('should pass parent suite to base tree builder if set', () => {
            const parentSuite = new Suite({title: 'parent'});
            const childSuite = new Suite({title: 'child'});

            Suite.create
                .onFirstCall().returns(parentSuite)
                .onSecondCall().returns(childSuite);

            const treeBuilder = sinon.createStubInstance(TreeBuilder);
            const parentMochaSuite = mkMochaSuite_({'mocha_id': 'foo'});

            mkDecorator_(treeBuilder)
                .addSuite(parentMochaSuite)
                .addSuite(mkMochaSuite_({'mocha_id': 'bar', parent: parentMochaSuite}));

            assert.calledWith(treeBuilder.addSuite, childSuite, parentSuite);
        });
    });

    describe('addTest', () => {
        it('should be chainable', () => {
            const decorator = mkDecorator_();

            const res = decorator.addTest(mkMochaTest_());

            assert.equal(res, decorator);
        });

        it('should create test', () => {
            mkDecorator_()
                .addTest(mkMochaTest_());

            assert.calledOnce(Test.create);
        });

        it('should pass title to test constructor', () => {
            mkDecorator_()
                .addTest(mkMochaTest_({title: 'foo bar'}));

            assert.calledWithMatch(Test.create, {title: 'foo bar'});
        });

        it('should pass file to test constructor', () => {
            mkDecorator_()
                .addTest(mkMochaTest_({file: 'foo/bar.js'}));

            assert.calledWithMatch(Test.create, {file: 'foo/bar.js'});
        });

        it('should pass id based on full title to test constructor', () => {
            const test = mkMochaTest_();
            test.fullTitle.returns('foo bar');

            crypto.getShortMD5.withArgs('foo bar').returns('bazqux');

            mkDecorator_()
                .addTest(test);

            assert.calledWithMatch(Test.create, {id: 'bazqux'});
        });

        it('should pass test function to test constructor', () => {
            const fn = sinon.spy().named('fn');

            mkDecorator_()
                .addTest(mkMochaTest_({fn}));

            assert.calledWithMatch(Test.create, {fn});
        });

        it('should apply timeout to created test if it differs from parent timeout', () => {
            const test = new Test({});
            const timeout = sinon.spy().named('timeout');
            sandbox.stub(test, 'timeout').set(timeout);
            Test.create.returns(test);

            mkDecorator_()
                .addTest(mkMochaTest_({
                    parent: mkMochaSuite_({timeout: () => 500100}),
                    timeout: () => 100500
                }));

            assert.calledOnceWith(timeout, 100500);
        });

        it('should not apply timeout if it is the same as parent timeout', () => {
            const test = new Test({});
            const timeout = sinon.spy().named('timeout');
            sandbox.stub(test, 'timeout').set(timeout);
            Test.create.returns(test);

            mkDecorator_()
                .addTest(mkMochaTest_({
                    parent: mkMochaSuite_({timeout: () => 100500}),
                    timeout: () => 100500
                }));

            assert.notCalled(timeout);
        });

        it('should skip pending test', () => {
            const test = new Test({});
            sandbox.spy(test, 'skip');
            Test.create.returns(test);

            mkDecorator_()
                .addTest(mkMochaTest_({pending: true}));

            assert.calledOnceWith(test.skip, {reason: 'Skipped by mocha interface'});
        });

        it('should not skip regular test', () => {
            const test = sinon.createStubInstance(Suite);
            Suite.create.returns(test);

            mkDecorator_()
                .addTest(mkMochaTest_());

            assert.notCalled(test.skip);
        });

        it('should pass created test to base tree builder', () => {
            const treeBuilder = sinon.createStubInstance(TreeBuilder);
            const test = new Test({});
            Test.create.returns(test);

            mkDecorator_(treeBuilder)
                .addTest(mkMochaTest_());

            assert.calledOnceWith(treeBuilder.addTest, test);
        });

        it('should pass parent suite to base tree builder', () => {
            const parentSuite = new Suite({title: 'parent'});
            Suite.create.returns(parentSuite);

            const treeBuilder = sinon.createStubInstance(TreeBuilder);
            const parentMochaSuite = mkMochaSuite_({'mocha_id': 'foo'});

            mkDecorator_(treeBuilder)
                .addSuite(parentMochaSuite)
                .addTest(mkMochaTest_({parent: parentMochaSuite}));

            assert.calledOnceWith(treeBuilder.addTest, sinon.match.any, parentSuite);
        });
    });

    [
        'addBeforeEachHook',
        'addAfterEachHook'
    ].forEach((method) => {
        describe(method, () => {
            it('should be chainable', () => {
                const decorator = mkDecorator_();

                const res = decorator[method](mkMochaHook_());

                assert.equal(res, decorator);
            });

            it('should create hook', () => {
                const decorator = mkDecorator_();

                decorator[method](mkMochaHook_());

                assert.calledOnce(Hook.create);
            });

            it('should pass title to hook constructor', () => {
                const decorator = mkDecorator_();

                decorator[method](mkMochaHook_({title: 'foo bar'}));

                assert.calledWithMatch(Hook.create, {title: 'foo bar'});
            });

            it('should pass hook function to hook constructor', () => {
                const fn = sinon.spy().named('fn');

                const decorator = mkDecorator_();

                decorator[method](mkMochaHook_({fn}));

                assert.calledWithMatch(Hook.create, {fn});
            });

            it('should pass created hook to base tree builder', () => {
                const treeBuilder = sinon.createStubInstance(TreeBuilder);
                const hook = new Hook({});
                Hook.create.returns(hook);

                const decorator = mkDecorator_(treeBuilder);

                decorator[method](mkMochaHook_());

                assert.calledOnceWith(treeBuilder[method], hook);
            });

            it('should pass parent suite to base tree builder', () => {
                const parentSuite = new Suite({title: 'parent'});
                Suite.create.returns(parentSuite);

                const treeBuilder = sinon.createStubInstance(TreeBuilder);
                const parentMochaSuite = mkMochaSuite_({'mocha_id': 'foo'});

                const decorator = mkDecorator_(treeBuilder)
                    .addSuite(parentMochaSuite);

                decorator[method](mkMochaHook_({parent: parentMochaSuite}));

                assert.calledOnceWith(treeBuilder[method], sinon.match.any, parentSuite);
            });
        });
    });

    describe('addTrap', () => {
        it('should be chainable', () => {
            const decorator = mkDecorator_();

            const res = decorator.addTrap(() => {});

            assert.equal(res, decorator);
        });

        it('should passthrough directly to original builder', () => {
            const trap = sinon.spy();
            const treeBuilder = sinon.createStubInstance(TreeBuilder);

            mkDecorator_(treeBuilder).addTrap(trap);

            assert.calledOnceWith(treeBuilder.addTrap, trap);
        });
    });

    describe('addTestFilter', () => {
        it('should be chainable', () => {
            const decorator = mkDecorator_();

            const res = decorator.addTestFilter(() => {});

            assert.equal(res, decorator);
        });

        it('should passthrough directly to original builder', () => {
            const filter = sinon.spy();
            const treeBuilder = sinon.createStubInstance(TreeBuilder);

            mkDecorator_(treeBuilder).addTestFilter(filter);

            assert.calledOnceWith(treeBuilder.addTestFilter, filter);
        });
    });

    describe('applyFilters', () => {
        it('should be chainable', () => {
            const decorator = mkDecorator_();

            const res = decorator.applyFilters(() => {});

            assert.equal(res, decorator);
        });

        it('should passthrough directly to original builder', () => {
            const treeBuilder = sinon.createStubInstance(TreeBuilder);

            mkDecorator_(treeBuilder).applyFilters();

            assert.calledOnce(treeBuilder.applyFilters);
        });
    });

    describe('getRootSuite', () => {
        it('should passthrough directly to original builder', () => {
            const treeBuilder = sinon.createStubInstance(TreeBuilder);
            const rootSuite = new Suite({});
            treeBuilder.getRootSuite.returns(rootSuite);

            const res = mkDecorator_(treeBuilder).getRootSuite();

            assert.equal(res, rootSuite);
        });
    });
});
