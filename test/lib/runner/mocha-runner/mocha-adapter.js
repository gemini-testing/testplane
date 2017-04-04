'use strict';

const BrowserAgent = require('../../../../lib/browser-agent');
const logger = require('../../../../lib/utils').logger;
const ProxyReporter = require('../../../../lib/runner/mocha-runner/proxy-reporter');
const SkipBuilder = require('../../../../lib/runner/mocha-runner/skip/skip-builder');
const OnlyBuilder = require('../../../../lib/runner/mocha-runner/skip/only-builder');
const Skip = require('../../../../lib/runner/mocha-runner/skip/');
const TestSkipper = require('../../../../lib/runner/test-skipper');
const RunnerEvents = require('../../../../lib/constants/runner-events');
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
    let testSkipper;

    function mkSuiteStub_(opts) {
        opts = opts || {};

        return _.extend(new EventEmitter(), {
            enableTimeouts: sandbox.stub(),
            beforeAll: sandbox.stub(),
            beforeEach: sandbox.stub(),
            afterAll: sandbox.stub(),
            tests: [{}],
            eachTest: function(fn) {
                this.tests.forEach(fn);
            },
            ctx: {},
            title: opts.title || 'suite-title',
            fullTitle: () => opts.fullTitle || ''
        });
    }

    function mkRunnableStub_(opts) {
        opts = _.defaults(opts || {}, {
            title: 'default-title',
            parent: MochaStub.prototype.suite,
            fn: _.noop
        });

        return _.defaults(opts, {
            fullTitle: () => `${opts.parent.title} ${opts.title}`
        });
    }

    const mkMochaAdapter_ = (opts, ctx) => {
        return MochaAdapter.create(opts || {}, browserAgent, ctx);
    };

    const mkBrowserStub_ = () => {
        return {publicAPI: Object.create({})};
    };

    beforeEach(() => {
        testSkipper = sinon.createStubInstance(TestSkipper);

        clearRequire = sandbox.stub().named('clear-require');
        browserAgent = sinon.createStubInstance(BrowserAgent);

        sandbox.stub(MochaStub.prototype);
        MochaStub.prototype.run = (cb) => process.nextTick(cb);
        MochaStub.prototype.suite = mkSuiteStub_();

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

            assert.calledWith(MochaStub.prototype.__constructor, {grep: 'foo'});
        });

        it('should enable full stacktrace in mocha', () => {
            mkMochaAdapter_();

            assert.called(MochaStub.prototype.fullTrace);
        });
    });

    describe('addFiles', () => {
        it('should add files', () => {
            const mochaAdapter = mkMochaAdapter_();

            mochaAdapter.addFiles(['path/to/file']);

            assert.calledOnce(MochaStub.prototype.addFile);
            assert.calledWith(MochaStub.prototype.addFile, 'path/to/file');
        });

        it('should clear require cache for file before adding', () => {
            const mochaAdapter = mkMochaAdapter_();

            mochaAdapter.addFiles(['path/to/file']);

            assert.calledWithMatch(clearRequire, 'path/to/file');
            assert.callOrder(clearRequire, MochaStub.prototype.addFile);
        });

        it('should load files after add', () => {
            const mochaAdapter = mkMochaAdapter_();

            mochaAdapter.addFiles(['path/to/file']);

            assert.calledOnce(MochaStub.prototype.loadFiles);
            assert.callOrder(MochaStub.prototype.addFile, MochaStub.prototype.loadFiles);
        });

        it('should flush files after load', () => {
            const mocha = new MochaStub();
            mocha.files = ['some/file'];
            MochaStub.prototype.__constructor.returns(mocha);

            const mochaAdapter = mkMochaAdapter_();

            mochaAdapter.addFiles(['path/to/file']);

            assert.deepEqual(mocha.files, []);
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
        beforeEach(() => browserAgent.getBrowser.returns(q(mkBrowserStub_())));

        it('should request browser before suite execution', () => {
            MochaStub.prototype.suite.beforeAll.yields();

            mkMochaAdapter_();

            assert.calledOnce(browserAgent.getBrowser);
        });

        it('should not request browsers for suite with one skipped test', () => {
            MochaStub.prototype.suite = _.extend(mkSuiteStub_(), {
                suites: [
                    {
                        tests: [
                            {pending: true}
                        ]
                    }
                ],
                tests: []
            });
            MochaStub.prototype.suite.beforeAll.yields();

            mkMochaAdapter_();

            assert.notCalled(browserAgent.getBrowser);
        });

        it('should request browsers for suite with at least one non-skipped test', () => {
            MochaStub.prototype.suite = _.extend(mkSuiteStub_(), {
                suites: [
                    {
                        tests: [
                            {'pending': false},
                            {'pending': true}
                        ]
                    }
                ]
            });
            MochaStub.prototype.suite.beforeAll.yields();

            mkMochaAdapter_();

            assert.calledOnce(browserAgent.getBrowser);
        });

        it('should not request browsers for suite with nested skipped tests', () => {
            const suiteStub = mkSuiteStub_();

            MochaStub.prototype.suite = _.extend(suiteStub, {
                suites: [
                    {
                        suites: [
                            {
                                tests: [
                                    {'pending': true},
                                    {'pending': true}
                                ]
                            }
                        ]
                    }
                ],
                tests: []
            });
            MochaStub.prototype.suite.beforeAll.yields();

            mkMochaAdapter_();

            assert.notCalled(browserAgent.getBrowser);
        });

        it('should release browser after suite execution', () => {
            const browser = mkBrowserStub_();
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
            const browser = mkBrowserStub_();

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
            const test = mkRunnableStub_();
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

    describe('applySkip', () => {
        it('should skip suite using test skipper', () => {
            const mochaAdapter = mkMochaAdapter_();
            browserAgent.browserId = 'some-browser';

            mochaAdapter.applySkip(testSkipper);

            assert.calledWith(testSkipper.applySkip, MochaStub.prototype.suite, 'some-browser');
        });

        it('should be chainable', () => {
            const mochaAdapter = mkMochaAdapter_();
            const mochaInstance = mochaAdapter.applySkip(testSkipper);

            assert.instanceOf(mochaInstance, MochaAdapter);
        });
    });

    describe('inject execution context', () => {
        const startBrowser_ = () => {
            const browser = mkBrowserStub_();
            browserAgent.getBrowser.returns(q(browser));

            const beforeAll = MochaStub.prototype.suite.beforeAll.firstCall.args[0];
            return beforeAll()
                .thenResolve(browser.publicAPI);
        };

        it('should add execution context to browser', () => {
            const mochaAdapter = mkMochaAdapter_();

            const scenario = {
                'beforeAll': mkRunnableStub_({title: 'before hook'}),
                'beforeEach': mkRunnableStub_({title: 'before each hook'}),
                'test': mkRunnableStub_({title: 'some test'}),
                'afterEach': mkRunnableStub_({title: 'after each hook'}),
                'afterAll': mkRunnableStub_({title: 'after hook'})
            };

            _.forEach(scenario, (runnable, event) => mochaAdapter.suite.emit(event, runnable));

            return startBrowser_()
                .then((browser) => {
                    _.forEach(scenario, (runnable) => {
                        runnable.fn();
                        assert.includeMembers(
                            _.keys(browser.executionContext),
                            _.keys(runnable)
                        );
                    });
                });
        });

        it('should handle nested tests', () => {
            const mochaAdapter = mkMochaAdapter_();

            const nestedSuite = mkSuiteStub_();
            const test = mkRunnableStub_({title: 'nested test'});

            mochaAdapter.suite.emit('suite', nestedSuite);
            nestedSuite.emit('test', test);

            return startBrowser_()
                .then((browser) => {
                    test.fn();
                    assert.includeMembers(
                        _.keys(browser.executionContext),
                        _.keys(test)
                    );
                });
        });

        it('should add browser id to the context', () => {
            const mochaAdapter = mkMochaAdapter_();

            const test = mkRunnableStub_();
            mochaAdapter.suite.emit('test', test);

            BrowserAgent.prototype.browserId = 'some-browser';

            return startBrowser_()
                .then((browser) => {
                    test.fn();
                    assert.property(browser.executionContext, 'browserId', 'some-browser');
                });
        });

        it('should add execution context to the browser prototype', () => {
            const mochaAdapter = mkMochaAdapter_();

            const test = mkRunnableStub_();
            mochaAdapter.suite.emit('test', test);

            return startBrowser_()
                .then((browser) => {
                    assert.property(Object.getPrototypeOf(browser), 'executionContext');
                });
        });
    });

    describe('attachTestFilter', () => {
        let mochaAdapter;

        beforeEach(() => mochaAdapter = mkMochaAdapter_());

        it('should check if test should be run', () => {
            const someTest = mkRunnableStub_();
            const shouldRun = sandbox.stub().returns(true);

            MochaStub.prototype.suite.tests = [someTest];
            BrowserAgent.prototype.browserId = 'some-browser';

            mochaAdapter.attachTestFilter(shouldRun);

            MochaStub.prototype.suite.emit('test', someTest);
            assert.calledWith(shouldRun, someTest, 'some-browser');
        });

        it('should not remove test which expected to be run', () => {
            const test1 = mkRunnableStub_();
            const test2 = mkRunnableStub_();
            const shouldRun = () => true;

            MochaStub.prototype.suite.tests = [test1, test2];

            mochaAdapter.attachTestFilter(shouldRun);

            MochaStub.prototype.suite.emit('test', test2);
            assert.deepEqual(MochaStub.prototype.suite.tests, [test1, test2]);
        });

        it('should remove test which does not suppose to be run', () => {
            const test1 = mkRunnableStub_();
            const test2 = mkRunnableStub_();
            const shouldRun = () => false;

            MochaStub.prototype.suite.tests = [test1, test2];

            mochaAdapter.attachTestFilter(shouldRun);

            MochaStub.prototype.suite.emit('test', test2);
            assert.deepEqual(MochaStub.prototype.suite.tests, [test1]);
        });

        it('should not filter any test if filter function is not passed', () => {
            const someTest = mkRunnableStub_();

            MochaStub.prototype.suite.tests = [someTest];
            mochaAdapter.attachTestFilter();
            MochaStub.prototype.suite.emit('test', someTest);

            assert.deepEqual(MochaStub.prototype.suite.tests, [someTest]);
        });
    });

    describe('attachTitleValidator', () => {
        let mochaAdapter;

        beforeEach(() => mochaAdapter = mkMochaAdapter_());

        it('should throw an error if tests have the same full title', () => {
            const parentSuite = mkSuiteStub_();
            const test1 = mkRunnableStub_({file: 'some/path/file.js', title: 'test-title', parent: parentSuite});
            const test2 = mkRunnableStub_({file: 'other/path/file.js', title: 'test-title', parent: parentSuite});

            mochaAdapter.attachTitleValidator({});

            MochaStub.prototype.suite.emit('test', test1);

            assert.throws(
                () => MochaStub.prototype.suite.emit('test', test2),
                /with the same title: 'suite-title test-title'(.+) file: 'some\/path\/file.js'/
            );
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
            new Reporter(); // eslint-disable-line no-new
        }

        it('should set mocha reporter as proxy reporter in order to proxy events to emit fn', () => {
            attachEmitFn_(sinon.spy());

            assert.calledOnce(ProxyReporter.prototype.__constructor);
        });

        it('should pass to proxy reporter emit fn', () => {
            const emitFn = sinon.spy().named('emit');

            attachEmitFn_(emitFn);

            const emit_ = ProxyReporter.prototype.__constructor.firstCall.args[0];
            emit_('some-event', {some: 'data'});

            assert.calledOnce(emitFn);
            assert.calledWith(emitFn, 'some-event', sinon.match({some: 'data'}));
        });

        it('should pass to proxy reporter getter for requested browser', () => {
            const browser = mkBrowserStub_();

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

        describe('if event handler throws', () => {
            const initBadHandler_ = (event, handler) => {
                const emitter = new EventEmitter();
                emitter.on(event, handler);

                attachEmitFn_(emitter.emit.bind(emitter));
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
                    const emit = sinon.spy();
                    browserAgent.browserId = 'bro';

                    mochaAdapter.attachEmitFn(emit);

                    MochaStub.prototype.suite.emit(mochaEvent, {}, '/some/file.js');

                    assert.calledOnce(emit);
                    assert.calledWith(emit, RunnerEvents[hermioneEvent], {
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
        function mkBeforeAllHookBreaker_(hookFn) {
            const originalTest = sinon.spy();
            const suite = mkSuiteStub_();
            const test = mkRunnableStub_({parent: suite, fn: originalTest});
            const hook = mkRunnableStub_({parent: suite, fn: hookFn});

            suite.tests = [test];
            suite.beforeAll = [hook];

            MochaStub.prototype.suite.emit('beforeAll', hook);
            MochaStub.prototype.suite.emit('test', test);

            return {suite, originalTest};
        }

        beforeEach(() => mkMochaAdapter_());

        it('should not launch suite original test if "before" hook failed', () => {
            const hookBreaker = mkBeforeAllHookBreaker_(() => {
                throw new Error('some-error');
            });

            return hookBreaker.suite.beforeAll[0].fn()
                .then(() => hookBreaker.suite.tests[0].fn())
                .catch(() => assert.notCalled(hookBreaker.originalTest));
        });

        it('should fail suite tests with error thrown from "before" hook', () => {
            const hookBreaker = mkBeforeAllHookBreaker_(() => {
                throw new Error('some-error');
            });

            return hookBreaker.suite.beforeAll[0].fn()
                .then(() => hookBreaker.suite.tests[0].fn())
                .catch((error) => assert.equal(error.message, 'some-error'));
        });

        it('should handle async "before hook" errors', () => {
            const hookBreaker = mkBeforeAllHookBreaker_(() => q.reject(new Error('some-async-error')));

            return hookBreaker.suite.beforeAll[0].fn()
                .then(() => hookBreaker.suite.tests[0].fn())
                .catch((error) => assert.equal(error.message, 'some-async-error'));
        });

        it('should not execute original "before each" hook functionality if "before" hook failed', () => {
            const hookBreaker = mkBeforeAllHookBreaker_(() => {
                throw new Error('some-error');
            });

            const hookSpy = sinon.spy();
            const beforeEachHook = mkRunnableStub_({parent: hookBreaker.suite, fn: hookSpy});

            hookBreaker.suite.beforeEach = [beforeEachHook];
            MochaStub.prototype.suite.emit('beforeEach', beforeEachHook);

            return hookBreaker.suite.beforeAll[0].fn()
                .then(() => hookBreaker.suite.beforeEach[0].fn())
                .catch(() => assert.notCalled(hookSpy));
        });

        it('should fail "before each" hook with error from before hook', () => {
            const hookBreaker = mkBeforeAllHookBreaker_(() => {
                throw new Error('some-before-hook-error');
            });

            const hookSpy = sinon.spy();
            const beforeEachHook = mkRunnableStub_({parent: hookBreaker.suite, fn: hookSpy});

            hookBreaker.suite.beforeEach = [beforeEachHook];
            MochaStub.prototype.suite.emit('beforeEach', beforeEachHook);

            return hookBreaker.suite.beforeAll[0].fn()
                .then(() => hookBreaker.suite.beforeEach[0].fn())
                .catch((error) => assert.equal(error.message, 'some-before-hook-error'));
        });
    });

    describe('"before each" hook error handling', () => {
        function mkBeforeEachHookBreaker_(hookFn) {
            const originalTest = sinon.spy();
            const suite = mkSuiteStub_();
            const test = mkRunnableStub_({parent: suite, fn: originalTest});
            const hook = mkRunnableStub_({
                parent: suite,
                fn: hookFn,
                ctx: {currentTest: test}
            });

            suite.tests = [test];
            suite.beforeEach = [hook];

            MochaStub.prototype.suite.emit('beforeEach', hook);
            MochaStub.prototype.suite.emit('test', test);

            return {suite, originalTest};
        }

        beforeEach(() => mkMochaAdapter_());

        it('should not execute original suite test if "before each" hook failed', () => {
            const hookBreaker = mkBeforeEachHookBreaker_(() => {
                throw new Error('some-error');
            });

            return hookBreaker.suite.beforeEach[0].fn()
                .then(() => hookBreaker.suite.tests[0].fn())
                .catch(() => assert.notCalled(hookBreaker.originalTest));
        });

        it('should execute original suite test if "before each hook was executed successfully"', () => {
            const hookBreaker = mkBeforeEachHookBreaker_(_.noop);

            return hookBreaker.suite.beforeEach[0].fn()
                .then(() => hookBreaker.suite.tests[0].fn())
                .catch(() => assert.called(hookBreaker.originalTest));
        });

        it('should fail test with error from "before each" hook', () => {
            const hookBreaker = mkBeforeEachHookBreaker_(() => {
                throw new Error('some-error');
            });

            return hookBreaker.suite.beforeEach[0].fn()
                .then(() => hookBreaker.suite.tests[0].fn())
                .catch((error) => assert.equal(error.message, 'some-error'));
        });

        it('should handle async "before each" hook errors', () => {
            const hookBreaker = mkBeforeEachHookBreaker_(() => q.reject(new Error('some-async-error')));

            return hookBreaker.suite.beforeEach[0].fn()
                .then(() => hookBreaker.suite.tests[0].fn())
                .catch((error) => assert.equal(error.message, 'some-async-error'));
        });

        it('should run another tests in suite after "before each" hook failed', () => {
            const testFn1 = sinon.spy();
            const testFn2 = sinon.spy();

            const suite = mkSuiteStub_();

            const beforeEachHookStub = sandbox.stub()
                .onFirstCall().throws(new Error('some-error'))
                .onSecondCall().returns(true);

            suite.tests = [
                mkRunnableStub_({parent: suite, fn: testFn1}),
                mkRunnableStub_({parent: suite, fn: testFn2})
            ];

            suite.beforeEach = [
                mkRunnableStub_({parent: suite, fn: beforeEachHookStub, ctx: {currentTest: suite.tests[0]}}),
                mkRunnableStub_({parent: suite, fn: beforeEachHookStub, ctx: {currentTest: suite.tests[1]}})
            ];

            MochaStub.prototype.suite.emit('beforeEach', suite.beforeEach[0]);
            MochaStub.prototype.suite.emit('beforeEach', suite.beforeEach[1]);
            MochaStub.prototype.suite.emit('test', suite.tests[0]);
            MochaStub.prototype.suite.emit('test', suite.tests[1]);

            return suite.beforeEach[0].fn()
                .then(() => suite.tests[0].fn())
                .catch(() => suite.beforeEach[0].fn())
                .then(() => suite.tests[1].fn())
                .then(() => {
                    assert.notCalled(testFn1);
                    assert.called(testFn2);
                });
        });
    });
});
