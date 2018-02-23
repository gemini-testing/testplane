'use strict';

const _ = require('lodash');
const path = require('path');
const q = require('q');
const proxyquire = require('proxyquire');
const {BrowserAgent} = require('gemini-core');
const RunnerEvents = require('lib/constants/runner-events');
const Skip = require('lib/runner/mocha-runner/skip/');
const MochaStub = require('../../_mocha');
const crypto = require('lib/utils/crypto');

describe('worker/mocha-adapter', () => {
    const sandbox = sinon.sandbox.create();

    let MochaAdapter;
    let browserAgent;
    let clearRequire;
    let proxyReporter;

    const mkBrowserStub_ = (opts) => {
        return _.defaults(opts || {}, {
            publicAPI: Object.create({}),
            updateChanges: sinon.stub()
        });
    };

    const mkMochaAdapter_ = (config) => {
        return MochaAdapter.create(browserAgent, _.extend({patternsOnReject: []}, config));
    };

    beforeEach(() => {
        browserAgent = sinon.createStubInstance(BrowserAgent);
        browserAgent.getBrowser.returns(q(mkBrowserStub_()));

        clearRequire = sandbox.stub().named('clear-require');
        proxyReporter = sandbox.stub().named('proxy-reporter');

        sandbox.stub(crypto, 'getShortMD5');

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
            action = sinon.stub();
            const test = new MochaStub.Test(null, {title: 'test', fn: q.delay(duration).then(action)});
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

        it('should abort test if timeout is smaller then test duration', () => {
            addTest({duration: 20, timeout: 10});

            return mochaAdapter.runInSession('1234').then(() => {
                assert.notCalled(action);
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

    describe('inject contexts', () => {
        it('should extend test with hermione context', () => {
            const mochaAdapter = mkMochaAdapter_();
            const test = new MochaStub.Test();
            MochaStub.lastInstance.updateSuiteTree((suite) => suite.addTest(test));

            return mochaAdapter.runInSession()
                .then((data) => assert.property(data, 'hermioneCtx'));
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

            return mochaAdapter.runInSession('1234')
                .then(() => {
                    const getBrowser = proxyReporter.lastCall.args[1];
                    assert.equal(browser, getBrowser());
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

                const promise = mochaAdapter.runInSession('1234');

                const originalRun = MochaStub.lastInstance.run.bind(MochaStub.lastInstance);
                sandbox.stub(MochaStub.lastInstance, 'run').callsFake((cb) => {
                    try {
                        emit_('foo');
                    } catch (e) {
                        // eslint иди лесом
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

        it('should call filter for each test', () => {
            const buttonTest1 = new MochaStub.Test(null, {title: 'button-accept'});
            const buttonTest2 = new MochaStub.Test(null, {title: 'button-decline'});

            mochaAdapter.suite
                .addTest(buttonTest1)
                .addTest(buttonTest2);

            assert.calledWith(filter.getCall(0), buttonTest1);
            assert.calledWith(filter.getCall(1), buttonTest2);
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
                    .addTest({fn: () => mochaAdapter.emit(RunnerEvents.TEST_FAIL, {err: new Error('test fail')})});
            });

            return assert.isRejected(mochaAdapter.runInSession(), /test fail/);
        });

        it('should return hook error on afterEach hook fail', () => {
            const mochaAdapter = mkMochaAdapter_();
            MochaStub.lastInstance.updateSuiteTree((suite) => {
                return suite
                    .addTest()
                    .afterEach(() => mochaAdapter.emit(RunnerEvents.ERROR, new Error('hook fail')));
            });

            return assert.isRejected(mochaAdapter.runInSession(), /hook fail/);
        });

        it('should return test error if both test and afterEach hook failed', () => {
            const mochaAdapter = mkMochaAdapter_();
            MochaStub.lastInstance.updateSuiteTree((suite) => {
                return suite
                    .addTest({fn: () => mochaAdapter.emit(RunnerEvents.TEST_FAIL, {err: new Error('test fail')})})
                    .afterEach(() => mochaAdapter.emit(RunnerEvents.ERROR, new Error('hook fail')));
            });

            return assert.isRejected(mochaAdapter.runInSession(), /test fail/);
        });
    });
});
