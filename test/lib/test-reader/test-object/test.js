'use strict';

const {Test} = require('lib/test-reader/test-object');
const {ConfigurableTestObject} = require('lib/test-reader/test-object/configurable-test-object');

describe('test-reader/test-object/test', () => {
    const sandbox = sinon.sandbox.create();

    afterEach(() => {
        sandbox.restore();
    });

    it('should be an instance of configurable test object', () => {
        const test = new Test({});

        assert.instanceOf(test, ConfigurableTestObject);
    });

    describe('create', () => {
        it('should create Test object', () => {
            const test = Test.create({});

            assert.instanceOf(test, Test);
        });
    });

    describe('constructor', () => {
        before(() => {
            const stub = sandbox.stub();
            Object.setPrototypeOf(stub, Object.getPrototypeOf(Test));
            Object.setPrototypeOf(Test, stub);
        });

        after(() => {
            Object.setPrototypeOf(Test, Object.getPrototypeOf(Object.getPrototypeOf(Test)));
        });

        afterEach(() => {
            sandbox.reset();
        });

        it('should pass base properties to base class constructor', () => {
            const title = 'foo bar';
            const file = 'baz/qux.js';
            const id = 'bazqux';

            new Test({title, file, id});

            assert.calledWithMatch(Object.getPrototypeOf(Test), {title, file, id});
        });
    });

    describe('clone', () => {
        it('should return an instance of Test', () => {
            const clonedTest = new Test({}).clone();

            assert.instanceOf(clonedTest, Test);
        });

        it('should create object with same own properties', () => {
            const fn = sinon.spy();

            const clonedTest = new Test({title: 'foo bar', file: 'foo/bar', id: 'foobar', fn});

            assert.equal(clonedTest.fn, fn);
            assert.equal(clonedTest.title, 'foo bar');
            assert.equal(clonedTest.file, 'foo/bar');
            assert.equal(clonedTest.id, 'foobar');
        });

        it('should assign itself to cloned object', () => {
            sandbox.spy(Test.prototype, 'assign');
            const test = new Test({});

            const clonedTest = test.clone();

            assert.calledOnceWith(Test.prototype.assign, test);
            assert.calledOn(Test.prototype.assign, clonedTest);
        });
    });

    describe('type', () => {
        it('should be "test"', () => {
            const test = new Test({});

            assert.equal(test.type, 'test');
        });
    });
});
