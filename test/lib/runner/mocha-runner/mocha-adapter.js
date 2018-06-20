'use strict';

const path = require('path');
const _ = require('lodash');
const proxyquire = require('proxyquire').noCallThru();
const crypto = require('lib/utils/crypto');
const SkipBuilder = require('lib/runner/mocha-runner/skip/skip-builder');
const OnlyBuilder = require('lib/runner/mocha-runner/skip/only-builder');
const Skip = require('lib/runner/mocha-runner/skip/');
const TestSkipper = require('lib/runner/test-skipper');
const RunnerEvents = require('lib/constants/runner-events');
const SuiteSubset = require('lib/runner/mocha-runner/suite-subset');
const MochaStub = require('../../_mocha');

describe('mocha-runner/mocha-adapter', () => {
    const sandbox = sinon.sandbox.create();

    let MochaAdapter;
    let clearRequire;
    let testSkipper;

    const mkMochaAdapter_ = (opts = {}) => {
        const browserId = opts.browserId || 'default-bro';
        const config = opts.config || {};

        return MochaAdapter.create(browserId, config);
    };

    beforeEach(() => {
        testSkipper = sinon.createStubInstance(TestSkipper);

        clearRequire = sandbox.stub().named('clear-require');

        sandbox.stub(crypto, 'getShortMD5');

        MochaAdapter = proxyquire('../../../../lib/runner/mocha-runner/mocha-adapter', {
            'clear-require': clearRequire,
            'mocha': MochaStub
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
            mkMochaAdapter_({
                config: {
                    mochaOpts: {grep: 'foo'}
                }
            });

            assert.deepEqual(MochaStub.lastInstance.constructorArgs, {grep: 'foo'});
        });

        it('should enable full stacktrace in mocha', () => {
            mkMochaAdapter_();

            assert.called(MochaStub.lastInstance.fullTrace);
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

        it('should throw in case of duplicate test titles in different files', () => {
            const mochaAdapter = mkMochaAdapter_();

            MochaStub.lastInstance.loadFiles.callsFake(() => {
                MochaStub.lastInstance.updateSuiteTree((suite) => {
                    return suite
                        .addTest({title: 'some test', file: 'first file'})
                        .addTest({title: 'some test', file: 'second file'});
                });
            });

            assert.throws(() => mochaAdapter.loadFiles([]),
                'Tests with the same title \'some test\' in files \'first file\' and \'second file\' can\'t be used');
        });

        it('should throw in case of duplicate test titles in the same file', () => {
            const mochaAdapter = mkMochaAdapter_();

            MochaStub.lastInstance.loadFiles.callsFake(() => {
                MochaStub.lastInstance.updateSuiteTree((suite) => {
                    return suite
                        .addTest({title: 'some test', file: 'some file'})
                        .addTest({title: 'some test', file: 'some file'});
                });
            });

            assert.throws(() => mochaAdapter.loadFiles([]),
                'Tests with the same title \'some test\' in file \'some file\' can\'t be used');
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
            mkMochaAdapter_({
                config: {
                    ctx: {some: 'ctx'}
                }
            });

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

            return mochaAdapter.parse()
                .then(() => assert.notCalled(beforeEach));
        });

        it('should remove "afterEach" hooks', () => {
            const mochaAdapter = mkMochaAdapter_();
            const afterEach = sandbox.spy().named('afterEach');

            MochaStub.lastInstance.updateSuiteTree((suite) => suite.afterEach(afterEach).addTest());

            return mochaAdapter.parse()
                .then(() => assert.notCalled(afterEach));
        });
    });

    describe('inject skip', () => {
        let mochaAdapter;

        beforeEach(() => {
            sandbox.stub(Skip.prototype, 'handleEntity');

            mochaAdapter = mkMochaAdapter_();
        });

        it('should apply skip to test', () => {
            const test = new MochaStub.Test();

            MochaStub.lastInstance.updateSuiteTree((suite) => suite.addTest(test));

            return mochaAdapter.parse()
                .then(() => {
                    assert.called(Skip.prototype.handleEntity);
                    assert.calledWith(Skip.prototype.handleEntity, test);
                });
        });

        it('should apply skip to suite', () => {
            const nestedSuite = MochaStub.Suite.create();

            MochaStub.lastInstance.updateSuiteTree((suite) => suite.addSuite(nestedSuite));

            return mochaAdapter.parse()
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
            const mochaAdapter = mkMochaAdapter_({browserId: 'some-browser'});

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

            return mochaAdapter.parse()
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

            return mochaAdapter.parse()
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
    });

    describe('passthrough mocha file events', () => {
        beforeEach(() => {
            MochaAdapter.init();
        });

        afterEach(() => delete global.hermione);

        _.forEach({
            'pre-require': 'BEFORE_FILE_READ',
            'post-require': 'AFTER_FILE_READ'
        }, (hermioneEvent, mochaEvent) => {
            it(`should emit ${hermioneEvent} on mocha ${mochaEvent}`, () => {
                const onEvent = sinon.stub().named(`on${hermioneEvent}`);
                mkMochaAdapter_({browserId: 'bro'})
                    .on(RunnerEvents[hermioneEvent], onEvent);

                MochaStub.lastInstance.suite.emit(mochaEvent, {}, '/some/file.js');

                assert.calledOnceWith(onEvent, sinon.match({
                    file: '/some/file.js',
                    hermione: global.hermione,
                    browser: 'bro'
                }));
            });
        });

        it('should emit BEFORE_FILE_READ with mocha root suite subset', () => {
            const onBeforeFileRead = sinon.stub().named('onBeforeFileRead');
            const mochaAdapter = mkMochaAdapter_()
                .on(RunnerEvents.BEFORE_FILE_READ, onBeforeFileRead);

            const suiteSubset = SuiteSubset.create(mochaAdapter.suite, '/some/file.js');
            sandbox.stub(SuiteSubset, 'create')
                .withArgs(mochaAdapter.suite, '/some/file.js').returns(suiteSubset);

            MochaStub.lastInstance.suite.emit('pre-require', {}, '/some/file.js');

            assert.calledOnceWith(onBeforeFileRead, sinon.match({
                suite: suiteSubset
            }));
        });

        it('should emit BEFORE_FILE_READ and AFTER_FILE_READ with the same mocha root suite subset', () => {
            const onBeforeFileRead = sinon.stub().named('onBeforeFileRead');
            const onAfterFileRead = sinon.stub().named('onAfterFileRead');
            mkMochaAdapter_()
                .on(RunnerEvents.BEFORE_FILE_READ, onBeforeFileRead)
                .on(RunnerEvents.AFTER_FILE_READ, onAfterFileRead);

            MochaStub.lastInstance.suite.emit('pre-require', {}, '/some/file.js');
            MochaStub.lastInstance.suite.emit('post-require', {}, '/some/file.js');

            assert.equal(
                onBeforeFileRead.firstCall.args[0].suite,
                onAfterFileRead.firstCall.args[0].suite
            );
        });

        it('should emit different mocha root suite subsets for different files', () => {
            const onBeforeFileRead = sinon.stub().named('onBeforeFileRead');
            mkMochaAdapter_()
                .on(RunnerEvents.BEFORE_FILE_READ, onBeforeFileRead);

            MochaStub.lastInstance.suite.emit('pre-require', {}, '/some/file.js');
            MochaStub.lastInstance.suite.emit('pre-require', {}, '/other/file.js');

            assert.notEqual(
                onBeforeFileRead.firstCall.args[0].suite,
                onBeforeFileRead.secondCall.args[0].suite
            );
        });
    });

    describe('run', () => {
        it('should resolve with test list', async () => {
            const mochaAdapter = mkMochaAdapter_();

            const test1 = new MochaStub.Test();
            const test2 = new MochaStub.Test();

            MochaStub.lastInstance.updateSuiteTree((suite) => {
                return suite
                    .addTest(test1)
                    .addTest(test2);
            });

            const tests = await mochaAdapter.parse();

            assert.deepEqual(tests, [test1, test2]);
        });

        it('should resolve also with pending tests', async () => {
            const mochaAdapter = mkMochaAdapter_();

            const test = new MochaStub.Test();
            test.pending = true;

            MochaStub.lastInstance.updateSuiteTree((suite) => {
                return suite
                    .addTest(test);
            });

            const tests = await mochaAdapter.parse();

            assert.deepEqual(tests, [test]);
        });
    });
});
