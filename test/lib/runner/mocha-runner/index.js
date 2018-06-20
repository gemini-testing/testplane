'use strict';

const Promise = require('bluebird');
const EventEmitter = require('events').EventEmitter;
const BrowserAgent = require('gemini-core').BrowserAgent;
const Events = require('lib/constants/runner-events');
const BrowserPool = require('lib/browser-pool');
const MochaRunner = require('lib/runner/mocha-runner');
const TestSkipper = require('lib/runner/test-skipper');
const MochaBuilder = require('lib/runner/mocha-runner/mocha-builder');
const MochaAdapter = require('lib/runner/mocha-runner/mocha-adapter');
const SuiteMonitor = require('lib/suite-monitor');
const Workers = require('lib/runner/workers');
const TestRunnerFabric = require('lib/runner/test-runner');
const TestRunner = require('lib/runner/test-runner/test-runner');
const {makeConfigStub, makeTest} = require('../../../utils');

describe('mocha-runner', () => {
    const sandbox = sinon.sandbox.create();

    const createMochaRunner_ = () => {
        return new MochaRunner(
            'bro',
            makeConfigStub({browsers: ['bro']}),
            sinon.createStubInstance(BrowserAgent),
            sinon.createStubInstance(TestSkipper)
        );
    };

    const init_ = (suites) => createMochaRunner_().init(suites || ['test_suite']);

    const run_ = (opts = {}) => {
        const runner = opts.runner || createMochaRunner_();
        const files = opts.files || ['default/file'];
        const workers = opts.workers || sinon.createStubInstance(Workers);

        return runner.init(files).run(workers);
    };

    beforeEach(() => {
        sandbox.stub(MochaBuilder, 'prepare');
        sandbox.stub(MochaBuilder.prototype, 'buildSingleAdapter')
            .returns(Object.create(MochaAdapter.prototype));

        sandbox.stub(MochaAdapter.prototype, 'parse').resolves([]);

        sandbox.stub(SuiteMonitor.prototype, 'testBegin');
        sandbox.stub(SuiteMonitor.prototype, 'testEnd');
        sandbox.stub(SuiteMonitor.prototype, 'testRetry');

        sandbox.stub(TestRunnerFabric, 'create').returns(Object.create(TestRunner.prototype));
        sandbox.stub(TestRunner.prototype, 'run').resolves();

        sandbox.stub(BrowserAgent, 'create').returns(Object.create(BrowserAgent.prototype));
    });

    afterEach(() => sandbox.restore());

    describe('constructor', () => {
        describe('mocha builder', () => {
            it('should create instance', () => {
                sandbox.spy(MochaBuilder, 'create');

                MochaRunner.create('bro', makeConfigStub({system: {foo: 'bar'}}), null, {test: 'skipper'});

                assert.calledOnceWith(MochaBuilder.create, 'bro', {foo: 'bar'}, {test: 'skipper'});
            });

            [
                'BEFORE_FILE_READ',
                'AFTER_FILE_READ'
            ].forEach((event) => {
                it(`should passthrough ${event} extending its data with browser id`, () => {
                    const mochaBuilder = new EventEmitter();
                    sandbox.stub(MochaBuilder, 'create').returns(mochaBuilder);

                    const onEvent = sinon.spy().named(`on${event}`);
                    MochaRunner.create('bro', makeConfigStub()).on(Events[event], onEvent);

                    mochaBuilder.emit(Events[event], {foo: 'bar'});

                    assert.calledOnceWith(onEvent, {foo: 'bar', browserId: 'bro'});
                });
            });
        });

        describe('suite monitor', () => {
            it('should create an instance', () => {
                sandbox.spy(SuiteMonitor, 'create');

                createMochaRunner_();

                assert.calledOnce(SuiteMonitor.create);
            });

            [
                'SUITE_BEGIN',
                'SUITE_END'
            ].forEach((event) => {
                it(`should passthrough ${event} event extending its data with browser id`, () => {
                    const suiteMonitor = new EventEmitter();
                    sandbox.stub(SuiteMonitor, 'create').returns(suiteMonitor);

                    const onEvent = sinon.spy().named(`on${event}`);
                    MochaRunner.create('bro', makeConfigStub()).on(Events[event], onEvent);

                    suiteMonitor.emit(Events[event], {foo: 'bar'});

                    assert.calledOnceWith(onEvent, {foo: 'bar', browserId: 'bro'});
                });
            });
        });
    });

    describe('prepare', () => {
        it('should prepare mocha builder', () => {
            MochaRunner.prepare();

            assert.calledOnce(MochaBuilder.prepare);
        });
    });

    describe('init', () => {
        it('should create mocha adapter for specified paths', () => {
            const mochaRunner = createMochaRunner_();
            mochaRunner.init(['some/path']);

            assert.calledOnceWith(MochaBuilder.prototype.buildSingleAdapter, ['some/path']);
        });

        it('should return an instance of mocha runner', () => {
            const mochaRunner = createMochaRunner_();

            assert.deepEqual(mochaRunner.init(), mochaRunner);
        });

        [
            Events.BEFORE_FILE_READ,
            Events.AFTER_FILE_READ
        ].forEach((event) => {
            it(`should passthrough mocha adapter ${event} event extending its data with browser id`, () => {
                MochaBuilder.prototype.buildSingleAdapter.callsFake(function() {
                    this.emit(event, {foo: 'bar'});
                });

                const mochaRunner = MochaRunner.create('bro', makeConfigStub());
                const spy = sinon.spy();

                mochaRunner.on(event, spy);
                mochaRunner.init(['path/to/file']);

                assert.calledOnceWith(spy, {foo: 'bar', browserId: 'bro'});
            });
        });
    });

    describe('buildSuiteTree', () => {
        it('should init mocha runner with passed files', () => {
            sandbox.spy(MochaRunner.prototype, 'init');

            const mochaRunner = createMochaRunner_();
            mochaRunner.buildSuiteTree(['foo/bar']);

            assert.calledOnceWith(MochaRunner.prototype.init, ['foo/bar']);
        });

        it('should return root suite of mocha-adapter', () => {
            const mochaRunner = createMochaRunner_();

            MochaBuilder.prototype.buildSingleAdapter.returns({suite: {foo: 'bar'}});

            assert.deepEqual(mochaRunner.buildSuiteTree(), {foo: 'bar'});
        });
    });

    describe('run', () => {
        it('should parse all tests via mocha', async () => {
            await run_();

            assert.calledOnce(MochaAdapter.prototype.parse);
        });

        it('should create browser agent for each test', async () => {
            const test1 = makeTest({title: 'foo'});
            const test2 = makeTest({title: 'bar'});

            MochaAdapter.prototype.parse.resolves([test1, test2]);

            const config = makeConfigStub();
            const pool = BrowserPool.create(config);
            const runner = MochaRunner.create('bro', config, pool);

            await run_({runner});

            assert.calledTwice(BrowserAgent.create);
            assert.calledWith(BrowserAgent.create, 'bro', pool);
            assert.calledWith(BrowserAgent.create, 'bro', pool);
        });

        it('should create test runner for each test returned by mocha', async () => {
            const test1 = makeTest({title: 'foo'});
            const test2 = makeTest({title: 'bar'});

            MochaAdapter.prototype.parse.resolves([test1, test2]);

            await run_();

            assert.calledTwice(TestRunnerFabric.create);
            assert.calledWith(TestRunnerFabric.create, test1);
            assert.calledWith(TestRunnerFabric.create, test2);
        });

        it('should pass config and browser agent to test runner', async () => {
            MochaAdapter.prototype.parse.resolves([makeTest()]);

            const config = makeConfigStub();
            const browserAgent = BrowserAgent.create();
            BrowserAgent.create.returns(browserAgent);

            const runner = MochaRunner.create(null, config);

            await run_({runner});

            assert.calledOnceWith(TestRunnerFabric.create, sinon.match.any, config, browserAgent);
        });

        it('should pass workers to test runner', async () => {
            MochaAdapter.prototype.parse.resolves([makeTest()]);

            const workers = Object.create(Workers.prototype);

            await init_().run(workers);

            assert.calledOnceWith(TestRunner.prototype.run, workers);
        });

        it('should wait for all test runners', async () => {
            MochaAdapter.prototype.parse.resolves([
                makeTest({title: 'foo'}),
                makeTest({title: 'bar'})
            ]);

            const afterFirstTest = sinon.stub().named('afterFirstTest');
            const afterSecondTest = sinon.stub().named('afterSecondTest');
            const afterRun = sinon.stub().named('afterRun');

            TestRunner.prototype.run.onFirstCall().callsFake(() => Promise.delay(1).then(afterFirstTest));
            TestRunner.prototype.run.onSecondCall().callsFake(() => Promise.delay(10).then(afterSecondTest));

            await run_();
            afterRun();

            assert.callOrder(
                afterFirstTest,
                afterSecondTest,
                afterRun
            );
        });

        it('should be rejected if one of test runners fails', async () => {
            MochaAdapter.prototype.parse.resolves([
                makeTest({title: 'foo'}),
                makeTest({title: 'bar'})
            ]);

            TestRunner.prototype.run.onFirstCall().resolves();
            TestRunner.prototype.run.onSecondCall().rejects(new Error('foo'));

            await assert.isRejected(run_(), /foo/);
        });

        [
            'TEST_BEGIN',
            'TEST_END',
            'TEST_PASS',
            'TEST_FAIL',
            'TEST_PENDING',
            'RETRY'
        ].forEach((event) => {
            it(`should passthrough ${event} from test runner extending its data with browser id`, async () => {
                MochaAdapter.prototype.parse.resolves([makeTest()]);

                TestRunner.prototype.run.callsFake(function() {
                    this.emit(Events[event], {foo: 'bar'});
                    return Promise.resolve();
                });

                const onEvent = sinon.stub().named(`on${event}`);
                const runner = MochaRunner.create('bro', makeConfigStub())
                    .on(Events[event], onEvent);

                await run_({runner});

                assert.calledOnceWith(onEvent, {foo: 'bar', browserId: 'bro'});
            });
        });

        it('should passthrough SUITE_BEGIN from suite monitor before TEST_BEGIN from test runner', async () => {
            MochaAdapter.prototype.parse.resolves([makeTest()]);

            const onTestBegin = sinon.stub().named('onTestBegin');
            const onSuiteBegin = sinon.stub().named('onSuiteBegin');

            SuiteMonitor.prototype.testBegin.callsFake(function() {
                this.emit(Events.SUITE_BEGIN);
            });
            TestRunner.prototype.run.callsFake(function() {
                this.emit(Events.TEST_BEGIN);
                return Promise.resolve();
            });

            const runner = MochaRunner.create(null, makeConfigStub())
                .on(Events.TEST_BEGIN, onTestBegin)
                .on(Events.SUITE_BEGIN, onSuiteBegin);

            await run_({runner});

            assert.callOrder(onSuiteBegin, onTestBegin);
        });

        it('should passthrough SUITE_END from suite monitor after TEST_END from test runner', async () => {
            MochaAdapter.prototype.parse.resolves([makeTest()]);

            const onTestEnd = sinon.stub().named('onTestEnd');
            const onSuiteEnd = sinon.stub().named('onSuiteEnd');

            SuiteMonitor.prototype.testEnd.callsFake(function() {
                this.emit(Events.SUITE_END);
            });
            TestRunner.prototype.run.callsFake(function() {
                this.emit(Events.TEST_END);
                return Promise.resolve();
            });

            const runner = MochaRunner.create(null, makeConfigStub())
                .on(Events.TEST_END, onTestEnd)
                .on(Events.SUITE_END, onSuiteEnd);

            await run_({runner});

            assert.callOrder(onTestEnd, onSuiteEnd);
        });

        it('should subscribe suite monitor to RETRY event', async () => {
            MochaAdapter.prototype.parse.resolves([makeTest()]);

            TestRunner.prototype.run.callsFake(function() {
                this.emit(Events.RETRY, {foo: 'bar'});
            });

            await run_();

            assert.calledOnceWith(SuiteMonitor.prototype.testRetry, sinon.match({foo: 'bar'}));
        });
    });
});
