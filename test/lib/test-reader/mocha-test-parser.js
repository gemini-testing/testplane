'use strict';

const path = require('path');
const escapeRe = require('escape-string-regexp');
const _ = require('lodash');
const proxyquire = require('proxyquire').noCallThru();
const crypto = require('lib/utils/crypto');
const SkipBuilder = require('lib/test-reader/skip/skip-builder');
const OnlyBuilder = require('lib/test-reader/skip/only-builder');
const Skip = require('lib/test-reader/skip/');
const TestSkipper = require('lib/test-reader/test-skipper');
const RunnerEvents = require('lib/constants/runner-events');
const ParserEvents = require('lib/test-reader/parser-events');
const TestParserAPI = require('lib/test-reader/test-parser-api');
const configController = require('lib/test-reader/config-controller');
const logger = require('lib/utils/logger');
const MochaStub = require('../_mocha');
const {makeConfigStub} = require('../../utils');

describe('test-reader/mocha-test-parser', () => {
    const sandbox = sinon.sandbox.create();

    let MochaTestParser;
    let clearRequire;
    let testSkipper;

    const mkMochaTestParser_ = (opts = {}) => {
        const browserId = opts.browserId || 'default-bro';
        const config = opts.config || makeConfigStub({browsers: [browserId]});

        return MochaTestParser.create(browserId, config);
    };

    beforeEach(() => {
        sandbox.stub(logger, 'warn');

        testSkipper = sinon.createStubInstance(TestSkipper);

        clearRequire = sandbox.stub().named('clear-require');

        sandbox.stub(crypto, 'getShortMD5');

        MochaTestParser = proxyquire('../../../lib/test-reader/mocha-test-parser', {
            'clear-require': clearRequire,
            'mocha': MochaStub
        });

        MochaTestParser.prepare();
    });

    afterEach(() => {
        delete global.hermione;
        sandbox.restore();
    });

    describe('prepare', () => {
        beforeEach(() => delete global.hermione);

        it('should add an empty hermione object to global', () => {
            MochaTestParser.prepare();

            assert.deepEqual(global.hermione, {});
        });

        it('should do nothing if hermione is already in a global', () => {
            global.hermione = {some: 'data'};

            MochaTestParser.prepare();

            assert.deepEqual(global.hermione, {some: 'data'});
        });
    });

    describe('constructor', () => {
        it('should pass shared opts to mocha instance', () => {
            const system = {mochaOpts: {grep: 'foo'}};
            const config = makeConfigStub({browsers: ['bro'], system});

            mkMochaTestParser_({browserId: 'bro', config});

            assert.deepEqual(MochaStub.lastInstance.constructorArgs, {grep: 'foo'});
        });

        it('should enable full stacktrace in mocha', () => {
            mkMochaTestParser_();

            assert.called(MochaStub.lastInstance.fullTrace);
        });

        it('should create test parser API object', () => {
            sandbox.spy(TestParserAPI, 'create');
            global.hermione = {foo: 'bar'};

            const testParser = mkMochaTestParser_();

            assert.calledOnceWith(TestParserAPI.create, testParser, global.hermione);
        });
    });

    describe('loadFiles', () => {
        it('should be chainable', () => {
            const mochaTestParser = mkMochaTestParser_();

            assert.deepEqual(mochaTestParser.loadFiles(['path/to/file']), mochaTestParser);
        });

        it('should load files', () => {
            const mochaTestParser = mkMochaTestParser_();

            mochaTestParser.loadFiles(['path/to/file']);

            assert.calledOnceWith(MochaStub.lastInstance.addFile, 'path/to/file');
        });

        it('should load a single file', () => {
            const mochaTestParser = mkMochaTestParser_();

            mochaTestParser.loadFiles('path/to/file');

            assert.calledOnceWith(MochaStub.lastInstance.addFile, 'path/to/file');
        });

        it('should clear require cache for file before adding', () => {
            const mochaTestParser = mkMochaTestParser_();

            mochaTestParser.loadFiles(['path/to/file']);

            assert.calledOnceWith(clearRequire, path.resolve('path/to/file'));
            assert.callOrder(clearRequire, MochaStub.lastInstance.addFile);
        });

        it('should load file after add', () => {
            const mochaTestParser = mkMochaTestParser_();

            mochaTestParser.loadFiles(['path/to/file']);

            assert.calledOnce(MochaStub.lastInstance.loadFiles);
            assert.callOrder(MochaStub.lastInstance.addFile, MochaStub.lastInstance.loadFiles);
        });

        it('should flush files after load', () => {
            const mochaTestParser = mkMochaTestParser_();

            mochaTestParser.loadFiles(['path/to/file']);

            assert.deepEqual(MochaStub.lastInstance.files, []);
        });

        it('should throw in case of duplicate test titles in different files', () => {
            const mochaTestParser = mkMochaTestParser_();

            MochaStub.lastInstance.loadFiles.callsFake(() => {
                MochaStub.lastInstance.updateSuiteTree((suite) => {
                    return suite
                        .addTest({title: 'some test', file: 'first file'})
                        .addTest({title: 'some test', file: 'second file'});
                });
            });

            assert.throws(() => mochaTestParser.loadFiles([]),
                'Tests with the same title \'some test\' in files \'first file\' and \'second file\' can\'t be used');
        });

        it('should throw in case of duplicate test titles in the same file', () => {
            const mochaTestParser = mkMochaTestParser_();

            MochaStub.lastInstance.loadFiles.callsFake(() => {
                MochaStub.lastInstance.updateSuiteTree((suite) => {
                    return suite
                        .addTest({title: 'some test', file: 'some file'})
                        .addTest({title: 'some test', file: 'some file'});
                });
            });

            assert.throws(() => mochaTestParser.loadFiles([]),
                'Tests with the same title \'some test\' in file \'some file\' can\'t be used');
        });

        it('should emit TEST event on test creation', () => {
            const onTest = sinon.spy().named('onTest');
            const mochaTestParser = mkMochaTestParser_()
                .on(ParserEvents.TEST, onTest);

            const test = MochaStub.Test.create();

            MochaStub.lastInstance.loadFiles.callsFake(() => {
                MochaStub.lastInstance.updateSuiteTree((suite) => suite.addTest(test));
            });

            mochaTestParser.loadFiles([]);

            assert.calledOnceWith(onTest, test);
        });

        it('should emit SUITE event on suite creation', () => {
            const onSuite = sinon.spy().named('onSuite');
            const mochaTestParser = mkMochaTestParser_()
                .on(ParserEvents.SUITE, onSuite);

            const nestedSuite = MochaStub.Suite.create();

            MochaStub.lastInstance.loadFiles.callsFake(() => {
                MochaStub.lastInstance.updateSuiteTree((suite) => suite.addSuite(nestedSuite));
            });

            mochaTestParser.loadFiles([]);

            assert.calledOnceWith(onSuite, nestedSuite);
        });

        it('hermione.ctx should return passed ctx', () => {
            const system = {ctx: {some: 'ctx'}};
            const config = makeConfigStub({browsers: ['bro'], system});
            const mochaTestParser = mkMochaTestParser_({browserId: 'bro', config});

            mochaTestParser.loadFiles([]);

            assert.deepEqual(global.hermione.ctx, {some: 'ctx'});
        });

        describe('inject skip', () => {
            let mochaTestParser;

            beforeEach(() => {
                sandbox.stub(Skip.prototype, 'handleEntity');

                mochaTestParser = mkMochaTestParser_();
                mochaTestParser.loadFiles([]);
            });

            it('hermione.skip should return SkipBuilder instance', () => {
                assert.instanceOf(global.hermione.skip, SkipBuilder);
            });

            it('hermione.only should return OnlyBuilder instance', () => {
                assert.instanceOf(global.hermione.only, OnlyBuilder);
            });

            it('should apply skip to test', () => {
                const test = new MochaStub.Test();

                MochaStub.lastInstance.updateSuiteTree((suite) => suite.addTest(test));

                mochaTestParser.parse();

                assert.called(Skip.prototype.handleEntity);
                assert.calledWith(Skip.prototype.handleEntity, test);
            });

            it('should apply skip to suite', () => {
                const nestedSuite = MochaStub.Suite.create();

                MochaStub.lastInstance.updateSuiteTree((suite) => suite.addSuite(nestedSuite));

                mochaTestParser.parse();

                assert.called(Skip.prototype.handleEntity);
                assert.calledWith(Skip.prototype.handleEntity, nestedSuite);
            });
        });
    });

    describe('forbid suite hooks', () => {
        beforeEach(() => mkMochaTestParser_());

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

    describe('set timeout', () => {
        it('should not set timeout if option "testTimeout" is not specified in config', () => {
            const config = makeConfigStub({browsers: ['bro'], testTimeout: null});

            mkMochaTestParser_({browserId: 'bro', config});

            assert.notCalled(MochaStub.lastInstance.timeout);
        });

        it('should set timeout if option "testTimeout" is specified in config', () => {
            const config = makeConfigStub({browsers: ['bro'], testTimeout: 100500});

            mkMochaTestParser_({browserId: 'bro', config});

            assert.calledOnceWith(MochaStub.lastInstance.timeout, 100500);
        });

        it('should reset timeout if option "testTimeout" is specified as zero in config', () => {
            const config = makeConfigStub({browsers: ['bro'], testTimeout: 0});

            mkMochaTestParser_({browserId: 'bro', config});

            assert.calledOnceWith(MochaStub.lastInstance.timeout, 0);
        });
    });

    describe('extend suite API', () => {
        describe('id', () => {
            it('should be added to suite', () => {
                mkMochaTestParser_();

                MochaStub.lastInstance.updateSuiteTree((suite) => suite.addSuite(MochaStub.Suite.create()));

                const suite = MochaStub.lastInstance.suite.suites[0];

                assert.isFunction(suite.id);
            });

            it('should generate uniq suite id', () => {
                crypto.getShortMD5.withArgs('/some/file.js').returns('12345');

                mkMochaTestParser_();

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

                assert.equal(suite1.id, '123450');
                assert.equal(suite2.id, '123451');
            });

            it('"id" getter results should not be dependent on suite parsing order', () => {
                crypto.getShortMD5.withArgs('/some/file.js').returns('12345');
                crypto.getShortMD5.withArgs('/other/file.js').returns('67890');

                mkMochaTestParser_();

                MochaStub.lastInstance.suite.emit('pre-require', {}, '/some/file.js');
                MochaStub.lastInstance.updateSuiteTree((suite) => {
                    return suite
                        .addSuite(MochaStub.Suite.create());
                });

                let suite1 = MochaStub.lastInstance.suite.suites[0];

                assert.equal(suite1.id(), '123450');

                MochaStub.lastInstance.suite.emit('pre-require', {}, '/other/file.js');
                MochaStub.lastInstance.updateSuiteTree((suite) => {
                    return suite
                        .addSuite(MochaStub.Suite.create());
                });

                suite1 = MochaStub.lastInstance.suite.suites[0];
                const suite2 = MochaStub.lastInstance.suite.suites[1];

                assert.equal(suite1.id(), '123450');
                assert.equal(suite2.id(), '678901');
            });
        });
    });

    describe('applySkip', () => {
        it('should skip suite using test skipper', () => {
            const mochaTestParser = mkMochaTestParser_({browserId: 'some-browser'});

            mochaTestParser.applySkip(testSkipper);

            assert.calledWith(testSkipper.applySkip, MochaStub.lastInstance.suite, 'some-browser');
        });

        it('should be chainable', () => {
            const mochaTestParser = mkMochaTestParser_();
            const mochaInstance = mochaTestParser.applySkip(testSkipper);

            assert.instanceOf(mochaInstance, MochaTestParser);
        });
    });

    describe('applyConfigController', () => {
        beforeEach(() => {
            sandbox.stub(TestParserAPI.prototype, 'setController');
        });

        it('should set config controller on before test file read event', () => {
            const mochaTestParser = mkMochaTestParser_();

            mochaTestParser.applyConfigController();
            MochaStub.lastInstance.suite.emit('pre-require');

            assert.calledOnceWith(TestParserAPI.prototype.setController, 'config', configController);
        });
    });

    describe('applyGrep', () => {
        it('should add grep to mocha', () => {
            const mochaTestParser = mkMochaTestParser_();

            mochaTestParser.applyGrep('(foo|bar)');

            assert.calledOnceWith(MochaStub.lastInstance.grep, new RegExp(`((foo|bar))|(${escapeRe('(foo|bar)')})`));
        });

        it('should add invalid regex as string grep to mocha', () => {
            const mochaTestParser = mkMochaTestParser_();

            mochaTestParser.applyGrep('(foo|bar');

            assert.calledOnceWith(MochaStub.lastInstance.grep, new RegExp(escapeRe('(foo|bar')));
        });

        it('should warn about invalid regex', () => {
            const mochaTestParser = mkMochaTestParser_();

            mochaTestParser.applyGrep('(foo|bar');

            assert.calledOnceWith(logger.warn, 'Invalid regexp provided to grep, searching by its string representation. SyntaxError: Invalid regular expression: /((foo|bar)|(\\(foo\\|bar)/: Unterminated group');
        });

        it('should not add empty grep to mocha', () => {
            const mochaTestParser = mkMochaTestParser_();

            mochaTestParser.applyGrep();
            mochaTestParser.applyGrep('');

            assert.notCalled(MochaStub.lastInstance.grep);
        });

        it('should be chainable', () => {
            const mochaTestParser = mkMochaTestParser_();
            const mochaInstance = mochaTestParser.applyGrep('foo bar');

            assert.instanceOf(mochaInstance, MochaTestParser);
        });
    });

    describe('extend test API', () => {
        it('should add "id" method for test', () => {
            mkMochaTestParser_();
            MochaStub.lastInstance.updateSuiteTree((suite) => suite.addTest(new MochaStub.Test()));

            const test = MochaStub.lastInstance.suite.tests[0];

            assert.isFunction(test.id);
        });

        it('should generate uniq id for test by calling "id" method', () => {
            crypto.getShortMD5.returns('12345');
            mkMochaTestParser_();
            MochaStub.lastInstance.updateSuiteTree((suite) => suite.addTest(new MochaStub.Test()));

            const test = MochaStub.lastInstance.suite.tests[0];

            assert.equal(test.id(), '12345');
            assert.equal(test.id, '12345');
        });

        it('shold set browserId property to test', () => {
            mkMochaTestParser_({browserId: 'bro'});
            MochaStub.lastInstance.updateSuiteTree((suite) => suite.addTest(new MochaStub.Test()));

            const test = MochaStub.lastInstance.suite.tests[0];

            assert.equal(test.browserId, 'bro');
        });
    });

    describe('extend hook API', () => {
        it('shold set browserId property to beforeEach hook', () => {
            mkMochaTestParser_({browserId: 'bro'});
            MochaStub.lastInstance.updateSuiteTree((suite) => suite.beforeEach(() => {}));

            const hook = MochaStub.lastInstance.suite.beforeEachHooks[0];

            assert.propertyVal(hook, 'browserId', 'bro');
        });

        it('shold set browserId property to afterEach hook', () => {
            mkMochaTestParser_({browserId: 'bro'});
            MochaStub.lastInstance.updateSuiteTree((suite) => suite.afterEach(() => {}));

            const hook = MochaStub.lastInstance.suite.afterEachHooks[0];

            assert.propertyVal(hook, 'browserId', 'bro');
        });
    });

    describe('passthrough mocha file events', () => {
        beforeEach(() => {
            MochaTestParser.init();
        });

        _.forEach({
            'pre-require': 'BEFORE_FILE_READ',
            'post-require': 'AFTER_FILE_READ'
        }, (hermioneEvent, mochaEvent) => {
            it(`should emit ${hermioneEvent} on mocha ${mochaEvent}`, () => {
                const onEvent = sinon.stub().named(`on${hermioneEvent}`);
                mkMochaTestParser_({browserId: 'bro'})
                    .on(RunnerEvents[hermioneEvent], onEvent);

                MochaStub.lastInstance.suite.emit(mochaEvent, {}, '/some/file.js');

                assert.calledOnceWith(onEvent, sinon.match({
                    file: '/some/file.js',
                    hermione: global.hermione,
                    browser: 'bro'
                }));
            });
        });

        it('should emit BEFORE_FILE_READ with test parser API', () => {
            const onBeforeFileRead = sinon.stub().named('onBeforeFileRead');
            mkMochaTestParser_()
                .on(RunnerEvents.BEFORE_FILE_READ, onBeforeFileRead);

            MochaStub.lastInstance.suite.emit('pre-require', {}, '/some/file.js');

            assert.calledOnceWith(onBeforeFileRead, sinon.match({
                testParser: sinon.match.instanceOf(TestParserAPI)
            }));
        });
    });

    describe('parse', () => {
        it('should resolve with test list', () => {
            const mochaTestParser = mkMochaTestParser_();

            const test1 = new MochaStub.Test();
            const test2 = new MochaStub.Test();

            MochaStub.lastInstance.updateSuiteTree((suite) => {
                return suite
                    .addTest(test1)
                    .addTest(test2);
            });

            const tests = mochaTestParser.parse();

            assert.deepEqual(tests, [test1, test2]);
        });

        it('should resolve also with pending tests', () => {
            const mochaTestParser = mkMochaTestParser_();

            const test = new MochaStub.Test();
            test.pending = true;

            MochaStub.lastInstance.updateSuiteTree((suite) => {
                return suite
                    .addTest(test);
            });

            const tests = mochaTestParser.parse();

            assert.deepEqual(tests, [test]);
        });

        describe('grep', () => {
            it('should disable tests not matching to grep pattern', () => {
                const mochaTestParser = mkMochaTestParser_();

                const test = new MochaStub.Test(null, {title: 'test title'});

                MochaStub.lastInstance.updateSuiteTree((suite) => suite.addTest(test));

                const tests = mochaTestParser
                    .applyGrep('foo')
                    .parse();

                assert.isTrue(Boolean(tests[0].pending));
                assert.isTrue(Boolean(tests[0].silentSkip));
            });

            it('should not disable tests matching to grep pattern', () => {
                const mochaTestParser = mkMochaTestParser_();

                const test = new MochaStub.Test(null, {title: 'test title'});

                MochaStub.lastInstance.updateSuiteTree((suite) => suite.addTest(test));

                const tests = mochaTestParser
                    .applyGrep('test title')
                    .parse();

                assert.isFalse(Boolean(tests[0].pending));
                assert.isFalse(Boolean(tests[0].silentSkip));
            });

            it('should not disable tests matching to grep regexp pattern', () => {
                const mochaTestParser = mkMochaTestParser_();

                const test = new MochaStub.Test(null, {title: 'test title'});

                MochaStub.lastInstance.updateSuiteTree((suite) => suite.addTest(test));

                const tests = mochaTestParser
                    .applyGrep('test tit+le')
                    .parse();

                assert.isFalse(Boolean(tests[0].pending));
                assert.isFalse(Boolean(tests[0].silentSkip));
            });

            it('should not disable tests matching to grep regexp-like pattern', () => {
                const mochaTestParser = mkMochaTestParser_();

                const test = new MochaStub.Test(null, {title: 'test (title)'});

                MochaStub.lastInstance.updateSuiteTree((suite) => suite.addTest(test));

                const tests = mochaTestParser
                    .applyGrep('test (title)')
                    .parse();

                assert.isFalse(Boolean(tests[0].pending));
                assert.isFalse(Boolean(tests[0].silentSkip));
            });

            it('should not disable tests matching to grep regexp-like pattern', () => {
                const mochaTestParser = mkMochaTestParser_();

                const test = new MochaStub.Test(null, {title: 'test title with { or ('});

                MochaStub.lastInstance.updateSuiteTree((suite) => suite.addTest(test));

                const tests = mochaTestParser
                    .applyGrep('test title with { or (')
                    .parse();

                assert.isFalse(Boolean(tests[0].pending));
                assert.isFalse(Boolean(tests[0].silentSkip));
            });

            it('should not enable disabled tests', () => {
                const mochaTestParser = mkMochaTestParser_();

                const test = new MochaStub.Test(null, {
                    title: 'test title',
                    pending: true,
                    silentSkip: true
                });

                MochaStub.lastInstance.updateSuiteTree((suite) => suite.addTest(test));

                const tests = mochaTestParser
                    .applyGrep('test title')
                    .parse();

                assert.isTrue(Boolean(tests[0].pending));
                assert.isTrue(Boolean(tests[0].silentSkip));
            });
        });
    });
});
