'use strict';

const TestReader = require('build/test-reader');
const TestParser = require('build/test-reader/mocha-test-parser');
const TestSkipper = require('build/test-reader/test-skipper');
const Events = require('build/constants/runner-events');
const SetsBuilder = require('build/core/sets-builder');
const makeDefaultConfigStub = require('../../utils').makeConfigStub;
const _ = require('lodash');
const Promise = require('bluebird');
const DEFAULT_BROWSER_NAME = 'some-default-browser';

describe('test-reader', () => {
    const sandbox = sinon.sandbox.create();
    let groupByBrowser;

    const makeConfigStub = (opts) => {
        return makeDefaultConfigStub(opts, DEFAULT_BROWSER_NAME);
    };

    const callsFakeLoadFiles_ = ({cb = () => {}, tests = ['default-test']} = {}) => {
        TestParser.prototype.loadFiles.reset();
        TestParser.prototype.loadFiles.callsFake(async function() {
            await cb.call(this);
            this._tests = tests;
            return Promise.resolve(this);
        });
    };

    const readTests_ = ({opts, config, reader} = {}) => {
        opts = _.defaults(opts, {
            paths: [],
            sets: [],
            ignore: [],
            browsers: [],
            grep: ''
        });

        config = config || makeConfigStub();
        reader = reader || TestReader.create(config);

        return reader.read(opts);
    };

    beforeEach(() => {
        sandbox.spy(SetsBuilder, 'create');
        sandbox.stub(SetsBuilder.prototype, 'useFiles').returnsThis();
        sandbox.stub(SetsBuilder.prototype, 'useSets').returnsThis();
        sandbox.stub(SetsBuilder.prototype, 'useBrowsers').returnsThis();

        sandbox.stub(TestParser, 'prepare');
        sandbox.spy(TestParser, 'create');
        sandbox.stub(TestParser.prototype, 'applySkip').returnsThis();
        sandbox.stub(TestParser.prototype, 'applyConfigController').returnsThis();
        sandbox.stub(TestParser.prototype, 'applyGrep').returnsThis();

        sandbox.spy(TestSkipper, 'create');

        groupByBrowser = sinon.stub().returns({[`${DEFAULT_BROWSER_NAME}`]: []});

        sandbox.stub(SetsBuilder.prototype, 'build').resolves({groupByBrowser});

        sandbox.stub(TestParser.prototype, 'loadFiles').callsFake(function() {
            this._tests = [{title: 'default-test'}];
            return Promise.resolve(this);
        });

        sandbox.stub(TestParser.prototype, 'parse').callsFake(function() {
            return this._tests;
        });
    });

    afterEach(() => {
        sandbox.restore();

        delete process.env.HERMIONE_SETS;
    });

    describe('read', async () => {
        it('should create set-builder with sets from config and default directory', async () => {
            const defaultDir = require('../../../package').name;

            await readTests_({
                config: makeConfigStub({
                    sets: {
                        all: {}
                    }
                })
            });

            assert.calledOnce(SetsBuilder.create);
            assert.calledWithMatch(SetsBuilder.create, {all: {}}, {defaultDir});
        });

        it('should use passed paths', async () => {
            await readTests_({opts: {paths: ['some/path']}});

            assert.calledOnceWith(SetsBuilder.prototype.useFiles, ['some/path']);
        });

        it('should use passed sets', async () => {
            await readTests_({opts: {sets: ['set1']}});

            assert.calledOnceWith(SetsBuilder.prototype.useSets, ['set1']);
        });

        it('should use sets from environment variable "HERMIONE_SETS"', async () => {
            process.env.HERMIONE_SETS = 'set1,set2';

            await readTests_({opts: {sets: null}});

            assert.calledOnceWith(SetsBuilder.prototype.useSets, ['set1', 'set2']);
        });

        it('should concat passed sets with sets from environment variable "HERMIONE_SETS"', async () => {
            process.env.HERMIONE_SETS = 'set2';

            await readTests_({opts: {sets: ['set1']}});

            assert.calledOnceWith(SetsBuilder.prototype.useSets, ['set1', 'set2']);
        });

        it('should use pased browsers', async () => {
            await readTests_({opts: {browsers: ['bro1']}});

            assert.calledOnceWith(SetsBuilder.prototype.useBrowsers, ['bro1']);
        });

        it('should build set-collection using working directory', async () => {
            await readTests_();

            assert.calledOnceWith(SetsBuilder.prototype.build, process.cwd());
        });

        it('should pass ignore files to build', async () => {
            await readTests_({opts: {ignore: 'foo/bar'}});

            assert.calledOnceWith(SetsBuilder.prototype.build, sinon.match.any, {ignore: 'foo/bar'});
        });

        it('should pass file extensions to build from config', async () => {
            const fileExtensions = ['.foo', '.bar'];

            await readTests_({
                config: makeConfigStub({
                    system: {fileExtensions}
                })
            });

            assert.calledOnceWith(SetsBuilder.prototype.build, sinon.match.any, sinon.match.any, fileExtensions);
        });

        it('should call set-builder methods in rigth order', async () => {
            await readTests_();

            assert.callOrder(
                SetsBuilder.create,
                SetsBuilder.prototype.useFiles,
                SetsBuilder.prototype.useSets,
                SetsBuilder.prototype.useBrowsers,
                SetsBuilder.prototype.build
            );
        });

        it('should group files by browser', async () => {
            await readTests_();

            assert.calledOnce(groupByBrowser);
        });

        it('should prepare parser once before parsing', async () => {
            const groupByBrowser = sinon.stub().returns({
                bro1: [],
                bro2: []
            });
            SetsBuilder.prototype.build.resolves({groupByBrowser});

            const config = makeConfigStub({browsers: ['bro1', 'bro2']});
            await readTests_({config: config});

            assert.calledOnce(TestParser.prepare);
            assert.callOrder(TestParser.prepare, TestParser.create);
        });

        it('should create parser for each browser with the same config object', async () => {
            const groupByBrowser = sinon.stub().returns({
                bro1: [],
                bro2: []
            });
            SetsBuilder.prototype.build.resolves({groupByBrowser});

            const config = makeConfigStub({browsers: ['bro1', 'bro2']});
            await readTests_({config: config});

            assert.calledTwice(TestParser.create);
            assert.calledWith(TestParser.create, 'bro1', config);
            assert.calledWith(TestParser.create, 'bro2', config);
        });

        it('should load files for each browser', async () => {
            const groupByBrowser = sinon.stub().returns({
                bro1: ['common/file', 'file1'],
                bro2: ['common/file', 'file2']
            });
            SetsBuilder.prototype.build.resolves({groupByBrowser});

            const config = makeConfigStub({browsers: ['bro1', 'bro2']});
            await readTests_({config: config});

            assert.calledTwice(TestParser.prototype.loadFiles);
            assert.calledWith(TestParser.prototype.loadFiles, ['common/file', 'file1']);
            assert.calledWith(TestParser.prototype.loadFiles, ['common/file', 'file2']);
        });

        it('should return parsed tests grouped by browser', async () => {
            const groupByBrowser = sinon.stub().returns({
                bro1: ['file1'],
                bro2: ['file2']
            });
            SetsBuilder.prototype.build.resolves({groupByBrowser});

            const test1 = {title: 'test1'};
            const test2 = {title: 'test2'};
            const test3 = {title: 'test3'};
            const test4 = {title: 'test4'};

            TestParser.prototype.loadFiles
                .withArgs(['file1']).callsFake(function() {
                    this._tests = [test1, test2];
                    return this;
                })
                .withArgs(['file2']).callsFake(function() {
                    this._tests = [test3, test4];
                    return this;
                });

            TestParser.prototype.parse.callsFake(function() {
                return this._tests;
            });

            const config = makeConfigStub({browsers: ['bro1', 'bro2']});
            const specs = await readTests_({config: config});

            assert.deepEqual(specs, {
                bro1: [test1, test2],
                bro2: [test3, test4]
            });
        });

        it('should apply config controller for all browsers before loading any file', async () => {
            const groupByBrowser = sinon.stub().returns({
                bro1: [],
                bro2: []
            });
            SetsBuilder.prototype.build.resolves({groupByBrowser});

            const calls = [];
            TestParser.prototype.applyConfigController.reset();
            TestParser.prototype.applyConfigController.callsFake(function() {
                calls.push('applyConfigController');
                return this;
            });
            callsFakeLoadFiles_({cb: () => calls.push('loadFiles')});

            const config = makeConfigStub({browsers: ['bro1', 'bro2']});
            await readTests_({config: config});

            assert.deepEqual(calls, ['applyConfigController', 'applyConfigController', 'loadFiles', 'loadFiles']);
        });

        it('should apply grep for all browsers before loading any file', async () => {
            const groupByBrowser = sinon.stub().returns({
                bro1: [],
                bro2: []
            });
            SetsBuilder.prototype.build.resolves({groupByBrowser});

            const calls = [];
            TestParser.prototype.applyGrep.reset();
            TestParser.prototype.applyGrep.callsFake(function() {
                calls.push('applyGrep');
                return this;
            });
            callsFakeLoadFiles_({cb: () => calls.push('loadFiles')});

            const config = makeConfigStub({browsers: ['bro1', 'bro2']});
            await readTests_({config: config});

            assert.deepEqual(calls, ['applyGrep', 'applyGrep', 'loadFiles', 'loadFiles']);
        });

        it('should load files for all browsers before parsing any', async () => {
            const groupByBrowser = sinon.stub().returns({
                bro1: [],
                bro2: []
            });
            SetsBuilder.prototype.build.resolves({groupByBrowser});

            const calls = [];
            callsFakeLoadFiles_({cb: () => calls.push('loadFiles')});
            TestParser.prototype.parse.callsFake(() => calls.push('parse'));

            const config = makeConfigStub({browsers: ['bro1', 'bro2']});
            await readTests_({config: config});

            assert.deepEqual(calls, ['loadFiles', 'loadFiles', 'parse', 'parse']);
        });

        it('should load files sequentially by browsers', async () => {
            const groupByBrowser = sinon.stub().returns({
                bro1: [],
                bro2: []
            });
            SetsBuilder.prototype.build.resolves({groupByBrowser});

            const calls = [];

            callsFakeLoadFiles_({cb: async () => {
                calls.push('loadFiles');
                await Promise.delay(1);
                calls.push('afterLoadFiles');
            }});

            const config = makeConfigStub({browsers: ['bro1', 'bro2']});
            await readTests_({config: config});

            assert.deepEqual(calls, ['loadFiles', 'afterLoadFiles', 'loadFiles', 'afterLoadFiles']);
        });

        describe('if there are no tests found', () => {
            it('should throw error', async () => {
                callsFakeLoadFiles_({tests: []});

                assert.isRejected(readTests_(), 'There are no tests found');
            });

            [
                {name: 'paths', value: ['path1, path2'], expectedMsg: '- paths: path1, path2\n'},
                {name: 'browsers', value: ['bro1', 'bro2'], expectedMsg: '- browsers: bro1, bro2\n'},
                {name: 'ignore', value: 'ignore1', expectedMsg: '- ignore: ignore1\n'},
                {name: 'sets', value: ['set1', 'set2'], expectedMsg: '- sets: set1, set2\n'},
                {name: 'grep', value: 'grep1', expectedMsg: '- grep: grep1\n'}
            ].forEach(({name, value, expectedMsg}) => {
                it(`should correctly print passed option ${name}`, async () => {
                    callsFakeLoadFiles_({tests: []});

                    try {
                        await readTests_({opts: {[`${name}`]: value}});
                    } catch (e) {
                        assert.equal(e.message, 'There are no tests found by the specified options:\n'
                            + expectedMsg);
                    }
                });
            });

            it(`should correctly print several passed options that have a value`, async () => {
                callsFakeLoadFiles_({opts: {tests: []}});

                const opts = {
                    paths: ['path1', 'path2'],
                    browsers: ['browser1', 'browser2'],
                    ignore: undefined,
                    sets: []
                };

                try {
                    await readTests_({opts: opts});
                } catch (e) {
                    assert.equal(e.message, 'There are no tests found by the specified options:\n' +
                        '- paths: path1, path2\n- browsers: browser1, browser2\n');
                }
            });

            it ('should print supported options if none are specified', () => {
                callsFakeLoadFiles_({tests: []});

                assert.isRejected(readTests_(), 'Try to specify [paths, sets, ignore, browsers, grep] options');
            });

            it('should throw error if there no tests after grep applying', async () => {
                callsFakeLoadFiles_({tests: [{title: 'foo', silentSkip: true}]});

                try {
                    await readTests_({opts: {grep: 'foo'}});
                } catch (e) {
                    assert.equal(e.message, 'There are no tests found by the specified options:\n'
                        + '- grep: foo\n');
                }
            });
        });

        it('should not throw error if there is test mathed with grep pattern', async () => {
            callsFakeLoadFiles_({
                tests: [
                    {title: 'foo', silentSkip: false},
                    {title: 'bar', silentSkip: true}
                ]
            });

            await assert.isFulfilled(readTests_({opts: {grep: 'bar'}}));
        });

        describe('for each browser', () => {
            beforeEach(() => {
                SetsBuilder.prototype.build.resolves({
                    groupByBrowser: () => ({bro: []})
                });
            });

            [
                'BEFORE_FILE_READ',
                'AFTER_FILE_READ'
            ].forEach((event) => {
                it(`should passthrough ${event} event from test reader`, async () => {
                    const onEvent = sinon.spy().named(`on${event}`);
                    const reader = TestReader.create(makeConfigStub({browsers: ['bro']}))
                        .on(Events[event], onEvent);

                    TestParser.prototype.parse.callsFake(function() {
                        this.emit(Events[event], {foo: 'bar'});
                        return this._tests;
                    });

                    await readTests_({reader: reader});

                    assert.calledOnceWith(onEvent, {foo: 'bar'});
                });
            });

            it('should create test skipper', async () => {
                const config = makeConfigStub({browsers: ['bro']});

                await readTests_({config: config});

                assert.calledOnceWith(TestSkipper.create, config);
            });

            it('should share test skipper between all parsers', async () => {
                SetsBuilder.prototype.build.resolves({
                    groupByBrowser: () => ({
                        bro1: [],
                        bro2: []
                    })
                });

                const config = makeConfigStub({browsers: ['bro1', 'bro2']});
                await readTests_({config: config});

                assert.calledTwice(TestParser.prototype.applySkip);
                assert.equal(
                    TestParser.prototype.applySkip.firstCall.args[0],
                    TestParser.prototype.applySkip.secondCall.args[0]
                );
            });

            it('should apply grep to test parser', async () => {
                const config = makeConfigStub({browsers: ['bro']});

                await readTests_({config: config, opts: {grep: 'foo bar'}});

                assert.calledOnceWith(TestParser.prototype.applyGrep, 'foo bar');
            });

            it('should apply all props before loading files', async () => {
                const config = makeConfigStub({browsers: ['bro']});

                await readTests_({config: config});

                assert.callOrder(TestParser.prototype.applySkip, TestParser.prototype.loadFiles);
                assert.callOrder(TestParser.prototype.applyGrep, TestParser.prototype.loadFiles);
            });

            it('should load files before parsing', async () => {
                const config = makeConfigStub({browsers: ['bro']});

                await readTests_({config: config});

                assert.callOrder(TestParser.prototype.loadFiles, TestParser.prototype.parse);
            });
        });
    });
});
