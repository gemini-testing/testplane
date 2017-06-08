'use strict';

const q = require('q');
const MochaAdapter = require('../../../../lib/runner/mocha-runner/mocha-adapter');
const SingleTestMochaAdapter = require('../../../../lib/runner/mocha-runner/single-test-mocha-adapter');

describe('mocha-runner/single-test-mocha-adapter', () => {
    const sandbox = sinon.sandbox.create();

    const mkMochaAdapterStub = (tests, suite) => {
        const mocha = sinon.createStubInstance(MochaAdapter);

        mocha.tests = tests || [];
        mocha.suite = suite || {tests: []};
        mocha.attachTestFilter.callsFake(function() {
            return this;
        });

        return mocha;
    };

    const stubTestFile = (mocha, filename, tests) => {
        let filterFn;
        mocha.attachTestFilter.callsFake(function(fn) {
            filterFn = fn;
            return this;
        });

        mocha.loadFiles.withArgs(filename).callsFake(function() {
            tests.forEach((test) => filterFn() && this.tests.push(test));
        });

        mocha.reinit.callsFake(function() {
            this.tests = [];
            this.suite = {tests: []};
        });
    };

    afterEach(() => sandbox.restore());

    describe('constructor', () => {
        it('should load the specified test from a file', () => {
            const mochaAdapter = mkMochaAdapterStub();

            stubTestFile(mochaAdapter, 'some/file', ['test0', 'test1']);

            const singleTestMochaAdapter = SingleTestMochaAdapter.create(mochaAdapter, 'some/file', 1);

            assert.deepEqual(singleTestMochaAdapter.tests, ['test1']);
        });

        it('should not load the specified test if its index is out of the bounds', () => {
            const mochaAdapter = mkMochaAdapterStub();

            stubTestFile(mochaAdapter, 'some/file', ['test0']);

            const singleTestMochaAdapter = SingleTestMochaAdapter.create(mochaAdapter, 'some-file', 1);

            assert.deepEqual(singleTestMochaAdapter.tests, []);
        });
    });

    describe('reinit', () => {
        it('should reinit single mocha adapter', () => {
            const mochaAdapter = mkMochaAdapterStub();

            stubTestFile(mochaAdapter, 'some/file', ['test']);

            const singleTestMochaAdapter = SingleTestMochaAdapter.create(mochaAdapter, 'some/file', 0);
            singleTestMochaAdapter.reinit();

            assert.deepEqual(singleTestMochaAdapter.tests, ['test']);
        });

        it('should reinit mocha adapter before reloading of a test', () => {
            const mochaAdapter = mkMochaAdapterStub();

            stubTestFile(mochaAdapter, 'some/file', ['test']);

            const singleTestMochaAdapter = SingleTestMochaAdapter.create(mochaAdapter, 'some-file', 0);
            singleTestMochaAdapter.reinit();

            assert.callOrder(mochaAdapter.reinit, mochaAdapter.attachTestFilter, mochaAdapter.loadFiles);
        });
    });

    it('should passthrough "tests" property from the decorated mocha adapter', () => {
        const mochaAdapter = mkMochaAdapterStub(['test1', 'test2']);
        const singleTestMochaAdapter = SingleTestMochaAdapter.create(mochaAdapter);

        assert.deepEqual(singleTestMochaAdapter.tests, ['test1', 'test2']);
    });

    it('should passthrough "suite" property from the decorated mocha adapter', () => {
        const mochaAdapter = mkMochaAdapterStub(null, {some: 'suite'});
        const singleTestMochaAdapter = SingleTestMochaAdapter.create(mochaAdapter);

        assert.deepEqual(singleTestMochaAdapter.suite, {some: 'suite'});
    });

    it('should passthrough "run" method from the decorated mocha adapter', () => {
        const mochaAdapter = mkMochaAdapterStub();
        const singleTestMochaAdapter = SingleTestMochaAdapter.create(mochaAdapter);

        mochaAdapter.run.returns(q({foo: 'bar'}));

        return assert.becomes(singleTestMochaAdapter.run(), {foo: 'bar'});
    });

    it('should passthrough "on" method from the decorated mocha adapter', () => {
        const mochaAdapter = mkMochaAdapterStub();
        const singleTestMochaAdapter = SingleTestMochaAdapter.create(mochaAdapter);

        mochaAdapter.on.withArgs('arg1', 'arg2').returns({foo: 'bar'});

        assert.deepEqual(singleTestMochaAdapter.on('arg1', 'arg2'), {foo: 'bar'});
    });
});
