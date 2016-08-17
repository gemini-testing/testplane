'use strict';

var BrowserAgent = require('../../../../lib/browser-agent'),
    logger = require('../../../../lib/utils').logger,
    ProxyReporter = require('../../../../lib/runner/mocha-runner/proxy-reporter'),
    SkipBuilder = require('../../../../lib/runner/mocha-runner/skip/skip-builder'),
    Skip = require('../../../../lib/runner/mocha-runner/skip/'),
    proxyquire = require('proxyquire').noCallThru(),
    inherit = require('inherit'),
    _ = require('lodash'),
    EventEmitter = require('events').EventEmitter,
    q = require('q');

var MochaStub = inherit({
    __constructor: _.noop,
    run: _.noop,
    fullTrace: _.noop,
    addFile: _.noop,
    loadFiles: _.noop,
    reporter: _.noop
});

describe('mocha-runner/mocha-adapter', function() {
    var sandbox = sinon.sandbox.create(),
        MochaAdapter,
        browserAgent,
        clearRequire;

    function mkSuiteStub_() {
        var suite = new EventEmitter();

        suite.enableTimeouts = sandbox.stub();
        suite.beforeAll = sandbox.stub();
        suite.afterAll = sandbox.stub();
        suite.tests = [];
        suite.ctx = {};

        return suite;
    }

    function mkTestStub_(opts) {
        return _.defaults(opts || {}, {
            title: 'default-title',
            parent: MochaStub.prototype.suite
        });
    }

    const mkMochaAdapter_ = () => new MochaAdapter({}, browserAgent);

    beforeEach(function() {
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

    afterEach(function() {
        sandbox.restore();
    });

    describe('constructor', function() {
        function instantiateMocha_(config) {
            new MochaAdapter(config); // jshint ignore:line
        }

        it('should pass shared opts to mocha instance', function() {
            instantiateMocha_({grep: 'foo'});

            assert.calledWith(MochaStub.prototype.__constructor, {grep: 'foo'});
        });

        it('should enable full stacktrace in mocha', function() {
            instantiateMocha_();

            assert.called(MochaStub.prototype.fullTrace);
        });
    });

    describe('addFile', function() {
        it('should add file', function() {
            var mochaAdapter = new MochaAdapter();

            mochaAdapter.addFile('path/to/file');

            assert.calledOnce(MochaStub.prototype.addFile);
            assert.calledWith(MochaStub.prototype.addFile, 'path/to/file');
        });

        it('should clear require cache for file before adding', function() {
            var mochaAdapter = new MochaAdapter();

            mochaAdapter.addFile('path/to/file');

            assert.calledWithMatch(clearRequire, 'path/to/file');
            assert.callOrder(clearRequire, MochaStub.prototype.addFile);
        });

        it('should load files after add', function() {
            var mochaAdapter = new MochaAdapter();

            mochaAdapter.addFile('path/to/file');

            assert.calledOnce(MochaStub.prototype.loadFiles);
            assert.callOrder(MochaStub.prototype.addFile, MochaStub.prototype.loadFiles);
        });

        it('should flush files after load', function() {
            var mocha = new MochaStub();
            mocha.files = ['some/file'];
            MochaStub.prototype.__constructor.returns(mocha);

            var mochaAdapter = new MochaAdapter();

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

    describe('inject browser', function() {
        it('should request browser before suite execution', function() {
            MochaStub.prototype.suite.beforeAll.yields();
            browserAgent.getBrowser.returns(q());

            mkMochaAdapter_();

            assert.calledOnce(browserAgent.getBrowser);
        });

        it('should release browser after suite execution', function() {
            var browser = {};
            browserAgent.getBrowser.returns(q(browser));
            browserAgent.freeBrowser.returns(q());

            mkMochaAdapter_();

            var beforeAll = MochaStub.prototype.suite.beforeAll.firstCall.args[0],
                afterAll = MochaStub.prototype.suite.afterAll.firstCall.args[0];

            return beforeAll()
                .then(afterAll)
                .then(function() {
                    assert.calledOnce(browserAgent.freeBrowser);
                    assert.calledWith(browserAgent.freeBrowser, browser);
                });
        });

        it('should disable mocha timeouts while setting browser hooks', function() {
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

        it('should not be rejected if freeBrowser failed', function() {
            var browser = {};

            browserAgent.getBrowser.returns(q(browser));
            browserAgent.freeBrowser.returns(q.reject('some-error'));

            mkMochaAdapter_();

            var beforeAll = MochaStub.prototype.suite.beforeAll.firstCall.args[0],
                afterAll = MochaStub.prototype.suite.afterAll.firstCall.args[0];

            return beforeAll()
                .then(afterAll)
                .then(function() {
                    assert.calledOnce(logger.warn);
                    assert.calledWithMatch(logger.warn, /some-error/);
                });
        });
    });

    describe('inject skip', () => {
        beforeEach(() => {
            sandbox.stub(Skip.prototype, 'handleEntity');
        });

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

    describe('attachTestFilter', function() {
        let mochaAdapter;

        beforeEach(function() {
            mochaAdapter = mkMochaAdapter_();
        });

        it('should check if test should be run', function() {
            var someTest = mkTestStub_(),
                shouldRun = sandbox.stub().returns(true);

            MochaStub.prototype.suite.tests = [someTest];
            BrowserAgent.prototype.browserId = 'some-browser';

            mochaAdapter.attachTestFilter(shouldRun);

            MochaStub.prototype.suite.emit('test', someTest);
            assert.calledWith(shouldRun, someTest, 'some-browser');
        });

        it('should not remove test which expected to be run', function() {
            var test1 = mkTestStub_(),
                test2 = mkTestStub_(),
                shouldRun = sandbox.stub().returns(true);

            MochaStub.prototype.suite.tests = [test1, test2];

            mochaAdapter.attachTestFilter(shouldRun);

            MochaStub.prototype.suite.emit('test', test2);
            assert.deepEqual(MochaStub.prototype.suite.tests, [test1, test2]);
        });

        it('should remove test which does not suppose to be run', function() {
            var test1 = mkTestStub_(),
                test2 = mkTestStub_(),
                shouldRun = sandbox.stub().returns(false);

            MochaStub.prototype.suite.tests = [test1, test2];

            mochaAdapter.attachTestFilter(shouldRun);

            MochaStub.prototype.suite.emit('test', test2);
            assert.deepEqual(MochaStub.prototype.suite.tests, [test1]);
        });
    });

    describe('attachEmitFn', function() {
        let mochaAdapter;

        beforeEach(function() {
            sandbox.stub(ProxyReporter.prototype, '__constructor');
            mochaAdapter = mkMochaAdapter_();
        });

        function attachEmitFn_(emitFn) {
            mochaAdapter.attachEmitFn(emitFn);

            var Reporter = MochaStub.prototype.reporter.lastCall.args[0];
            new Reporter(); // jshint ignore:line
        }

        it('should set mocha reporter as proxy reporter in order to proxy events to emit fn', function() {
            attachEmitFn_(sinon.spy());

            assert.calledOnce(ProxyReporter.prototype.__constructor);
        });

        it('should pass to proxy reporter emit fn', function() {
            var emitFn = sinon.spy().named('emit');

            attachEmitFn_(emitFn);

            assert.calledOnce(ProxyReporter.prototype.__constructor);
            assert.calledWith(ProxyReporter.prototype.__constructor, emitFn);
        });

        it('should pass to proxy reporter getter for requested browser', function() {
            var browser = {};

            attachEmitFn_(sinon.spy());

            browserAgent.getBrowser.returns(q(browser));
            var beforeAll = MochaStub.prototype.suite.beforeAll.firstCall.args[0];

            return beforeAll()
                .then(function() {
                    var getBrowser = ProxyReporter.prototype.__constructor.lastCall.args[1];
                    assert.equal(browser, getBrowser());
                });
        });

        it('should pass to proxy reporter getter for browser id if browser not requested', function() {
            browserAgent.browserId = 'some-browser';

            attachEmitFn_(sinon.spy());

            var getBrowser = ProxyReporter.prototype.__constructor.lastCall.args[1];
            assert.deepEqual(getBrowser(), {id: 'some-browser'});
        });
    });
});
