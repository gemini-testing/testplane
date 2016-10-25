'use strict';

const TestCounter = require('../../../../lib/reporters/utils/test-counter');

describe('TestCounter', () => {
    const stubTest = (opts) => {
        opts = opts || {};

        return {fullTitle: sinon.stub().returns(opts.name || 'default-name'), browserId: 'bro'};
    };

    it('should count passed tests', () => {
        const testCounter = new TestCounter();

        testCounter.onTestPass(stubTest());

        assert.propertyVal(testCounter.getResult(), 'passed', 1);
    });

    it('should count failed tests', () => {
        const testCounter = new TestCounter();

        testCounter.onTestFail(stubTest());

        assert.propertyVal(testCounter.getResult(), 'failed', 1);
    });

    it('should count pending tests', () => {
        const testCounter = new TestCounter();

        testCounter.onTestPending(stubTest());

        assert.propertyVal(testCounter.getResult(), 'pending', 1);
    });

    it('should count retried tests', () => {
        const testCounter = new TestCounter();

        testCounter.onTestRetry();

        assert.propertyVal(testCounter.getResult(), 'retries', 1);
    });

    it('should count total tests', () => {
        const testCounter = new TestCounter();

        testCounter.onTestPass(stubTest({name: 'first-test'}));
        testCounter.onTestFail(stubTest({name: 'second-test'}));
        testCounter.onTestPending(stubTest({name: 'third-test'}));

        assert.propertyVal(testCounter.getResult(), 'total', 3);
    });

    it('should not add retries to total', () => {
        const testCounter = new TestCounter();

        testCounter.onTestRetry();
        testCounter.onTestPass(stubTest());

        assert.propertyVal(testCounter.getResult(), 'total', 1);
    });

    it('should support cases when several hanlders were called for the same test', () => {
        const testCounter = new TestCounter();

        testCounter.onTestPending(stubTest({name: 'some-test'}));
        testCounter.onTestFail(stubTest({name: 'some-test'}));

        const result = testCounter.getResult();

        assert.propertyVal(result, 'total', 1);
        assert.propertyVal(result, 'failed', 1);
        assert.propertyVal(result, 'pending', 0);
    });
});
