'use strict';

var BrowserAgent = require('../../../../lib/browser-agent'),
    logger = require('../../../../lib/utils').logger,
    ProxyReporter = require('../../../../lib/runner/mocha-runner/proxy-reporter'),
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

    beforeEach(function() {
        clearRequire = sandbox.stub().named('clear-require');

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
    });

    describe('attach browser', function() {
        var browserAgent;

        beforeEach(function() {
            browserAgent = sinon.createStubInstance(BrowserAgent);
        });

        function mkMochaAdapter_() {
            return new MochaAdapter({}, browserAgent);
        }

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

    describe('attachTestFilter', function() {
        var browserAgent,
            mochaAdapter;

        beforeEach(function() {
            browserAgent = sinon.createStubInstance(BrowserAgent);
            mochaAdapter = new MochaAdapter({}, browserAgent);
        });

        function mkTestStub_(opts) {
            return _.defaults(opts || {}, {
                title: 'default-title',
                parent: MochaStub.prototype.suite
            });
        }

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
        var browserAgent,
            mochaAdapter;

        beforeEach(function() {
            sandbox.stub(ProxyReporter.prototype, '__constructor');
            browserAgent = sinon.createStubInstance(BrowserAgent);
            mochaAdapter = new MochaAdapter({}, browserAgent);
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

            assert.calledOnce(ProxyReporter.prototype.__constructor, emitFn);
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
