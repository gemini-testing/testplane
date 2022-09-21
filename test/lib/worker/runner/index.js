'use strict';

const Runner = require('build/worker/runner');
const BrowserPool = require('build/worker/runner/browser-pool');
const CachingTestParser = require('build/worker/runner/caching-test-parser');
const BrowserAgent = require('build/worker/runner/browser-agent');
const RunnerEvents = require('build/worker/constants/runner-events');
const TestRunner = require('build/worker/runner/test-runner');
const {makeConfigStub, makeTest} = require('../../../utils');

describe('worker/runner', () => {
    const sandbox = sinon.sandbox.create();

    const mkRunner_ = (opts = {}) => {
        const config = opts.config || makeConfigStub();
        return Runner.create(config);
    };

    beforeEach(() => {
        sandbox.stub(BrowserPool, 'create').returns({browser: 'pool'});

        sandbox.stub(CachingTestParser, 'create').returns(Object.create(CachingTestParser.prototype));
        sandbox.stub(CachingTestParser.prototype, 'parse').returns([]);

        sandbox.stub(TestRunner, 'create').returns(Object.create(TestRunner.prototype));
        sandbox.stub(TestRunner.prototype, 'run').resolves();

        sandbox.stub(BrowserAgent, 'create').returns(Object.create(BrowserAgent.prototype));
    });

    afterEach(() => sandbox.restore());

    describe('constructor', () => {
        it('should create browser pool', () => {
            Runner.create({foo: 'bar'});

            assert.calledOnceWith(BrowserPool.create, {foo: 'bar'});
        });

        it('should create caching test parser', () => {
            const config = makeConfigStub();

            Runner.create(config);

            assert.calledOnceWith(CachingTestParser.create, config);
        });

        [
            'BEFORE_FILE_READ',
            'AFTER_FILE_READ',
            'AFTER_TESTS_READ'
        ].forEach((event) => {
            it(`should passthrough ${event} event from caching test parser`, () => {
                const testParser = Object.create(CachingTestParser.prototype);
                CachingTestParser.create.returns(testParser);

                const onEvent = sinon.spy().named(`on${event}`);
                mkRunner_()
                    .on(RunnerEvents[event], onEvent);

                testParser.emit(RunnerEvents[event], {foo: 'bar'});

                assert.calledOnceWith(onEvent, {foo: 'bar'});
            });
        });
    });

    describe('runTest', () => {
        it('should parse passed file in passed browser', () => {
            const runner = mkRunner_();

            runner.runTest(null, {file: 'some/file.js', browserId: 'bro'});

            assert.calledOnceWith(CachingTestParser.prototype.parse, {file: 'some/file.js', browserId: 'bro'});
        });

        it('should create test runner for parsed test', () => {
            const runner = mkRunner_();

            const test = makeTest({fullTitle: () => 'some test'});
            CachingTestParser.prototype.parse.returns([test]);

            runner.runTest('some test', {});

            assert.calledOnceWith(TestRunner.create, test);
        });

        it('should pass browser config to test runner', () => {
            const config = makeConfigStub({browsers: ['bro']});
            const runner = mkRunner_({config});

            const test = makeTest({fullTitle: () => 'some test'});
            CachingTestParser.prototype.parse.returns([test]);

            runner.runTest('some test', {browserId: 'bro'});

            assert.calledOnceWith(TestRunner.create, test, config.forBrowser('bro'));
        });

        it('should create browser agent for test runner', () => {
            const runner = mkRunner_();

            const test = makeTest({fullTitle: () => 'some test'});
            CachingTestParser.prototype.parse.returns([test]);

            const browserAgent = Object.create(BrowserAgent.prototype);
            BrowserAgent.create.withArgs('bro').returns(browserAgent);

            runner.runTest('some test', {browserId: 'bro'});

            assert.calledOnceWith(TestRunner.create, test, sinon.match.any, browserAgent);
        });

        it('should create test runner only for passed test', () => {
            const runner = mkRunner_();

            const test1 = makeTest({fullTitle: () => 'some test'});
            const test2 = makeTest({fullTitle: () => 'other test'});
            CachingTestParser.prototype.parse.returns([test1, test2]);

            runner.runTest('other test', {});

            assert.calledOnceWith(TestRunner.create, test2);
        });

        it('should run test in passed session', () => {
            const runner = mkRunner_();

            const test = makeTest({fullTitle: () => 'some test'});
            CachingTestParser.prototype.parse.returns([test]);

            runner.runTest('some test', {sessionId: '100500', sessionCaps: 'some-caps', sessionOpts: 'some-opts'});

            assert.calledOnceWith(
                TestRunner.prototype.run,
                {sessionId: '100500', sessionCaps: 'some-caps', sessionOpts: 'some-opts'}
            );
        });
    });
});
