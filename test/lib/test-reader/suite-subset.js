'use strict';

const Suite = require('../_mocha/suite');
const SuiteSubset = require('lib/test-reader/suite-subset');

class RootSuite extends Suite {
    addSuite(suite) {
        this.suites.push(suite);
        this.emit('suite', suite);
    }

    addTest(test) {
        this.tests.push(test);
        this.emit('test', test);
    }
}

describe('test-reader/suite-subset', () => {
    [
        'on',
        'prependListener'
    ].forEach((method) => {
        describe(method, () => {
            it('should be applied to root suite', () => {
                const root = RootSuite.create();
                sinon.spy(root, method);

                const subset = SuiteSubset.create(root);
                const cb = sinon.spy();
                subset[method]('someEvent', cb);

                assert.calledWith(root[method], 'someEvent', cb);
            });

            it('should remove listener after file read', () => {
                const root = RootSuite.create();
                sinon.spy(root, 'removeListener');

                const subset = SuiteSubset.create(root, '/some/file.js');
                const cb = sinon.spy();
                subset[method]('someEvent', cb);
                root.emit('post-require', {}, '/some/file.js');

                assert.calledWith(root.removeListener, 'someEvent', cb);
            });
        });
    });

    describe('suites', () => {
        it('should contain only suites added after subset creation but before file read finished', () => {
            const suite1 = {title: 'suite1'};
            const suite2 = {title: 'suite2'};
            const suite3 = {title: 'suite3'};
            const suite4 = {title: 'suite4'};

            const root = RootSuite.create();
            root.addSuite(suite1);

            const subset = SuiteSubset.create(root, '/some/file.js');
            root.addSuite(suite2);
            root.addSuite(suite3);
            root.emit('post-require', {}, '/some/file.js');

            root.addSuite(suite4);

            assert.deepEqual(subset.suites, [
                suite2,
                suite3
            ]);
        });

        it('should not be modified by post-require from other file', () => {
            const suite1 = {title: 'suite1'};
            const suite2 = {title: 'suite2'};
            const suite3 = {title: 'suite3'};
            const suite4 = {title: 'suite4'};

            const root = RootSuite.create();
            root.addSuite(suite1);

            const subset = SuiteSubset.create(root, '/some/file.js');
            root.addSuite(suite2);
            root.addSuite(suite3);
            root.emit('post-require', {}, '/some/file.js');

            root.addSuite(suite4);
            root.emit('post-require', {}, '/other/file.js');

            assert.deepEqual(subset.suites, [
                suite2,
                suite3
            ]);
        });

        it('should return all suites since subset creation if reading is in progress', () => {
            const suite1 = {title: 'suite1'};
            const suite2 = {title: 'suite2'};
            const suite3 = {title: 'suite3'};

            const root = RootSuite.create();
            root.addSuite(suite1);

            const subset = SuiteSubset.create(root, '/some/file.js');
            root.addSuite(suite2);
            root.addSuite(suite3);

            assert.deepEqual(subset.suites, [
                suite2,
                suite3
            ]);
        });

        it('should replace only own subset of suites on set', () => {
            const suite1 = {title: 'suite1'};
            const suite2 = {title: 'suite2'};
            const suite3 = {title: 'suite3'};
            const suite4 = {title: 'suite4'};

            const root = RootSuite.create();
            root.addSuite(suite1);

            const subset = SuiteSubset.create(root, '/some/file.js');
            root.addSuite(suite2);
            root.addSuite(suite3);
            root.emit('post-require', {}, '/some/file.js');

            root.addSuite(suite4);

            const suite5 = {title: 'suite5'};
            subset.suites = [suite5];

            assert.deepEqual(root.suites, [
                suite1,
                suite5,
                suite4
            ]);
        });

        it('should remember new subset of suites after replacement', () => {
            const suite1 = {title: 'suite1'};
            const suite2 = {title: 'suite2'};
            const suite3 = {title: 'suite3'};
            const suite4 = {title: 'suite4'};

            const root = RootSuite.create();
            root.addSuite(suite1);

            const subset = SuiteSubset.create(root, '/some/file.js');
            root.addSuite(suite2);
            root.addSuite(suite3);
            root.emit('post-require', {}, '/some/file.js');

            root.addSuite(suite4);

            const suite5 = {title: 'suite5'};
            subset.suites = [suite5];

            assert.deepEqual(subset.suites, [
                suite5
            ]);
        });

        it('should insert suites to the end of root subsuites if there are no suites in subset', () => {
            const suite1 = {title: 'suite1'};
            const suite2 = {title: 'suite2'};

            const root = RootSuite.create();
            root.addSuite(suite1);

            const subset = SuiteSubset.create(root, '/some/file.js');
            root.emit('post-require', {}, '/some/file.js');

            subset.suites = [suite2];

            assert.deepEqual(root.suites, [
                suite1,
                suite2
            ]);
        });
    });

    describe('tests', () => {
        it('should contain only tests added after subset creation but before file read finished', () => {
            const test1 = {title: 'test1'};
            const test2 = {title: 'test2'};
            const test3 = {title: 'test3'};
            const test4 = {title: 'test4'};

            const root = RootSuite.create();
            root.addTest(test1);

            const subset = SuiteSubset.create(root, '/some/file.js');
            root.addTest(test2);
            root.addTest(test3);
            root.emit('post-require', {}, '/some/file.js');

            root.addTest(test4);

            assert.deepEqual(subset.tests, [
                test2,
                test3
            ]);
        });

        it('should not be modified by post-require from other file', () => {
            const test1 = {title: 'test1'};
            const test2 = {title: 'test2'};
            const test3 = {title: 'test3'};
            const test4 = {title: 'test4'};

            const root = RootSuite.create();
            root.addTest(test1);

            const subset = SuiteSubset.create(root, '/some/file.js');
            root.addTest(test2);
            root.addTest(test3);
            root.emit('post-require', {}, '/some/file.js');

            root.addTest(test4);
            root.emit('post-require', {}, '/other/file.js');

            assert.deepEqual(subset.tests, [
                test2,
                test3
            ]);
        });

        it('should return all tests since subset creation if reading is in progress', () => {
            const test1 = {title: 'test1'};
            const test2 = {title: 'test2'};
            const test3 = {title: 'test3'};

            const root = RootSuite.create();
            root.addTest(test1);

            const subset = SuiteSubset.create(root, '/some/file.js');
            root.addTest(test2);
            root.addTest(test3);

            assert.deepEqual(subset.tests, [
                test2,
                test3
            ]);
        });

        it('should replace only own subset of tests on set', () => {
            const test1 = {title: 'test1'};
            const test2 = {title: 'test2'};
            const test3 = {title: 'test3'};
            const test4 = {title: 'test4'};

            const root = RootSuite.create();
            root.addTest(test1);

            const subset = SuiteSubset.create(root, '/some/file.js');
            root.addTest(test2);
            root.addTest(test3);
            root.emit('post-require', {}, '/some/file.js');

            root.addTest(test4);

            const test5 = {title: 'test5'};
            subset.tests = [test5];

            assert.deepEqual(root.tests, [
                test1,
                test5,
                test4
            ]);
        });

        it('should remember new subset of suites after replacement', () => {
            const test1 = {title: 'test1'};
            const test2 = {title: 'test2'};
            const test3 = {title: 'test3'};
            const test4 = {title: 'test4'};

            const root = RootSuite.create();
            root.addTest(test1);

            const subset = SuiteSubset.create(root, '/some/file.js');
            root.addTest(test2);
            root.addTest(test3);
            root.emit('post-require', {}, '/some/file.js');

            root.addTest(test4);

            const test5 = {title: 'test5'};
            subset.tests = [test5];

            assert.deepEqual(subset.tests, [
                test5
            ]);
        });

        it('should insert tests to the end of root tests if there are no tests in subset', () => {
            const test1 = {title: 'test1'};
            const test2 = {title: 'test2'};

            const root = RootSuite.create();
            root.addTest(test1);

            const subset = SuiteSubset.create(root, '/some/file.js');
            root.emit('post-require', {}, '/some/file.js');

            subset.tests = [test2];

            assert.deepEqual(root.tests, [
                test1,
                test2
            ]);
        });
    });

    describe('fullTitle', () => {
        it('should return rot suite full title', () => {
            const root = RootSuite.create();
            sinon.stub(root, 'fullTitle').returns('bla bla');

            const subset = SuiteSubset.create(root);

            assert.equal(subset.fullTitle(), 'bla bla');
        });
    });

    [
        'pending',
        'silentSkip'
    ].forEach((property) => {
        describe(property, () => {
            it(`should set ${property} property to all subset suites and tests`, () => {
                const suite = {title: 'suite1'};
                const test = {title: 'test2'};

                const root = RootSuite.create();
                const subset = SuiteSubset.create(root);
                root.addSuite(suite);
                root.addTest(test);

                subset[property] = true;

                assert.propertyVal(suite, property, true);
                assert.propertyVal(test, property, true);
            });

            it(`should not set ${property} property to suites and tests not included to subset`, () => {
                const suite1 = {title: 'suite1'};
                const suite2 = {title: 'suite2'};
                const suite3 = {title: 'suite3'};
                const test1 = {title: 'test1'};
                const test2 = {title: 'test2'};
                const test3 = {title: 'test3'};

                const root = RootSuite.create();
                root.addSuite(suite1);
                root.addTest(test1);

                const subset = SuiteSubset.create(root, '/some/file.js');
                root.addSuite(suite2);
                root.addTest(test2);
                root.emit('post-require', {}, '/some/file.js');

                root.addSuite(suite3);
                root.addTest(test3);

                subset[property] = true;

                assert.notProperty(suite1, property);
                assert.notProperty(test1, property);
                assert.notProperty(suite3, property);
                assert.notProperty(test3, property);
            });
        });
    });

    describe('file', () => {
        it('shold store passed file', () => {
            const root = RootSuite.create();

            const subset = SuiteSubset.create(root, '/some/file.js');

            assert.propertyVal(subset, 'file', '/some/file.js');
        });
    });

    describe('eachTest', () => {
        const test1 = {title: 'test1'};
        const test2 = {title: 'test2'};
        const test3 = {title: 'test3'};

        const suite = {
            title: 'suite',
            eachTest: (cb) => [test1, test2].forEach(cb)
        };

        const root = RootSuite.create();
        const subset = SuiteSubset.create(root);
        root.addSuite(suite);
        root.addTest(test3);

        const tests = [];
        subset.eachTest((test) => tests.push(test));

        assert.deepEqual(tests, [test1, test2, test3]);
    });

    describe('stubbed methods', () => {
        it('should not throw on attempt to use beforeEach method', () => {
            assert.doesNotThrow(() => {
                SuiteSubset.create(RootSuite.create())
                    .beforeEach(() => {});
            });
        });

        it('should not throw on attempt to use afterEach method', () => {
            assert.doesNotThrow(() => {
                SuiteSubset.create(RootSuite.create())
                    .afterEach(() => {});
            });
        });

        it('should not throw on attempt to use _afterEach property', () => {
            assert.doesNotThrow(() => {
                const subset = SuiteSubset.create(RootSuite.create());
                subset._afterEach.unshift(() => {});
            });
        });
    });
});
