'use strict';

const BrowserAgent = require('../../../../lib/browser-agent');
const logger = require('../../../../lib/utils').logger;
const ProxyReporter = require('../../../../lib/runner/mocha-runner/proxy-reporter');
const SkipBuilder = require('../../../../lib/runner/mocha-runner/skip/skip-builder');
const Skip = require('../../../../lib/runner/mocha-runner/skip/');
const proxyquire = require('proxyquire').noCallThru();
const inherit = require('inherit');
const _ = require('lodash');
const EventEmitter = require('events').EventEmitter;
const q = require('q');

const MochaStub = inherit({
    __constructor: _.noop,
    run: _.noop,
    fullTrace: _.noop,
    addFile: _.noop,
    loadFiles: _.noop,
    reporter: _.noop
});

describe('mocha-runner/mocha-adapter', () => {
    const sandbox = sinon.sandbox.create();

    let MochaAdapter;
    let browserAgent;
    let clearRequire;

    function mkSuiteStub_() {
        return _.extend(new EventEmitter(), {
            enableTimeouts: sandbox.stub(),
            beforeAll: sandbox.stub(),
            afterAll: sandbox.stub(),
            tests: [],
            ctx: {}
        });
    }

    function mkTestStub_(opts) {
        return _.defaults(opts || {}, {
            title: 'default-title',
            parent: MochaStub.prototype.suite
        });
    }

    const mkMochaAdapter_ = () => MochaAdapter.create({}, browserAgent);

    beforeEach(() => {
        clearRequire = sandbox.stub().named('clear-require');
        browserAgent = sinon.createStubInstance(BrowserAgent);

        sandbox.stub(MochaStub.prototype);
        MochaStub.prototype.run.yields();
        MochaStub.prototype.suite = mkSuiteStub_();

        MochaAdapter = proxyquire('../../../../lib/runner/mocha-runner/mocha-adapter', {
            'clear-require': clearRequire,
            'mocha': MochaStub
        });

        sandbox.stub(logger);
    });

    afterEach(() => sandbox.restore());

    describe('constructor', () => {
        it('should pass shared opts to mocha instance', () => {
            MochaAdapter.create({grep: 'foo'});

            assert.calledWith(MochaStub.prototype.__constructor, {grep: 'foo'});
        });

        it('should enable full stacktrace in mocha', () => {
            MochaAdapter.create();

            assert.called(MochaStub.prototype.fullTrace);
        });
    });

    describe('addFile', () => {
        it('should add file', () => {
            const mochaAdapter = MochaAdapter.create();

            mochaAdapter.addFile('path/to/file');

            assert.calledOnce(MochaStub.prototype.addFile);
            assert.calledWith(MochaStub.prototype.addFile, 'path/to/file');
        });

        it('should clear require cache for file before adding', () => {
            const mochaAdapter = MochaAdapter.create();

            mochaAdapter.addFile('path/to/file');

            assert.calledWithMatch(clearRequire, 'path/to/file');
            assert.callOrder(clearRequire, MochaStub.prototype.addFile);
        });

        it('should load files after add', () => {
            const mochaAdapter = MochaAdapter.create();

            mochaAdapter.addFile('path/to/file');

            assert.calledOnce(MochaStub.prototype.loadFiles);
            assert.callOrder(MochaStub.prototype.addFile, MochaStub.prototype.loadFiles);
        });

        it('should flush files after load', () => {
            const mocha = new MochaStub();
            mocha.files = ['some/file'];
            MochaStub.prototype.__constructor.returns(mocha);

            const mochaAdapter = MochaAdapter.create();

            mochaAdapter.addFile('path/to/file');

            assert.deepEqual(mocha.files, []);
        });

        it('should add global "hermione" object on "pre-require" event', () => {
            const mochaAdapter = mkMochaAdapter_();

            mochaAdapter.addFile('path/to/file');
            MochaStub.prototype.suite.emit('pre-require');

            assert.isDefined(global.hermione);
        });

        it('hermione.skip should return SkipBuilder instance', () => {
            const mochaAdapter = mkMochaAdapter_();

            mochaAdapter.addFile('path/to/file');
            MochaStub.prototype.suite.emit('pre-require');

            assert.instanceOf(global.hermione.skip, SkipBuilder);
        });

        it('should remove global "hermione" object on "post-require" event', () => {
            const mochaAdapter = mkMochaAdapter_();

            mochaAdapter.addFile('path/to/file');
            MochaStub.prototype.suite.emit('post-require');

            assert.isUndefined(global.hermione);
        });
    });

    describe('inject browser', () => {
        it('should request browser before suite execution', () => {
            MochaStub.prototype.suite.beforeAll.yields();
            browserAgent.getBrowser.returns(q());

            mkMochaAdapter_();

            assert.calledOnce(browserAgent.getBrowser);
        });

        it('should release browser after suite execution', () => {
            const browser = {};
            browserAgent.getBrowser.returns(q(browser));
            browserAgent.freeBrowser.returns(q());

            mkMochaAdapter_();

            const beforeAll = MochaStub.prototype.suite.beforeAll.firstCall.args[0];
            const afterAll = MochaStub.prototype.suite.afterAll.firstCall.args[0];

            return beforeAll()
                .then(afterAll)
                .then(() => {
                    assert.calledOnce(browserAgent.freeBrowser);
                    assert.calledWith(browserAgent.freeBrowser, browser);
                });
        });

        it('should disable mocha timeouts while setting browser hooks', () => {
            MochaStub.prototype.suite.enableTimeouts.onFirstCall().returns(true);

            mkMochaAdapter_();

            assert.callOrder(
                MochaStub.prototype.suite.enableTimeouts, // get current value of enableTimeouts
                MochaStub.prototype.suite.enableTimeouts.withArgs(false).named('disableTimeouts'),
                MochaStub.prototype.suite.beforeAll,
                MochaStub.prototype.suite.afterAll,
                MochaStub.prototype.suite.enableTimeouts.withArgs(true).named('restoreTimeouts')
            );
        });

        it('should not be rejected if freeBrowser failed', () => {
            const browser = {};

            browserAgent.getBrowser.returns(q(browser));
            browserAgent.freeBrowser.returns(q.reject('some-error'));

            mkMochaAdapter_();

            const beforeAll = MochaStub.prototype.suite.beforeAll.firstCall.args[0];
            const afterAll = MochaStub.prototype.suite.afterAll.firstCall.args[0];

            return beforeAll()
                .then(afterAll)
                .then(() => {
                    assert.calledOnce(logger.warn);
                    assert.calledWithMatch(logger.warn, /some-error/);
                });
        });
    });

    describe('inject skip', () => {
        beforeEach(() => sandbox.stub(Skip.prototype, 'handleEntity'));

        it('should apply skip to test', () => {
            const test = mkTestStub_();
            MochaStub.prototype.suite.tests = [test];

            mkMochaAdapter_();
            MochaStub.prototype.suite.emit('test', test);

            assert.called(Skip.prototype.handleEntity);
            assert.calledWith(Skip.prototype.handleEntity, test);
        });

        it('should apply skip to suite', () => {
            const suite = MochaStub.prototype.suite;

            mkMochaAdapter_();
            suite.emit('suite', suite);

            assert.called(Skip.prototype.handleEntity);
            assert.calledWith(Skip.prototype.handleEntity, suite);
        });
    });

    describe('attachTestFilter', () => {
        let mochaAdapter;

        beforeEach(() => mochaAdapter = mkMochaAdapter_());

        it('should check if test should be run', () => {
            const someTest = mkTestStub_();
            const shouldRun = sandbox.stub().returns(true);

            MochaStub.prototype.suite.tests = [someTest];
            BrowserAgent.prototype.browserId = 'some-browser';

            mochaAdapter.attachTestFilter(shouldRun);

            MochaStub.prototype.suite.emit('test', someTest);
            assert.calledWith(shouldRun, someTest, 'some-browser');
        });

        it('should not remove test which expected to be run', () => {
            const test1 = mkTestStub_();
            const test2 = mkTestStub_();
            const shouldRun = () => true;

            MochaStub.prototype.suite.tests = [test1, test2];

            mochaAdapter.attachTestFilter(shouldRun);

            MochaStub.prototype.suite.emit('test', test2);
            assert.deepEqual(MochaStub.prototype.suite.tests, [test1, test2]);
        });

        it('should remove test which does not suppose to be run', () => {
            const test1 = mkTestStub_();
            const test2 = mkTestStub_();
            const shouldRun = () => false;

            MochaStub.prototype.suite.tests = [test1, test2];

            mochaAdapter.attachTestFilter(shouldRun);

            MochaStub.prototype.suite.emit('test', test2);
            assert.deepEqual(MochaStub.prototype.suite.tests, [test1]);
        });
    });

    describe('attachEmitFn', () => {
        let mochaAdapter;

        beforeEach(() => {
            sandbox.stub(ProxyReporter.prototype, '__constructor');
            mochaAdapter = mkMochaAdapter_();
        });

        function attachEmitFn_(emitFn) {
            mochaAdapter.attachEmitFn(emitFn);

            const Reporter = MochaStub.prototype.reporter.lastCall.args[0];
            new Reporter(); // jshint ignore:line
        }

        it('should set mocha reporter as proxy reporter in order to proxy events to emit fn', () => {
            attachEmitFn_(sinon.spy());

            assert.calledOnce(ProxyReporter.prototype.__constructor);
        });

        it('should pass to proxy reporter emit fn', () => {
            const emitFn = sinon.spy().named('emit');

            attachEmitFn_(emitFn);

            assert.calledOnce(ProxyReporter.prototype.__constructor);
            assert.calledWith(ProxyReporter.prototype.__constructor, emitFn);
        });

        it('should pass to proxy reporter getter for requested browser', () => {
            const browser = {};

            attachEmitFn_(sinon.spy());

            browserAgent.getBrowser.returns(q(browser));
            const beforeAll = MochaStub.prototype.suite.beforeAll.firstCall.args[0];

            return beforeAll()
                .then(() => {
                    const getBrowser = ProxyReporter.prototype.__constructor.lastCall.args[1];
                    assert.equal(browser, getBrowser());
                });
        });

        it('should pass to proxy reporter getter for browser id if browser not requested', () => {
            browserAgent.browserId = 'some-browser';

            attachEmitFn_(sinon.spy());

            const getBrowser = ProxyReporter.prototype.__constructor.lastCall.args[1];
            assert.deepEqual(getBrowser(), {id: 'some-browser'});
        });
    });
});
