'use strict';

const BrowserAgent = require('../../../../lib/browser-agent');
const logger = require('../../../../lib/utils').logger;
const ProxyReporter = require('../../../../lib/runner/mocha-runner/proxy-reporter');
const SkipBuilder = require('../../../../lib/runner/mocha-runner/skip/skip-builder');
const OnlyBuilder = require('../../../../lib/runner/mocha-runner/skip/only-builder');
const Skip = require('../../../../lib/runner/mocha-runner/skip/');
const TestSkipper = require('../../../../lib/runner/test-skipper');
const RunnerEvents = require('../../../../lib/constants/runner-events');
const MochaStub = require('../../_mocha');
const proxyquire = require('proxyquire').noCallThru();
const _ = require('lodash');
const q = require('q');

describe('mocha-runner/mocha-adapter', () => {
    const sandbox = sinon.sandbox.create();

    let MochaAdapter;
    let browserAgent;
    let clearRequire;
    let testSkipper;

    const mkMochaAdapter_ = (opts, ctx) => {
        return MochaAdapter.create(opts || {}, browserAgent, ctx);
    };

    const mkBrowserStub_ = () => {
        return {publicAPI: Object.create({})};
    };

    beforeEach(() => {
        testSkipper = sinon.createStubInstance(TestSkipper);
        browserAgent = sinon.createStubInstance(BrowserAgent);

        clearRequire = sandbox.stub().named('clear-require');
        MochaAdapter = proxyquire('../../../../lib/runner/mocha-runner/mocha-adapter', {
            'clear-require': clearRequire,
            'mocha': MochaStub
        });

        sandbox.stub(logger);
    });

    afterEach(() => sandbox.restore());

    describe('init', () => {
        it('should add an empty hermione object to global', () => {
            MochaAdapter.init();

            assert.deepEqual(global.hermione, {});

            delete global.hermione;
        });
    });

    describe('constructor', () => {
        it('should pass shared opts to mocha instance', () => {
            mkMochaAdapter_({grep: 'foo'});

            assert.deepEqual(MochaStub.lastInstance.constructorArgs, {grep: 'foo'});
        });

        it('should enable full stacktrace in mocha', () => {
            mkMochaAdapter_();

            assert.called(MochaStub.lastInstance.fullTrace);
        });
    });

    describe('addFiles', () => {
        it('should load files', () => {
            const mochaAdapter = mkMochaAdapter_();

            mochaAdapter.loadFiles(['path/to/file']);

            assert.calledOnce(MochaStub.lastInstance.addFile);
            assert.calledWith(MochaStub.lastInstance.addFile, 'path/to/file');
        });

        it('should clear require cache for file before adding', () => {
            const mochaAdapter = mkMochaAdapter_();

            mochaAdapter.loadFiles(['path/to/file']);

            assert.calledWithMatch(clearRequire, 'path/to/file');
            assert.callOrder(clearRequire, MochaStub.lastInstance.addFile);
        });

        it('should load files after add', () => {
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

        it('should reload files', () => {
            const mochaAdapter = mkMochaAdapter_();

            mochaAdapter
                .loadFiles(['path/to/file'])
                .loadFiles();

            assert.calledTwice(MochaStub.lastInstance.addFile);
            assert.alwaysCalledWith(MochaStub.lastInstance.addFile, 'path/to/file');
        });

        describe('hermione global', () => {
            beforeEach(() => MochaAdapter.init());
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
                mkMochaAdapter_({}, {some: 'ctx'});

                assert.deepEqual(global.hermione.ctx, {some: 'ctx'});
            });
        });
    });

    describe('inject browser', () => {
        beforeEach(() => {
            browserAgent.getBrowser.returns(q(mkBrowserStub_()));
            browserAgent.freeBrowser.returns(q());
        });

        it('should request browser before suite execution', () => {
            const mochaAdapter = mkMochaAdapter_();

            MochaStub.lastInstance.updateSuiteTree((suite) => suite.addTest());

            return mochaAdapter.run()
                .then(() => assert.calledOnce(browserAgent.getBrowser));
        });

        it('should not request browsers for suite with one skipped test', () => {
            const mochaAdapter = mkMochaAdapter_();

            MochaStub.lastInstance.updateSuiteTree((suite) => suite.addTest({skipped: true}));

            return mochaAdapter.run()
                .then(() => assert.notCalled(browserAgent.getBrowser));
        });

        it('should request browsers for suite with at least one non-skipped test', () => {
            const mochaAdapter = mkMochaAdapter_();

            MochaStub.lastInstance.updateSuiteTree((suite) => {
                return suite
                    .addTest({skipped: true})
                    .addTest();
            });

            return mochaAdapter.run()
                .then(() => assert.calledOnce(browserAgent.getBrowser));
        });

        it('should not request browsers for suite with nested skipped tests', () => {
            const mochaAdapter = mkMochaAdapter_();

            MochaStub.lastInstance.updateSuiteTree((suite) => {
                return suite
                    .addSuite(
                        MochaStub.Suite.create()
                            .addTest({skipped: true})
                            .addTest({skipped: true})
                    );
            });

            return mochaAdapter.run()
                .then(() => assert.notCalled(browserAgent.getBrowser));
        });

        it('should release browser after suite execution', () => {
            const browser = mkBrowserStub_();
            browserAgent.getBrowser.returns(q(browser));
            browserAgent.freeBrowser.returns(q());

            const mochaAdapter = mkMochaAdapter_();

            MochaStub.lastInstance.updateSuiteTree((suite) => suite.addTest());

            return mochaAdapter.run().then(() => {
                assert.calledOnce(browserAgent.freeBrowser);
                assert.calledWith(browserAgent.freeBrowser, browser);
            });
        });

        it('should disable mocha timeouts while setting browser hooks', () => {
            const suitePrototype = MochaStub.Suite.prototype;
            const beforeAllStub = sandbox.stub(suitePrototype, 'beforeAll');
            const afterAllStub = sandbox.stub(suitePrototype, 'afterAll');

            mkMochaAdapter_();
            const suite = MochaStub.lastInstance.suite;

            assert.callOrder(
                suite.enableTimeouts, // get current value of enableTimeouts
                suite.enableTimeouts.withArgs(false).named('disableTimeouts'),
                beforeAllStub,
                afterAllStub,
                suite.enableTimeouts.withArgs(true).named('restoreTimeouts')
            );
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

    describe('inject execution context', () => {
        let browser;
        let mochaAdapter;

        beforeEach(() => {
            browser = mkBrowserStub_();
            browserAgent.getBrowser.returns(q(browser));
            browserAgent.freeBrowser.returns(q());

            mochaAdapter = mkMochaAdapter_();
        });

        it('should add execution context to browser', () => {
            const test = new MochaStub.Test();
            MochaStub.lastInstance.updateSuiteTree((suite) => suite.addTest(test));

            return mochaAdapter.run()
                .then(() => assert.includeMembers(_.keys(browser.publicAPI.executionContext), _.keys(test)));
        });

        it('should handle nested tests', () => {
            let nestedSuite = MochaStub.Suite.create();
            let nestedSuiteTest;

            MochaStub.lastInstance.updateSuiteTree((suite) => {
                suite.addSuite(nestedSuite);

                nestedSuiteTest = new MochaStub.Test();
                nestedSuite.addTest(nestedSuiteTest);
                return suite;
            });

            return mochaAdapter.run()
                .then(() => {
                    assert.includeMembers(
                        _.keys(browser.publicAPI.executionContext),
                        _.keys(nestedSuiteTest)
                    );
                });
        });

        it('should add browser id to the context', () => {
            BrowserAgent.prototype.browserId = 'some-browser';

            MochaStub.lastInstance.updateSuiteTree((suite) => suite.addTest());

            return mochaAdapter.run()
                .then(() => assert.property(browser.publicAPI.executionContext, 'browserId', 'some-browser'));
        });

        it('should add execution context to the browser prototype', () => {
            BrowserAgent.prototype.browserId = 'some-browser';

            MochaStub.lastInstance.updateSuiteTree((suite) => suite.addTest());

            return mochaAdapter.run()
                .then(() => assert.property(Object.getPrototypeOf(browser.publicAPI), 'executionContext'));
        });
    });

    describe('attachTestFilter', () => {
        it('should check if test should be run', () => {
            BrowserAgent.prototype.browserId = 'some-browser';

            const shouldRun = sandbox.stub().returns(true);
            const mochaAdapter = mkMochaAdapter_();
            mochaAdapter.attachTestFilter(shouldRun);

            const test = new MochaStub.Test();

            MochaStub.lastInstance.updateSuiteTree((suite) => suite.addTest(test));

            return mochaAdapter.run()
                .then(() => assert.calledWith(shouldRun, test, 'some-browser'));
        });

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

        it('should not filter any test if filter function is not passed', () => {
            const testSpy = sinon.spy();
            const mochaAdapter = mkMochaAdapter_();
            mochaAdapter.attachTestFilter();

            MochaStub.lastInstance.updateSuiteTree((suite) => {
                return suite
                    .addTest({title: 'some-test'})
                    .onTestBegin(testSpy);
            });

            return mochaAdapter.run()
                .then(() => {
                    assert.calledOnce(testSpy);
                    assert.calledWithMatch(testSpy.firstCall, {title: 'some-test'});
                });
        });
    });

    describe('attachTitleValidator', () => {
        it('should throw an error if tests have the same full title', () => {
            const mochaAdapter = mkMochaAdapter_();
            mochaAdapter.attachTitleValidator({});

            assert.throws(() => {
                MochaStub.lastInstance
                    .updateSuiteTree((suite) => {
                        return suite
                            .addTest({title: 'test-title', file: 'some/path/file.js'})
                            .addTest({title: 'test-title', file: 'other/path/file.js'});
                    });
            }, /with the same title: 'suite-title test-title'(.+) file: 'some\/path\/file.js'/);
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

    describe('"before" hook error handling', () => {
        let mochaAdapter;

        beforeEach(() => {
            browserAgent.getBrowser.returns(q(mkBrowserStub_()));
            browserAgent.freeBrowser.returns(q());

            mochaAdapter = mkMochaAdapter_();
        });

        it('should not launch suite original test if "before" hook failed', () => {
            const testCb = sinon.spy();

            MochaStub.lastInstance.updateSuiteTree((suite) => {
                return suite
                    .beforeAll(() => q.reject(new Error()))
                    .addTest({fn: testCb});
            });

            return mochaAdapter.run()
                .then(() => assert.notCalled(testCb));
        });

        it('should fail suite tests with "before" hook error', () => {
            const error = new Error();
            const testFailSpy = sinon.spy();

            MochaStub.lastInstance.updateSuiteTree((suite) => {
                return suite
                    .beforeAll(() => q.reject(error))
                    .addTest({title: 'some-test'})
                    .onFail(testFailSpy);
            });

            return mochaAdapter.run()
                .then(() => assert.calledWithMatch(testFailSpy, {error, test: {title: 'some-test'}}));
        });

        it('should handle sync "before hook" errors', () => {
            const testFailSpy = sinon.spy();

            MochaStub.lastInstance.updateSuiteTree((suite) => {
                return suite
                    .beforeAll(() => {
                        throw new Error();
                    })
                    .addTest({title: 'some-test'})
                    .onFail(testFailSpy);
            });

            return mochaAdapter.run()
                .then(() => assert.calledOnce(testFailSpy));
        });

        it('should not execute "before each" hook if "before" hook failed', () => {
            const beforeEachHookFn = sinon.spy();

            MochaStub.lastInstance.updateSuiteTree((suite) => {
                return suite
                    .beforeAll(() => q.reject(new Error()))
                    .beforeEach(beforeEachHookFn)
                    .addTest();
            });

            return mochaAdapter.run()
                .then(() => assert.notCalled(beforeEachHookFn));
        });

        it('should fail test with error from "before" hook if before each hook was executed successfully', () => {
            const error = new Error();
            const hookFailSpy = sinon.spy();

            MochaStub.lastInstance.updateSuiteTree((suite) => {
                return suite
                    .beforeAll(() => q.reject(error))
                    .beforeEach(() => true)
                    .addTest()
                    .onFail(hookFailSpy);
            });

            return mochaAdapter.run()
                .then(() => assert.calledWithMatch(hookFailSpy, {error}));
        });
    });

    describe('"before each" hook error handling', () => {
        let mochaAdapter;

        beforeEach(() => {
            browserAgent.getBrowser.returns(q(mkBrowserStub_()));
            browserAgent.freeBrowser.returns(q());

            mochaAdapter = mkMochaAdapter_();
        });

        it('should not execute original suite test if "before each" hook failed', () => {
            const testCb = sinon.spy();

            MochaStub.lastInstance.updateSuiteTree((suite) => {
                return suite
                    .beforeEach(() => q.reject(new Error()))
                    .addTest({fn: testCb});
            });

            return mochaAdapter.run()
                .then(() => assert.notCalled(testCb));
        });

        it('should execute original suite test if "before each" hook was executed successfully', () => {
            const testCb = sinon.spy();

            MochaStub.lastInstance.updateSuiteTree((suite) => {
                return suite
                    .beforeEach(_.noop)
                    .addTest({fn: testCb});
            });

            return mochaAdapter.run()
                .then(() => assert.called(testCb));
        });

        it('should fail test with error from "before each" hook', () => {
            const error = new Error();
            const testFailSpy = sinon.spy();

            MochaStub.lastInstance.updateSuiteTree((suite) => {
                return suite
                    .beforeEach(sandbox.stub().returns(q.reject(error)))
                    .addTest({title: 'some-test'})
                    .onFail(testFailSpy);
            });

            return mochaAdapter.run()
                .then(() => assert.calledWithMatch(testFailSpy, {error, test: {title: 'some-test'}}));
        });

        it('should handle sync "before each" hook errors', () => {
            const testFailSpy = sinon.spy();

            MochaStub.lastInstance.updateSuiteTree((suite) => {
                return suite
                    .beforeEach(() => {
                        throw new Error();
                    })
                    .addTest({title: 'some-test'})
                    .onFail(testFailSpy);
            });

            return mochaAdapter.run()
                .then(() => assert.calledOnce(testFailSpy));
        });
    });
});
