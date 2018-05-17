'use strict';

const _ = require('lodash');
const path = require('path');
const q = require('q');
const proxyquire = require('proxyquire');
const {BrowserAgent} = require('gemini-core');
const RunnerEvents = require('lib/constants/runner-events');
const Browser = require('lib/browser/existing-browser');
const logger = require('lib/utils/logger');
const Skip = require('lib/runner/mocha-runner/skip/');
const MochaStub = require('../../_mocha');
const crypto = require('lib/utils/crypto');

describe('worker/mocha-adapter', () => {
    const sandbox = sinon.sandbox.create();

    let MochaAdapter;
    let browserAgent;
    let clearRequire;
    let proxyReporter;

    const mkBrowserStub_ = () => {
        const browser = sinon.createStubInstance(Browser);
        const wdio = {
            screenshot: sinon.stub().named('screenshot').resolves({})
        };

        Object.defineProperty(browser, 'publicAPI', {get: () => wdio});
        browser.updateChanges = sinon.stub();

        return browser;
    };

    const mkMochaAdapter_ = (config) => {
        config = _.defaults(config, {
            patternsOnReject: [],
            screenshotOnReject: true
        });
        const mochaAdapter = MochaAdapter.create(browserAgent, config);

        MochaStub.lastInstance.updateSuiteTree((suite) => {
            return suite
                .onFail(({error, test}) => {
                    if (test) {
                        mochaAdapter.emit(RunnerEvents.TEST_FAIL, {err: error});
                    } else {
                        mochaAdapter.emit(RunnerEvents.ERROR, error);
                    }
                });
        });

        return mochaAdapter;
    };

    beforeEach(() => {
        browserAgent = sinon.createStubInstance(BrowserAgent);
        browserAgent.getBrowser.resolves(mkBrowserStub_());

        clearRequire = sandbox.stub().named('clear-require');
        proxyReporter = sandbox.stub().named('proxy-reporter');

        sandbox.stub(crypto, 'getShortMD5');
        sandbox.stub(logger);

        MochaAdapter = proxyquire(require.resolve('lib/worker/runner/mocha-adapter'), {
            'mocha': MochaStub,
            'clear-require': clearRequire,
            '../../runner/mocha-runner/proxy-reporter': proxyReporter
        });
    });

    afterEach(() => sandbox.restore());

    describe('timeouts', () => {
        let mochaAdapter;
        let action;

        const addTest = ({duration, timeout}) => {
            mochaAdapter = mkMochaAdapter_();
            action = sinon.stub().named('action');
            const test = new MochaStub.Test(null, {title: 'test', fn: () => q.delay(duration).then(action)});
            if (timeout) {
                test.timeout(timeout);
            }

            mochaAdapter.suite.addTest(test);
        };

        it('should complete test if no timeout', () => {
            addTest({duration: 10});

            return mochaAdapter.runInSession('1234').then(() => {
                assert.calledOnce(action);
            });
        });

        it('should complete test if timeout is bigger then test duration', () => {
            addTest({duration: 10, timeout: 20});

            return mochaAdapter.runInSession('1234').then(() => {
                assert.calledOnce(action);
            });
        });

        it('should abort test on timeout', () => {
            addTest({duration: 20, timeout: 10});

            const promise = mochaAdapter.runInSession('1234')
                .finally(() => assert.notCalled(action));

            return assert.isRejected(promise, /operation timed out/);
        });
    });

    describe('extend test API', () => {
        it('should add "id" method for test', () => {
            const mochaAdapter = mkMochaAdapter_();
            const test = new MochaStub.Test();
            mochaAdapter.suite.addTest(test);

            assert.isFunction(test.id);
        });

        it('should generate unique id for test', () => {
            crypto.getShortMD5.withArgs('suite test').returns('12345');

            const mochaAdapter = mkMochaAdapter_();
            const test = new MochaStub.Test(null, {title: 'test'});
            mochaAdapter.suite.title = 'suite';
            mochaAdapter.suite.addTest(test);

            assert.equal(test.id(), '12345');
        });
    });

    describe('inject skip', () => {
        let mochaAdapter;

        beforeEach(() => {
            browserAgent.freeBrowser.resolves();
            sandbox.stub(Skip.prototype, 'handleEntity');

            mochaAdapter = mkMochaAdapter_();
        });

        it('should apply skip to test', () => {
            const test = new MochaStub.Test();

            mochaAdapter.suite.addTest(test);

            return mochaAdapter.runInSession('1234')
                .then(() => {
                    assert.called(Skip.prototype.handleEntity);
                    assert.calledWith(Skip.prototype.handleEntity, test);
                });
        });

        it('should apply skip to suite', () => {
            const nestedSuite = MochaStub.Suite.create();

            mochaAdapter.suite.addSuite(nestedSuite);

            return mochaAdapter.runInSession('1234')
                .then(() => {
                    assert.called(Skip.prototype.handleEntity);
                    assert.calledWith(Skip.prototype.handleEntity, nestedSuite);
                });
        });
    });

    describe('inject contexts', () => {
        it('should extend test with hermione context before run', async () => {
            mkMochaAdapter_();
            const test = new MochaStub.Test();
            MochaStub.lastInstance.updateSuiteTree((suite) => suite.addTest(test));

            assert.property(test, 'hermioneCtx');
        });
    });

    describe('passthrough mocha events', () => {
        let mochaAdapter;

        beforeEach(() => {
            mochaAdapter = mkMochaAdapter_();
            sandbox.spy(mochaAdapter, 'emit').named('emit');
        });

        const passthroughMochaEvents_ = () => {
            const Reporter = MochaStub.lastInstance.reporter.lastCall.args[0];
            new Reporter(); // eslint-disable-line no-new
        };

        it('should set mocha reporter as proxy reporter in order to proxy events to emit function', () => {
            passthroughMochaEvents_();

            assert.calledOnce(proxyReporter);
            assert.calledWithNew(proxyReporter);
        });

        it('should pass emit function', () => {
            passthroughMochaEvents_();

            const emit_ = proxyReporter.firstCall.args[0];
            emit_('some-event', {some: 'data'});

            assert.calledOnceWith(mochaAdapter.emit, 'some-event', sinon.match({some: 'data'}));
        });

        it('should pass getter for requested browser', () => {
            const browser = mkBrowserStub_();
            browserAgent.getBrowser.resolves(browser);
            passthroughMochaEvents_();

            MochaStub.lastInstance.updateSuiteTree((suite) => suite.addTest());

            return mochaAdapter.runInSession('1234')
                .then(() => {
                    const getBrowser = proxyReporter.lastCall.args[1];
                    assert.equal(browser, getBrowser());
                });
        });

        it('should pass getter for browser id if browser not requested', () => {
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

                const promise = mochaAdapter.runInSession('1234');

                const originalRun = MochaStub.lastInstance.run.bind(MochaStub.lastInstance);
                sandbox.stub(MochaStub.lastInstance, 'run').callsFake((cb) => {
                    try {
                        emit_('foo');
                    } catch (e) {
                        // eslint-disable-line
                    }
                    originalRun(cb);
                });

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

    describe('attachTestFilter', () => {
        let mochaAdapter;
        let filter;

        beforeEach(() => {
            mochaAdapter = mkMochaAdapter_();
            filter = sinon.spy((test) => test.title.startsWith('button'));
            mochaAdapter.attachTestFilter(filter);
        });

        it('should filter tests', () => {
            const buttonTest1 = new MochaStub.Test(null, {title: 'button-accept'});
            const buttonTest2 = new MochaStub.Test(null, {title: 'button-decline'});
            const labelTest = new MochaStub.Test(null, {title: 'label'});

            mochaAdapter.suite
                .addTest(buttonTest1)
                .addTest(labelTest)
                .addTest(buttonTest2);

            assert.deepEqual(mochaAdapter.tests, [buttonTest1, buttonTest2]);
            assert.deepEqual(mochaAdapter.suite.tests, [buttonTest1, buttonTest2]);
        });

        it('should filter tests from child suites', () => {
            const buttonTest1 = new MochaStub.Test(null, {title: 'button-accept'});
            const buttonTest2 = new MochaStub.Test(null, {title: 'button-decline'});
            const labelTest1 = new MochaStub.Test(null, {title: 'label-small'});
            const labelTest2 = new MochaStub.Test(null, {title: 'label-large'});

            const suite1 = new MochaStub.Suite(null, 'child-suite-1');
            const suite2 = new MochaStub.Suite(null, 'child-suite-2');
            mochaAdapter.suite
                .addSuite(suite1)
                .addSuite(suite2);
            suite1
                .addTest(buttonTest1)
                .addTest(labelTest1);
            suite2
                .addTest(labelTest2)
                .addTest(buttonTest2);

            assert.deepEqual(mochaAdapter.tests, [buttonTest1, buttonTest2]);
            assert.deepEqual(suite1.tests, [buttonTest1]);
            assert.deepEqual(suite2.tests, [buttonTest2]);
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

    describe('runInSession', () => {
        it('should return test error on test fail', () => {
            const mochaAdapter = mkMochaAdapter_();
            MochaStub.lastInstance.updateSuiteTree((suite) => {
                return suite
                    .addTest(() => Promise.reject(new Error('test fail')));
            });

            return assert.isRejected(mochaAdapter.runInSession(), /test fail/);
        });

        it('should return hook error on afterEach hook fail', () => {
            const mochaAdapter = mkMochaAdapter_();
            MochaStub.lastInstance.updateSuiteTree((suite) => {
                return suite
                    .addTest()
                    .afterEach(() => Promise.reject(new Error('hook fail')));
            });

            return assert.isRejected(mochaAdapter.runInSession(), /hook fail/);
        });

        it('should return test error if both test and afterEach hook failed', () => {
            const mochaAdapter = mkMochaAdapter_();
            MochaStub.lastInstance.updateSuiteTree((suite) => {
                return suite
                    .addTest(() => Promise.reject(new Error('test fail')))
                    .afterEach(() => Promise.reject(new Error('hook fail')));
            });

            return assert.isRejected(mochaAdapter.runInSession(), /test fail/);
        });

        it('should return assert view results from hermione ctx', () => {
            const mochaAdapter = mkMochaAdapter_();
            const test = new MochaStub.Test();

            mochaAdapter.suite.addTest(test);
            test.hermioneCtx.assertViewResults = {toRawObject: sandbox.stub().returns(['foo', 'bar'])};

            return mochaAdapter.runInSession()
                .then((res) => assert.deepEqual(res.hermioneCtx.assertViewResults, ['foo', 'bar']));
        });
    });

    describe('screenshotOnReject', () => {
        let browser;

        beforeEach(() => {
            browser = mkBrowserStub_();
            browserAgent.getBrowser.resolves(browser);
        });

        it('should attach screenshot to error on test fail', async () => {
            const mochaAdapter = mkMochaAdapter_();
            MochaStub.lastInstance.updateSuiteTree((suite) => {
                return suite
                    .addTest(() => Promise.reject(new Error('o.O')));
            });

            browser.publicAPI.screenshot.resolves({value: 'base64img'});

            const err = await assert.isRejected(mochaAdapter.runInSession());

            assert.propertyVal(err, 'screenshot', 'base64img');
        });

        it('should not attach screenshot if screenshotOnReject is false', async () => {
            const mochaAdapter = mkMochaAdapter_({screenshotOnReject: false});
            MochaStub.lastInstance.updateSuiteTree((suite) => {
                return suite
                    .addTest(() => Promise.reject(new Error('o.O')));
            });

            const err = await assert.isRejected(mochaAdapter.runInSession());

            assert.notCalled(browser.publicAPI.screenshot);
            assert.notProperty(err, 'screenshot');
        });

        it('should attach screenshot to error on beforeEach hook fail', async () => {
            const mochaAdapter = mkMochaAdapter_();
            MochaStub.lastInstance.updateSuiteTree((suite) => {
                return suite
                    .beforeEach(() => Promise.reject(new Error('o.O')))
                    .addTest();
            });

            browser.publicAPI.screenshot.resolves({value: 'base64img'});

            const err = await assert.isRejected(mochaAdapter.runInSession());

            assert.propertyVal(err, 'screenshot', 'base64img');
        });

        it('should attach screenshot to error on afterEach hook fail', async () => {
            const mochaAdapter = mkMochaAdapter_();
            MochaStub.lastInstance.updateSuiteTree((suite) => {
                return suite
                    .addTest()
                    .afterEach(() => Promise.reject(new Error('o.O')));
            });

            browser.publicAPI.screenshot.resolves({value: 'base64img'});

            const err = await assert.isRejected(mochaAdapter.runInSession());

            assert.propertyVal(err, 'screenshot', 'base64img');
        });

        it('should not take screenshot on afterEach hook fail if beforeEach hook failed', async () => {
            const mochaAdapter = mkMochaAdapter_();
            MochaStub.lastInstance.updateSuiteTree((suite) => {
                return suite
                    .beforeEach(() => Promise.reject(new Error('beforeEach fail')))
                    .addTest()
                    .afterEach(() => Promise.reject(new Error('afterEach fail')));
            });

            await assert.isRejected(mochaAdapter.runInSession());

            assert.calledOnce(browser.publicAPI.screenshot);
        });

        it('should not take screenshot on afterEach hook fail if test failed', async () => {
            const mochaAdapter = mkMochaAdapter_();
            MochaStub.lastInstance.updateSuiteTree((suite) => {
                return suite
                    .addTest(() => Promise.reject(new Error('test fail')))
                    .afterEach(() => Promise.reject(new Error('afterEach fail')));
            });

            await assert.isRejected(mochaAdapter.runInSession());

            assert.calledOnce(browser.publicAPI.screenshot);
        });

        it('should not attach screenshot if error already has one', async () => {
            const screenshot = 'screenshotFromGrid';
            const mochaAdapter = mkMochaAdapter_();
            MochaStub.lastInstance.updateSuiteTree((suite) => {
                return suite
                    .addTest(() => Promise.reject(Object.assign(new Error('o.O'), {screenshot})));
            });

            const err = await assert.isRejected(mochaAdapter.runInSession());

            assert.notCalled(browser.publicAPI.screenshot);
            assert.propertyVal(err, 'screenshot', screenshot);
        });

        it('should ignore screenshot call fail', async () => {
            const mochaAdapter = mkMochaAdapter_();
            MochaStub.lastInstance.updateSuiteTree((suite) => {
                return suite
                    .addTest(() => Promise.reject(new Error('test fail')));
            });

            browser.publicAPI.screenshot.rejects(new Error('screenshot fail'));

            const err = await assert.isRejected(mochaAdapter.runInSession());

            assert.propertyVal(err, 'message', 'test fail');
            assert.notProperty(err, 'screenshot');
        });

        it('should set timeout if screenshotOnRejectTimeout option is set', async () => {
            const mochaAdapter = mkMochaAdapter_({screenshotOnRejectTimeout: 100500});
            MochaStub.lastInstance.updateSuiteTree((suite) => {
                return suite
                    .addTest(() => Promise.reject(new Error('o.O')));
            });

            await assert.isRejected(mochaAdapter.runInSession());

            assert.calledOnceWith(browser.setHttpTimeout, 100500);
            assert.callOrder(browser.setHttpTimeout, browser.publicAPI.screenshot);
        });

        it('should restore httpTimeout', async () => {
            const mochaAdapter = mkMochaAdapter_({screenshotOnRejectTimeout: 100500});
            MochaStub.lastInstance.updateSuiteTree((suite) => {
                return suite
                    .addTest(() => Promise.reject(new Error('o.O')));
            });

            await assert.isRejected(mochaAdapter.runInSession());

            assert.calledOnce(browser.restoreHttpTimeout);
            assert.callOrder(browser.publicAPI.screenshot, browser.restoreHttpTimeout);
        });

        it('should restore httpTimeout even if screenshot call failed', async () => {
            const mochaAdapter = mkMochaAdapter_({screenshotOnRejectTimeout: 100500});
            MochaStub.lastInstance.updateSuiteTree((suite) => {
                return suite
                    .addTest(() => Promise.reject(new Error('o.O')));
            });

            browser.publicAPI.screenshot.rejects(new Error('screenshot fail'));

            await assert.isRejected(mochaAdapter.runInSession());

            assert.calledOnce(browser.restoreHttpTimeout);
        });
    });
});
