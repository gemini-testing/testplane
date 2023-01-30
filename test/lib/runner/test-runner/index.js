'use strict';

const TestRunner = require('lib/runner/test-runner');
const SkippedTestRunner = require('lib/runner/test-runner/skipped-test-runner');
const InsistantTestRunner = require('lib/runner/test-runner/insistant-test-runner');
const BrowserAgent = require('lib/runner/browser-agent');
const {Test} = require('lib/test-reader/test-object');

const {makeConfigStub} = require('../../../utils');

describe('runner/test-runner', () => {
    const sandbox = sinon.sandbox.create();

    afterEach(() => sandbox.restore());

    it('should create skipped test runner for skipped test', () => {
        sandbox.spy(SkippedTestRunner, 'create');
        const test = new Test({});
        test.pending = true;

        const runner = TestRunner.create(test);

        assert.calledOnceWith(SkippedTestRunner.create, test);
        assert.instanceOf(runner, SkippedTestRunner);
    });

    it('should create skipped test runner for disabled test', () => {
        sandbox.spy(SkippedTestRunner, 'create');
        const test = new Test({});
        test.disabled = true;

        const runner = TestRunner.create(test);

        assert.calledOnceWith(SkippedTestRunner.create, test);
        assert.instanceOf(runner, SkippedTestRunner);
    });

    it('should create insistant test runner for regular test', () => {
        sandbox.spy(InsistantTestRunner, 'create');

        const test = new Test({});
        const config = makeConfigStub();
        const browserAgent = BrowserAgent.create();

        TestRunner.create(test, config, browserAgent);

        assert.calledOnceWith(InsistantTestRunner.create, test, config, browserAgent);
    });
});
