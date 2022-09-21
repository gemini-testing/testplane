'use strict';

const TestRunner = require('build/runner/test-runner');
const SkippedTestRunner = require('build/runner/test-runner/skipped-test-runner');
const InsistantTestRunner = require('build/runner/test-runner/insistant-test-runner');
const BrowserAgent = require('build/core/browser-agent');

const {makeConfigStub, makeTest} = require('../../../utils');

describe('runner/test-runner', () => {
    const sandbox = sinon.sandbox.create();

    afterEach(() => sandbox.restore());

    it('should create skipped test runner for skipped test', () => {
        sandbox.spy(SkippedTestRunner, 'create');
        const test = makeTest();
        test.pending = true;

        const runner = TestRunner.create(test);

        assert.calledOnceWith(SkippedTestRunner.create, test);
        assert.instanceOf(runner, SkippedTestRunner);
    });

    it('should create skipped test runner for disabled test', () => {
        sandbox.spy(SkippedTestRunner, 'create');
        const test = makeTest();
        test.disabled = true;

        const runner = TestRunner.create(test);

        assert.calledOnceWith(SkippedTestRunner.create, test);
        assert.instanceOf(runner, SkippedTestRunner);
    });

    it('should create insistant test runner for regular test', () => {
        sandbox.spy(InsistantTestRunner, 'create');

        const test = makeTest();
        const config = makeConfigStub();
        const browserAgent = BrowserAgent.create();

        TestRunner.create(test, config, browserAgent);

        assert.calledOnceWith(InsistantTestRunner.create, test, config, browserAgent);
    });
});
