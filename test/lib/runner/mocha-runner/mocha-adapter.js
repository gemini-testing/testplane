'use strict';

const path = require('path');
const q = require('q');
const _ = require('lodash');
const BrowserAgent = require('gemini-core').BrowserAgent;
const proxyquire = require('proxyquire').noCallThru();
const logger = require('../../../../lib/utils').logger;
const ProxyReporter = require('../../../../lib/runner/mocha-runner/proxy-reporter');
const SkipBuilder = require('../../../../lib/runner/mocha-runner/skip/skip-builder');
const OnlyBuilder = require('../../../../lib/runner/mocha-runner/skip/only-builder');
const Skip = require('../../../../lib/runner/mocha-runner/skip/');
const TestSkipper = require('../../../../lib/runner/test-skipper');
const RunnerEvents = require('../../../../lib/constants/runner-events');
const MochaStub = require('../../_mocha');

describe('mocha-runner/mocha-adapter', () => {
    const sandbox = sinon.sandbox.create();

    let MochaAdapter;
    let browserAgent;
    let clearRequire;
    let testSkipper;

    const mkMochaAdapter_ = (config) => {
        return MochaAdapter.create(browserAgent, _.extend({patternsOnReject: []}, config));
    };

    const mkBrowserStub_ = () => {
        return {publicAPI: Object.create({})};
    };

    beforeEach(() => {
        testSkipper = sinon.createStubInstance(TestSkipper);
        browserAgent = sinon.createStubInstance(BrowserAgent);
        browserAgent.getBrowser.returns(q(mkBrowserStub_()));
        browserAgent.freeBrowser.returns(q());

        clearRequire = sandbox.stub().named('clear-require');
        MochaAdapter = proxyquire('../../../../lib/runner/mocha-runner/mocha-adapter', {
            'clear-require': clearRequire,
            'mocha': MochaStub
        });

        sandbox.stub(logger);
    });

    afterEach(() => sandbox.restore());

    describe('prepare', () => {
        afterEach(() => delete global.hermione);

        it('should add an empty hermione object to global', () => {
            MochaAdapter.prepare();

            assert.deepEqual(global.hermione, {});
        });

        it('should do nothing if hermione is already in a global', () => {
            global.hermione = {some: 'data'};

            MochaAdapter.prepare();

            assert.deepEqual(global.hermione, {some: 'data'});
        });
    });

    describe('constructor', () => {
        it('should pass shared opts to mocha instance', () => {
            mkMochaAdapter_({mochaOpts: {grep: 'foo'}});

            assert.deepEqual(MochaStub.lastInstance.constructorArgs, {grep: 'foo'});
        });

        it('should enable full stacktrace in mocha', () => {
            mkMochaAdapter_();

            assert.called(MochaStub.lastInstance.fullTrace);
        });

        it('should disable timeouts', () => {
            mkMochaAdapter_();

            assert.calledOnceWith(MochaStub.lastInstance.suite.enableTimeouts, false);
        });
    });

    describe('loadFiles', () => {
        it('should be chainable', () => {
            const mochaAdapter = mkMochaAdapter_();

            assert.deepEqual(mochaAdapter.loadFiles(['path/to/file']), mochaAdapter);
        });

        it('should load files', () => {
            const mochaAdapter = mkMochaAdapter_();

            mochaAdapter.loadFiles(['path/to/file']);

            assert.calledOnceWith(MochaStub.lastInstance.addFile, 'path/to/file');
        });

        it('should load a single file', () => {
            const mochaAdapter = mkMochaAdapter_();

            mochaAdapter.loadFiles('path/to/file');

            assert.calledOnceWith(MochaStub.lastInstance.addFile, 'path/to/file');
        });

        it('should clear require cache for file before adding', () => {
            const mochaAdapter = mkMochaAdapter_();

            mochaAdapter.loadFiles(['path/to/file']);

            assert.calledOnceWith(clearRequire, path.resolve('path/to/file'));
            assert.callOrder(clearRequire, MochaStub.lastInstance.addFile);
        });

        it('should load file after add', () => {
            const mochaAdapter = mkMochaAdapter_();

            mochaAdapter.loadFiles(['path/to/file']);

            assert.calledOnce(MochaStub.lastInstance.loadFiles);
            assert.callOrder(MochaStub.lastInstance.addFile, MochaStub.lastInstance.loadFiles);
        });

        it('should flush files after load', () => {
            const mochaAdapter = mkMochaAdapter_();

            mochaAdapter.loadFiles(['path/to/file']);

            assert.deepEqual(MochaStub.lastInstance.files, []);
        });
    });

    describe('hermione global', () => {
        beforeEach(() => MochaAdapter.prepare());
        afterEach(() => delete global.hermione);

        it('hermione.skip should return SkipBuilder instance', () => {
            mkMochaAdapter_();

            assert.instanceOf(global.hermione.skip, SkipBuilder);
        });

        it('hermione.only should return OnlyBuilder instance', () => {
            mkMochaAdapter_();

            assert.instanceOf(global.hermione.only, OnlyBuilder);
        });

        it('hermione.ctx should return passed ctx', () => {
            mkMochaAdapter_({ctx: {some: 'ctx'}});

            assert.deepEqual(global.hermione.ctx, {some: 'ctx'});
        });
    });

    describe('remove hooks', () => {
        it('TODO');
    });

    describe('inject skip', () => {
        let mochaAdapter;

        beforeEach(() => {
            browserAgent.getBrowser.returns(q(mkBrowserStub_()));
            browserAgent.freeBrowser.returns(q());
            sandbox.stub(Skip.prototype, 'handleEntity');

            mochaAdapter = mkMochaAdapter_();
        });

        it('should apply skip to test', () => {
            const test = new MochaStub.Test();

            MochaStub.lastInstance.updateSuiteTree((suite) => suite.addTest(test));

            return mochaAdapter.run()
                .then(() => {
                    assert.called(Skip.prototype.handleEntity);
                    assert.calledWith(Skip.prototype.handleEntity, test);
                });
        });

        it('should apply skip to suite', () => {
            const nestedSuite = MochaStub.Suite.create();

            MochaStub.lastInstance.updateSuiteTree((suite) => suite.addSuite(nestedSuite));

            return mochaAdapter.run()
                .then(() => {
                    assert.called(Skip.prototype.handleEntity);
                    assert.calledWith(Skip.prototype.handleEntity, nestedSuite);
                });
        });
    });

    describe('applySkip', () => {
        it('should skip suite using test skipper', () => {
            const mochaAdapter = mkMochaAdapter_();
            browserAgent.browserId = 'some-browser';

            mochaAdapter.applySkip(testSkipper);

            assert.calledWith(testSkipper.applySkip, MochaStub.lastInstance.suite, 'some-browser');
        });

        it('should be chainable', () => {
            const mochaAdapter = mkMochaAdapter_();
            const mochaInstance = mochaAdapter.applySkip(testSkipper);

            assert.instanceOf(mochaInstance, MochaAdapter);
        });
    });

    describe('attachTestFilter', () => {
        it('should not remove test which expected to be run', () => {
            const testSpy = sinon.spy();
            const shouldRun = () => true;
            const mochaAdapter = mkMochaAdapter_();
            mochaAdapter.attachTestFilter(shouldRun);

            MochaStub.lastInstance.updateSuiteTree((suite) => {
                return suite
                    .addTest({title: 'test1'})
                    .addTest({title: 'test2'})
                    .onTestBegin(testSpy);
            });

            return mochaAdapter.run()
                .then(() => {
                    assert.calledTwice(testSpy);
                    assert.calledWithMatch(testSpy.firstCall, {title: 'test1'});
                    assert.calledWithMatch(testSpy.secondCall, {title: 'test2'});
                });
        });

        it('should remove test which does not suppose to be run', () => {
            const testSpy = sinon.spy();
            const shouldRun = sandbox.stub();
            shouldRun.onFirstCall().returns(true);
            shouldRun.onSecondCall().returns(false);

            const mochaAdapter = mkMochaAdapter_();
            mochaAdapter.attachTestFilter(shouldRun);

            MochaStub.lastInstance.updateSuiteTree((suite) => {
                return suite
                    .addTest({title: 'test1'})
                    .addTest({title: 'test2'})
                    .onTestBegin(testSpy);
            });

            return mochaAdapter.run()
                .then(() => {
                    assert.calledOnce(testSpy);
                    assert.calledWithMatch(testSpy.firstCall, {title: 'test1'});
                });
        });
    });

    describe('tests', () => {
        it('should return filtered tests', () => {
            const mochaAdapter = mkMochaAdapter_();
            const shouldRun = sandbox.stub()
                .onFirstCall().returns(true)
                .onSecondCall().returns(false);

            mochaAdapter.attachTestFilter(shouldRun);

            const test1 = new MochaStub.Test();
            const test2 = new MochaStub.Test();
            MochaStub.lastInstance.updateSuiteTree((suite) => {
                return suite
                    .addTest(test1)
                    .addTest(test2);
            });

            assert.deepEqual(mochaAdapter.tests, [test1]);
        });

        it('should restore tests storage after reinit', () => {
            const mochaAdapter = mkMochaAdapter_();

            mochaAdapter.attachTestFilter(sandbox.stub().returns(true));

            MochaStub.lastInstance.updateSuiteTree((suite) => suite.addTest(new MochaStub.Test()));

            mochaAdapter.reinit();

            assert.deepEqual(mochaAdapter.tests, []);
        });
    });

    describe('passthrough mocha events', () => {
        let mochaAdapter;

        beforeEach(() => {
            sandbox.stub(ProxyReporter.prototype, '__constructor');
            mochaAdapter = mkMochaAdapter_();
            sandbox.spy(mochaAdapter, 'emit').named('emit');
        });

        function passthroughMochaEvents_() {
            const Reporter = MochaStub.lastInstance.reporter.lastCall.args[0];
            new Reporter(); // eslint-disable-line no-new
        }

        it('should set mocha reporter as proxy reporter in order to proxy events to emit fn', () => {
            passthroughMochaEvents_();

            assert.calledOnce(ProxyReporter.prototype.__constructor);
        });

        it('should pass to proxy reporter emit fn', () => {
            passthroughMochaEvents_();

            const emit_ = ProxyReporter.prototype.__constructor.firstCall.args[0];
            emit_('some-event', {some: 'data'});

            assert.calledOnce(mochaAdapter.emit);
            assert.calledWith(mochaAdapter.emit, 'some-event', sinon.match({some: 'data'}));
        });

        it('should pass to proxy reporter getter for requested browser', () => {
            const browser = mkBrowserStub_();
            browserAgent.getBrowser.returns(q(browser));
            passthroughMochaEvents_();

            MochaStub.lastInstance.updateSuiteTree((suite) => suite.addTest());

            return mochaAdapter.run()
                .then(() => {
                    const getBrowser = ProxyReporter.prototype.__constructor.lastCall.args[1];
                    assert.equal(browser, getBrowser());
                });
        });

        it('should pass to proxy reporter getter for browser id if browser not requested', () => {
            browserAgent.browserId = 'some-browser';

            passthroughMochaEvents_();

            const getBrowser = ProxyReporter.prototype.__constructor.lastCall.args[1];
            assert.deepEqual(getBrowser(), {id: 'some-browser'});
        });

        describe('if event handler throws', () => {
            const initBadHandler_ = (event, handler) => {
                mochaAdapter.on(event, handler);

                passthroughMochaEvents_();
                return ProxyReporter.prototype.__constructor.firstCall.args[0];
            };

            it('proxy should rethrow error', () => {
                const emit_ = initBadHandler_('foo', () => {
                    throw new Error(new Error('bar'));
                });

                assert.throws(() => emit_('foo'), /bar/);
            });

            it('run should be rejected', () => {
                const emit_ = initBadHandler_('foo', () => {
                    throw new Error('bar');
                });

                const promise = mochaAdapter.run();

                try {
                    emit_('foo');
                } catch (e) {
                    // eslint иди лесом
                }

                return assert.isRejected(promise, /bar/);
            });
        });

        describe('file events', () => {
            beforeEach(() => MochaAdapter.init());
            afterEach(() => delete global.hermione);

            _.forEach({
                'pre-require': 'BEFORE_FILE_READ',
                'post-require': 'AFTER_FILE_READ'
            }, (hermioneEvent, mochaEvent) => {
                it(`should emit ${hermioneEvent} on mocha ${mochaEvent}`, () => {
                    browserAgent.browserId = 'bro';

                    MochaStub.lastInstance.suite.emit(mochaEvent, {}, '/some/file.js');

                    assert.calledOnce(mochaAdapter.emit);
                    assert.calledWith(mochaAdapter.emit, RunnerEvents[hermioneEvent], {
                        file: '/some/file.js',
                        hermione: global.hermione,
                        browser: 'bro',
                        suite: mochaAdapter.suite
                    });
                });
            });
        });
    });

    describe('run', () => {
        it('should request browser before suite execution', () => {
            const mochaAdapter = mkMochaAdapter_();

            MochaStub.lastInstance.updateSuiteTree((suite) => suite.addTest());

            return mochaAdapter.run()
                .then(() => assert.calledOnce(browserAgent.getBrowser));
        });

        it('should fail test if requesting of a browser fails', () => {
            const mochaAdapter = mkMochaAdapter_();
            const testFailSpy = sinon.spy();
            const error = new Error();

            browserAgent.getBrowser.returns(q.reject(error));

            MochaStub.lastInstance.updateSuiteTree((rootSuite) => {
                return rootSuite
                    .addSuite(MochaStub.Suite.create(rootSuite).addTest({title: 'some-test'}).onFail(testFailSpy));
            });

            return mochaAdapter.run()
                .then(() => {
                    assert.calledOnce(testFailSpy);
                    assert.calledWithMatch(testFailSpy, {error, test: {title: 'some-test'}});
                });
        });

        it('should request browsers for suite with at least one non-skipped test', () => {
            const mochaAdapter = mkMochaAdapter_();

            MochaStub.lastInstance.updateSuiteTree((suite) => {
                return suite
                    .addTest({pending: true})
                    .addTest();
            });

            return mochaAdapter.run()
                .then(() => assert.calledOnce(browserAgent.getBrowser));
        });

        it('should not be rejected if freeBrowser failed', () => {
            const browser = mkBrowserStub_();

            browserAgent.getBrowser.returns(q(browser));
            browserAgent.freeBrowser.returns(q.reject('some-error'));

            const mochaAdapter = mkMochaAdapter_();

            MochaStub.lastInstance.updateSuiteTree((suite) => suite.addTest());

            return mochaAdapter.run()
                .then(() => {
                    assert.calledOnce(logger.warn);
                    assert.calledWithMatch(logger.warn, /some-error/);
                });
        });

        describe('should release browser', () => {
            it('after suite execution', () => {
                const browser = mkBrowserStub_();
                browserAgent.getBrowser.returns(q(browser));
                browserAgent.freeBrowser.returns(q());

                const mochaAdapter = mkMochaAdapter_();

                MochaStub.lastInstance.updateSuiteTree((suite) => suite.addTest());

                return mochaAdapter.run().then(() => {
                    assert.calledOnceWith(browserAgent.freeBrowser, browser, {force: false});
                });
            });

            it('conditionally if test error does not matches on patterns on reject', () => {
                const patternsOnReject = [/some-error/i];
                const mochaAdapter = mkMochaAdapter_({patternsOnReject});

                MochaStub.lastInstance.updateSuiteTree((suite) => suite.addTest());
                mochaAdapter.emit(RunnerEvents.TEST_FAIL, {err: {message: 'other-error'}});

                return mochaAdapter.run().then(() => {
                    assert.calledOnceWith(browserAgent.freeBrowser, sinon.match.any, {force: false});
                });
            });

            it('unconditionally if test error matches on patterns on reject', () => {
                const patternsOnReject = [/some-error/i];
                const mochaAdapter = mkMochaAdapter_({patternsOnReject});

                MochaStub.lastInstance.updateSuiteTree((suite) => suite.addTest());
                mochaAdapter.emit(RunnerEvents.TEST_FAIL, {err: {message: 'SOME-ERROR'}});

                return mochaAdapter.run().then(() => {
                    assert.calledOnceWith(browserAgent.freeBrowser, sinon.match.any, {force: true});
                });
            });
        });

        it('should run a test in subprocess using passed workers', () => {
            const mochaAdapter = mkMochaAdapter_();
            const workers = {runTest: sandbox.stub().yields()};
            browserAgent.getBrowser.returns(q({id: 'bro-id', sessionId: '100-500'}));

            MochaStub.lastInstance.updateSuiteTree((suite) => suite.addTest({title: 'test-title'}));

            return mochaAdapter.run(workers)
                .then(() => assert.calledOnceWith(workers.runTest, 'test-title', {browserId: 'bro-id', sessionId: '100-500'}));
        });
    });
});
