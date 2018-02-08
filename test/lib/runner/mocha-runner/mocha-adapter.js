'use strict';

const path = require('path');
const q = require('q');
const _ = require('lodash');
const BrowserAgent = require('gemini-core').BrowserAgent;
const proxyquire = require('proxyquire').noCallThru();
const {Image} = require('gemini-core');
const logger = require('lib/utils/logger');
const crypto = require('lib/utils/crypto');
const errors = require('lib/constants/errors');
const SkipBuilder = require('lib/runner/mocha-runner/skip/skip-builder');
const OnlyBuilder = require('lib/runner/mocha-runner/skip/only-builder');
const Skip = require('lib/runner/mocha-runner/skip/');
const TestSkipper = require('lib/runner/test-skipper');
const RunnerEvents = require('lib/constants/runner-events');
const MochaStub = require('../../_mocha');

describe('mocha-runner/mocha-adapter', () => {
    const sandbox = sinon.sandbox.create();

    let MochaAdapter;
    let browserAgent;
    let clearRequire;
    let testSkipper;
    let proxyReporter;

    const mkMochaAdapter_ = (config) => {
        return MochaAdapter.create(browserAgent, _.extend({patternsOnReject: []}, config));
    };

    const mkBrowserStub_ = (opts) => {
        return _.defaults(opts || {}, {
            publicAPI: Object.create({}),
            updateChanges: sinon.stub()
        });
    };

    beforeEach(() => {
        testSkipper = sinon.createStubInstance(TestSkipper);
        browserAgent = sinon.createStubInstance(BrowserAgent);
        browserAgent.getBrowser.returns(q(mkBrowserStub_()));
        browserAgent.freeBrowser.returns(q());

        clearRequire = sandbox.stub().named('clear-require');
        proxyReporter = sandbox.stub().named('proxy-reporter');

        sandbox.stub(logger);
        sandbox.stub(crypto, 'getShortMD5');

        MochaAdapter = proxyquire('../../../../lib/runner/mocha-runner/mocha-adapter', {
            'clear-require': clearRequire,
            'mocha': MochaStub,
            './proxy-reporter': proxyReporter
        });
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

    describe('forbid suite hooks', () => {
        beforeEach(() => mkMochaAdapter_());

        it('should throw in case of "before" hook', () => {
            assert.throws(() => {
                MochaStub.lastInstance.updateSuiteTree((suite) => suite.beforeAll(() => {}));
            }, '"before" and "after" hooks are forbidden, use "beforeEach" and "afterEach" hooks instead');
        });

        it('should throw in case of "after" hook', () => {
            assert.throw(() => {
                MochaStub.lastInstance.updateSuiteTree((suite) => suite.afterAll(() => {}));
            }, '"before" and "after" hooks are forbidden, use "beforeEach" and "afterEach" hooks instead');
        });
    });

    describe('remove test hooks', () => {
        it('should remove "beforeEach" hooks', () => {
            const mochaAdapter = mkMochaAdapter_();
            const beforeEach = sandbox.spy().named('beforeEach');

            MochaStub.lastInstance.updateSuiteTree((suite) => suite.beforeEach(beforeEach).addTest());

            return mochaAdapter.run()
                .then(() => assert.notCalled(beforeEach));
        });

        it('should remove "afterEach" hooks', () => {
            const mochaAdapter = mkMochaAdapter_();
            const afterEach = sandbox.spy().named('afterEach');

            MochaStub.lastInstance.updateSuiteTree((suite) => suite.afterEach(afterEach).addTest());

            return mochaAdapter.run()
                .then(() => assert.notCalled(afterEach));
        });
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

    describe('extend suite API', () => {
        describe('id', () => {
            it('should be added to suite', () => {
                mkMochaAdapter_();

                MochaStub.lastInstance.updateSuiteTree((suite) => suite.addSuite(MochaStub.Suite.create()));

                const suite = MochaStub.lastInstance.suite.suites[0];

                assert.isFunction(suite.id);
            });

            it('should generate uniq suite id', () => {
                crypto.getShortMD5.withArgs('/some/file.js').returns('12345');

                mkMochaAdapter_();

                MochaStub.lastInstance.suite.emit('pre-require', {}, '/some/file.js');

                MochaStub.lastInstance.updateSuiteTree((suite) => {
                    return suite
                        .addSuite(MochaStub.Suite.create())
                        .addSuite(MochaStub.Suite.create());
                });

                const suite1 = MochaStub.lastInstance.suite.suites[0];
                const suite2 = MochaStub.lastInstance.suite.suites[1];

                assert.equal(suite1.id(), '123450');
                assert.equal(suite2.id(), '123451');
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

    describe('extend test API', () => {
        it('should add "id" method for test', () => {
            mkMochaAdapter_();
            MochaStub.lastInstance.updateSuiteTree((suite) => suite.addTest(new MochaStub.Test()));

            const test = MochaStub.lastInstance.suite.tests[0];

            assert.isFunction(test.id);
        });

        it('should generate uniq id for test by calling "id" method', () => {
            crypto.getShortMD5.returns('12345');
            mkMochaAdapter_();
            MochaStub.lastInstance.updateSuiteTree((suite) => suite.addTest(new MochaStub.Test()));

            const test = MochaStub.lastInstance.suite.tests[0];

            assert.equal(test.id(), '12345');
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
            mochaAdapter = mkMochaAdapter_();
            sandbox.spy(mochaAdapter, 'emit').named('emit');
        });

        function passthroughMochaEvents_() {
            const Reporter = MochaStub.lastInstance.reporter.lastCall.args[0];
            new Reporter(); // eslint-disable-line no-new
        }

        it('should set mocha reporter as proxy reporter in order to proxy events to emit fn', () => {
            passthroughMochaEvents_();

            assert.calledOnce(proxyReporter);
            assert.calledWithNew(proxyReporter);
        });

        it('should pass to proxy reporter emit fn', () => {
            passthroughMochaEvents_();

            const emit_ = proxyReporter.firstCall.args[0];
            emit_('some-event', {some: 'data'});

            assert.calledOnceWith(mochaAdapter.emit, 'some-event', sinon.match({some: 'data'}));
        });

        it('should pass to proxy reporter getter for requested browser', () => {
            const browser = mkBrowserStub_();
            browserAgent.getBrowser.returns(q(browser));
            passthroughMochaEvents_();

            MochaStub.lastInstance.updateSuiteTree((suite) => suite.addTest());

            return mochaAdapter.run()
                .then(() => {
                    const getBrowser = proxyReporter.lastCall.args[1];
                    assert.equal(browser, getBrowser());
                });
        });

        it('should reset browser on reinit', () => {
            const browser = mkBrowserStub_();
            browserAgent.getBrowser.returns(q(browser));

            passthroughMochaEvents_();
            MochaStub.lastInstance.updateSuiteTree((suite) => suite.addTest());

            return mochaAdapter.run()
                .then(() => mochaAdapter.reinit())
                .then(() => {
                    const getBrowser = proxyReporter.lastCall.args[1];
                    assert.notDeepEqual(getBrowser(), browser);
                });
        });

        it('should pass to proxy reporter getter for browser id if browser not requested', () => {
            browserAgent.browserId = 'some-browser';

            passthroughMochaEvents_();

            const getBrowser = proxyReporter.lastCall.args[1];
            assert.deepEqual(getBrowser(), {id: 'some-browser'});
        });

        describe('if event handler throws', () => {
            const initBadHandler_ = (event, handler) => {
                mochaAdapter.on(event, handler);

                passthroughMochaEvents_();
                return proxyReporter.firstCall.args[0];
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
        beforeEach(() => {
            sandbox.stub(Image, 'buildDiff');
        });

        function stubWorkers() {
            return {
                runTest: sandbox.stub().resolves({})
            };
        }

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

            return mochaAdapter.run(stubWorkers())
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

                return mochaAdapter.run(stubWorkers()).then(() => {
                    assert.calledOnceWith(browserAgent.freeBrowser, browser, {force: false});
                });
            });

            it('conditionally if test error does not matches on patterns on reject', () => {
                const patternsOnReject = [/some-error/i];
                const mochaAdapter = mkMochaAdapter_({patternsOnReject});

                MochaStub.lastInstance.updateSuiteTree((suite) => suite.addTest());

                return mochaAdapter.run(stubWorkers()).then(() => {
                    assert.calledOnceWith(browserAgent.freeBrowser, sinon.match.any, {force: false});
                });
            });

            it('unconditionally if test error matches on patterns on reject', () => {
                const patternsOnReject = [/some-error/i];
                const mochaAdapter = mkMochaAdapter_({patternsOnReject});

                MochaStub.lastInstance.updateSuiteTree((suite) => suite.addTest());

                const workers = stubWorkers();
                workers.runTest.rejects(new Error('some-error'));

                return mochaAdapter.run(workers)
                    .then(() => {
                        assert.calledOnceWith(browserAgent.freeBrowser, sinon.match.any, {force: true});
                    });
            });
        });

        it('should run a test in subprocess using passed workers', () => {
            const mochaAdapter = mkMochaAdapter_();
            const workers = stubWorkers();

            browserAgent.getBrowser.returns(q({id: 'bro-id', sessionId: '100-500'}));

            MochaStub.lastInstance.updateSuiteTree((suite) => suite.addTest({title: 'test-title', file: 'some/file'}));

            return mochaAdapter.run(workers)
                .then(() => assert.calledOnceWith(workers.runTest, 'test-title', {browserId: 'bro-id', sessionId: '100-500', file: 'some/file'}));
        });

        it('should extend test with browser data', () => {
            const mochaAdapter = mkMochaAdapter_();
            const test = MochaStub.Test.create();

            browserAgent.getBrowser.returns(q({id: 'bro-id', sessionId: '100-500', updateChanges: () => {}}));

            MochaStub.lastInstance.updateSuiteTree((suite) => suite.addTest(test));

            const workers = stubWorkers();
            workers.runTest.resolves({meta: {some: 'meta'}});

            return mochaAdapter.run(workers)
                .then(() => assert.deepInclude(test, {browserId: 'bro-id', sessionId: '100-500', meta: {some: 'meta'}}));
        });

        it('should extend test with hermione context', () => {
            const mochaAdapter = mkMochaAdapter_();
            const test = MochaStub.Test.create();

            browserAgent.getBrowser.returns(q({id: 'bro-id', sessionId: '100-500', updateChanges: () => {}}));

            MochaStub.lastInstance.updateSuiteTree((suite) => suite.addTest(test));

            const workers = stubWorkers();
            workers.runTest.resolves({hermioneCtx: {some: 'data'}});

            return mochaAdapter.run(workers)
                .then(() => assert.deepInclude(test, {browserId: 'bro-id', sessionId: '100-500', hermioneCtx: {some: 'data'}}));
        });

        it('should update browser state', () => {
            const mochaAdapter = mkMochaAdapter_();
            const browser = mkBrowserStub_();

            browserAgent.getBrowser.returns(q(browser));
            MochaStub.lastInstance.updateSuiteTree((suite) => suite.addTest());

            const workers = stubWorkers();
            workers.runTest.resolves({
                meta: {some: 'meta'},
                changes: {originWindowSize: {width: 1, height: 1}}
            });

            return mochaAdapter.run(workers)
                .then(() => {
                    assert.calledWith(browser.updateChanges, {
                        originWindowSize: {width: 1, height: 1}
                    });
                });
        });

        it('should fail test if running of test in subprocess fails', () => {
            const mochaAdapter = mkMochaAdapter_();
            const testFailSpy = sinon.spy();

            MochaStub.lastInstance.updateSuiteTree((suite) => suite.addTest().onFail(testFailSpy));

            const workers = stubWorkers();
            workers.runTest.rejects({some: 'err'});

            return mochaAdapter.run(workers)
                .then(() => {
                    assert.calledOnce(testFailSpy);
                    assert.calledWithMatch(testFailSpy, {error: {some: 'err'}});
                });
        });

        describe('extend test error on "ImageDiffError"', () => {
            it('should extend image diff error by saving diff function', () => {
                const mochaAdapter = mkMochaAdapter_();
                const testFailSpy = sinon.spy();

                MochaStub.lastInstance.updateSuiteTree((suite) => suite.addTest().onFail(testFailSpy));

                const workers = stubWorkers();
                workers.runTest.rejects({type: errors.IMAGE_DIFF_ERROR});

                return mochaAdapter.run(workers)
                    .then(() => {
                        const {saveDiffTo} = testFailSpy.firstCall.args[0].error;

                        assert.isFunction(saveDiffTo);
                    });
            });

            it('should extend image diff error by saving diff function with diff options', () => {
                const mochaAdapter = mkMochaAdapter_();
                const testFailSpy = sinon.spy();

                MochaStub.lastInstance.updateSuiteTree((suite) => suite.addTest().onFail(testFailSpy));

                const workers = stubWorkers();
                workers.runTest.rejects({type: errors.IMAGE_DIFF_ERROR, diffOpts: {some: 'opts'}});

                return mochaAdapter.run(workers)
                    .then(() => {
                        const {saveDiffTo} = testFailSpy.firstCall.args[0].error || sandbox.stub();

                        saveDiffTo('some/path');

                        assert.calledWith(Image.buildDiff, {some: 'opts', diff: 'some/path'});
                    });
            });

            it('should extend image diff error by saving diff function if test did not fail with image diff error', () => {
                const mochaAdapter = mkMochaAdapter_();
                const testFailSpy = sinon.spy();

                MochaStub.lastInstance.updateSuiteTree((suite) => suite.addTest().onFail(testFailSpy));

                const workers = stubWorkers();
                workers.runTest.rejects({type: 'some-error'});

                return mochaAdapter.run(workers)
                    .then(() => {
                        const {saveDiffTo} = testFailSpy.firstCall.args[0].error;

                        assert.isUndefined(saveDiffTo);
                    });
            });
        });

        it('should extend test with browser data even if running of test in subprocess fails', () => {
            const mochaAdapter = mkMochaAdapter_();
            const test = MochaStub.Test.create();

            browserAgent.getBrowser.returns(q({id: 'bro-id', sessionId: '100-500'}));

            MochaStub.lastInstance.updateSuiteTree((suite) => suite.addTest(test));

            const workers = stubWorkers();
            workers.runTest.rejects({meta: {some: 'meta'}});

            return mochaAdapter.run(workers)
                .then(() => assert.deepInclude(test, {browserId: 'bro-id', sessionId: '100-500', meta: {some: 'meta'}}));
        });
    });
});
