'use strict';

const path = require('path');
const escapeRe = require('escape-string-regexp');
const proxyquire = require('proxyquire').noCallThru();
const crypto = require('lib/utils/crypto');
const SkipBuilder = require('lib/test-reader/skip/skip-builder');
const OnlyBuilder = require('lib/test-reader/skip/only-builder');
const Skip = require('lib/test-reader/skip/');
const BrowserConfigurator = require('lib/test-reader/browser');
const TestSkipper = require('lib/test-reader/test-skipper');
const RunnerEvents = require('lib/constants/runner-events');
const ParserEvents = require('lib/test-reader/parser-events');
const TestParserAPI = require('lib/test-reader/test-parser-api');
const configController = require('lib/test-reader/config-controller');
const logger = require('lib/utils/logger');
const MochaStub = require('../_mocha');
const {makeConfigStub} = require('../../utils');

const {EVENT_FILE_PRE_REQUIRE, EVENT_FILE_POST_REQUIRE} = MochaStub.Suite.constants;

describe('test-reader/mocha-test-parser', () => {
    const sandbox = sinon.sandbox.create();

    let MochaTestParser;
    let clearRequire;
    let testSkipper;
    let BrowserConfiguratorStubConstructor;
    let expectWdio;
    let expectWdioSetOptions;

    const mkMochaTestParser_ = (opts = {}) => {
        const browserId = opts.browserId || 'default-bro';
        const config = opts.config || makeConfigStub({browsers: [browserId]});

        return MochaTestParser.create(browserId, config);
    };

    const proxyquireMochaTestParser_ = () => {
        return proxyquire('../../../lib/test-reader/mocha-test-parser', {
            'clear-require': clearRequire,
            '@gemini-testing/mocha': MochaStub,
            './browser': BrowserConfiguratorStubConstructor,
            'expect-webdriverio': (() => expectWdio())()
        });
    };

    beforeEach(() => {
        sandbox.stub(logger, 'warn');

        testSkipper = sinon.createStubInstance(TestSkipper);
        BrowserConfiguratorStubConstructor = sinon
            .stub()
            .returns(new BrowserConfigurator('bro-id', []));

        clearRequire = sandbox.stub().named('clear-require');
        expectWdioSetOptions = sandbox.stub().named('set-options');
        expectWdio = sandbox.stub().named('expect-webdriverio')
            .returns({setOptions: expectWdioSetOptions});

        sandbox.stub(crypto, 'getShortMD5');

        global.expect = {some: 'data'};

        MochaTestParser = proxyquireMochaTestParser_();
        MochaTestParser.prepare(makeConfigStub());
    });

    afterEach(() => {
        delete global.hermione;
        sandbox.restore();
    });

    describe('prepare', () => {
        beforeEach(() => {
            delete global.hermione;
        });

        describe('hermione', () => {
            it('should add an empty hermione object to global', () => {
                MochaTestParser.prepare(makeConfigStub());

                assert.deepEqual(global.hermione, {});
            });

            it('should do nothing if hermione is already in a global', () => {
                global.hermione = {some: 'data'};

                MochaTestParser.prepare(makeConfigStub());

                assert.deepEqual(global.hermione, {some: 'data'});
            });
        });

        describe('expect', () => {
            beforeEach(() => {
                delete global.expect;
                expectWdio.resetHistory();

                MochaTestParser = proxyquireMochaTestParser_();
            });

            it('should require expect library', () => {
                MochaTestParser.prepare(makeConfigStub());

                assert.calledOnce(expectWdio);
            });

            it('should set user options for expect', () => {
                const system = {expectOpts: {wait: 200, interval: 100}};

                MochaTestParser.prepare(makeConfigStub({system}));

                assert.calledOnceWith(expectWdioSetOptions, system.expectOpts);
            });

            it('should do nothing if expect is already in a global', () => {
                global.expect = {some: 'data'};

                MochaTestParser.prepare(makeConfigStub());

                assert.notCalled(expectWdioSetOptions);
            });
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
        it('should be chainable', async () => {
            const mochaTestParser = mkMochaTestParser_();

            assert.deepEqual(await mochaTestParser.loadFiles(['path/to/file']), mochaTestParser);
        });

        it('should load files', async () => {
            const mochaTestParser = mkMochaTestParser_();

            await mochaTestParser.loadFiles(['path/to/file']);

            assert.calledOnceWith(MochaStub.lastInstance.addFile, 'path/to/file');
        });

        it('should load a single file', async () => {
            const mochaTestParser = mkMochaTestParser_();

            await mochaTestParser.loadFiles('path/to/file');

            assert.calledOnceWith(MochaStub.lastInstance.addFile, 'path/to/file');
        });

        it('should clear require cache for commonjs file before adding', async () => {
            const mochaTestParser = mkMochaTestParser_();

            await mochaTestParser.loadFiles(['path/to/file']);

            assert.calledOnceWith(clearRequire, path.resolve('path/to/file'));
            assert.callOrder(clearRequire, MochaStub.lastInstance.addFile);
        });

        it('should pass commonjs file to mocha as is', async () => {
            const mochaTestParser = mkMochaTestParser_();

            await mochaTestParser.loadFiles(['path/to/file']);

            assert.calledWith(MochaStub.lastInstance.addFile, 'path/to/file');
        });

        it('should pass ESM file to mocha as is', async () => {
            const mochaTestParser = mkMochaTestParser_({browserId: 'bro'});

            await mochaTestParser.loadFiles(['path/to/file.mjs']);

            assert.calledWith(MochaStub.lastInstance.addFile, 'path/to/file.mjs');
        });

        it('should not clear require cache for ESM files', async () => {
            const mochaTestParser = mkMochaTestParser_();

            await mochaTestParser.loadFiles(['path/to/file.mjs']);

            assert.notCalled(clearRequire);
        });

        it('should pass esm decorator to mocha, which will add query with browser id to module name', async () => {
            const mochaTestParser = mkMochaTestParser_({browserId: 'bro'});

            await mochaTestParser.loadFiles([]);

            const esmDecorator = MochaStub.lastInstance.loadFilesAsync.firstCall.args[0];
            assert.equal(esmDecorator('/some/file.esm'), '/some/file.esm?browserId=bro');
        });

        it('should load file after add', async () => {
            const mochaTestParser = mkMochaTestParser_();

            await mochaTestParser.loadFiles(['path/to/file']);

            assert.calledOnce(MochaStub.lastInstance.loadFilesAsync);
            assert.callOrder(MochaStub.lastInstance.addFile, MochaStub.lastInstance.loadFilesAsync);
        });

        it('should filter suites/tests with `only`', async () => {
            sandbox.stub(MochaStub.Suite.prototype, 'filterOnly');
            const mochaTestParser = mkMochaTestParser_();

            await mochaTestParser.loadFiles(['path/to/file']);

            assert.calledOnce(MochaStub.Suite.prototype.filterOnly);
            assert.callOrder(MochaStub.lastInstance.loadFilesAsync, MochaStub.Suite.prototype.filterOnly);
        });

        it('should flush files after load', async () => {
            const mochaTestParser = mkMochaTestParser_();

            await mochaTestParser.loadFiles(['path/to/file']);

            assert.deepEqual(MochaStub.lastInstance.files, []);
        });

        it('should throw in case of duplicate test titles in different files', async () => {
            const mochaTestParser = mkMochaTestParser_();

            MochaStub.lastInstance.loadFilesAsync.callsFake(async () => {
                MochaStub.lastInstance.updateSuiteTree((suite) => {
                    return suite
                        .addTest({title: 'some test', file: 'first file'})
                        .addTest({title: 'some test', file: 'second file'});
                });

                return Promise.resolve();
            });

            await assert.isRejected(
                mochaTestParser.loadFiles([]),
                'Tests with the same title \'some test\' in files \'first file\' and \'second file\' can\'t be used'
            );
        });

        it('should throw in case of duplicate test titles in the same file', async () => {
            const mochaTestParser = mkMochaTestParser_();

            MochaStub.lastInstance.loadFilesAsync.callsFake(async () => {
                MochaStub.lastInstance.updateSuiteTree((suite) => {
                    return suite
                        .addTest({title: 'some test', file: 'some file'})
                        .addTest({title: 'some test', file: 'some file'});
                });

                return Promise.resolve();
            });

            await assert.isRejected(
                mochaTestParser.loadFiles([]),
                'Tests with the same title \'some test\' in file \'some file\' can\'t be used'
            );
        });

        it('should emit TEST event on test creation', async () => {
            const onTest = sinon.spy().named('onTest');
            const mochaTestParser = mkMochaTestParser_()
                .on(ParserEvents.TEST, onTest);

            const test = MochaStub.Test.create();

            MochaStub.lastInstance.loadFilesAsync.callsFake(async () => {
                MochaStub.lastInstance.updateSuiteTree((suite) => suite.addTest(test));

                return Promise.resolve();
            });

            await mochaTestParser.loadFiles([]);

            assert.calledOnceWith(onTest, test);
        });

        it('should emit SUITE event on suite creation', async () => {
            const onSuite = sinon.spy().named('onSuite');
            const mochaTestParser = mkMochaTestParser_()
                .on(ParserEvents.SUITE, onSuite);

            const nestedSuite = MochaStub.Suite.create();

            MochaStub.lastInstance.loadFilesAsync.callsFake(async () => {
                MochaStub.lastInstance.updateSuiteTree((suite) => suite.addSuite(nestedSuite));

                return Promise.resolve();
            });

            await mochaTestParser.loadFiles([]);

            assert.calledOnceWith(onSuite, nestedSuite);
        });

        it('hermione.ctx should return passed ctx', async () => {
            const system = {ctx: {some: 'ctx'}};
            const config = makeConfigStub({browsers: ['bro'], system});
            const mochaTestParser = mkMochaTestParser_({browserId: 'bro', config});

            await mochaTestParser.loadFiles([]);

            assert.deepEqual(global.hermione.ctx, {some: 'ctx'});
        });

        describe('inject skip', () => {
            let mochaTestParser;

            beforeEach(async () => {
                sandbox.stub(Skip.prototype, 'handleEntity');

                mochaTestParser = mkMochaTestParser_();
                await mochaTestParser.loadFiles([]);
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

        describe('inject browser configurator', () => {
            let mochaTestParser;
            const browserId = 'browser-id';
            const api = {method: () => {}};
            const config = makeConfigStub({browsers: [browserId]});
            const configurator = new BrowserConfigurator(browserId, []);

            beforeEach(async () => {
                BrowserConfiguratorStubConstructor.returns(configurator);
                sandbox.stub(configurator, 'exposeAPI').returns(api);
                sandbox.stub(configurator, 'handleTest');
                sandbox.stub(configurator, 'handleSuite');

                mochaTestParser = mkMochaTestParser_({config, browserId});
                await mochaTestParser.loadFiles([]);
            });

            it('should pass the config and the "browserId" param into the constructor', () => {
                assert.calledWith(BrowserConfiguratorStubConstructor, browserId, [browserId]);
            });

            it('should inject API into "hermione.browser"', () => {
                assert.equal(global.hermione.browser, api);
            });

            it('should handle "test"', () => {
                const test = new MochaStub.Test();

                MochaStub.lastInstance.updateSuiteTree((suite) => suite.addTest(test));

                mochaTestParser.parse();

                assert.calledWith(configurator.handleTest, test);
            });

            it('should handle "suite"', () => {
                const nestedSuite = MochaStub.Suite.create();

                MochaStub.lastInstance.updateSuiteTree((suite) => suite.addSuite(nestedSuite));

                mochaTestParser.parse();

                assert.calledWith(configurator.handleSuite, nestedSuite);
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

                MochaStub.lastInstance.suite.emit(EVENT_FILE_PRE_REQUIRE, {}, '/some/file.js');

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

                MochaStub.lastInstance.suite.emit(EVENT_FILE_PRE_REQUIRE, {}, '/some/file.js');
                MochaStub.lastInstance.updateSuiteTree((suite) => {
                    return suite
                        .addSuite(MochaStub.Suite.create());
                });

                let suite1 = MochaStub.lastInstance.suite.suites[0];

                assert.equal(suite1.id(), '123450');

                MochaStub.lastInstance.suite.emit(EVENT_FILE_PRE_REQUIRE, {}, '/other/file.js');
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
            MochaStub.lastInstance.suite.emit(EVENT_FILE_PRE_REQUIRE);

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

        describe('should set "browserVersion" property from', () => {
            it('"version" capability', () => {
                const config = makeConfigStub({
                    browsers: ['bro'], desiredCapabilities: {version: '2.0'}
                });
                const test = new MochaStub.Test();

                mkMochaTestParser_({browserId: 'bro', config});
                MochaStub.lastInstance.updateSuiteTree((suite) => suite.addTest(test));

                assert.equal(test.browserVersion, '2.0');
            });

            it('"browserVersion" capability if it is already exists', () => {
                const config = makeConfigStub({
                    browsers: ['bro'], desiredCapabilities: {browserVersion: '3.0'}
                });
                const test = new MochaStub.Test();

                mkMochaTestParser_({browserId: 'bro', config});
                MochaStub.lastInstance.updateSuiteTree((suite) => suite.addTest(test));

                assert.equal(test.browserVersion, '3.0');
            });
        });

        it('shold not override browserVersion property if it exists', () => {
            const config = makeConfigStub({browsers: ['bro'], version: '2.0'});
            const test = new MochaStub.Test();

            test.browserVersion = '2.1';

            mkMochaTestParser_({browserId: 'bro', config});
            MochaStub.lastInstance.updateSuiteTree((suite) => suite.addTest(test));

            assert.equal(test.browserVersion, '2.1');
        });

        it('shold not set browser version if it does not exists in config or test', () => {
            const config = makeConfigStub({browsers: ['bro']});
            const test = new MochaStub.Test();

            delete config.browsers.bro.desiredCapabilities.version;

            mkMochaTestParser_({browserId: 'bro', config});
            MochaStub.lastInstance.updateSuiteTree((suite) => suite.addTest(test));

            assert.equal(test.browserVersion, undefined);
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

        [
            [EVENT_FILE_PRE_REQUIRE, 'BEFORE_FILE_READ'],
            [EVENT_FILE_POST_REQUIRE, 'AFTER_FILE_READ']
        ].forEach(([mochaEvent, hermioneEvent]) => {
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

            MochaStub.lastInstance.suite.emit(EVENT_FILE_PRE_REQUIRE, {}, '/some/file.js');

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
