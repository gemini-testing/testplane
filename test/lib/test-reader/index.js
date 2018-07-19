'use strict';

const TestReader = require('lib/test-reader');
const TestParser = require('lib/test-reader/mocha-test-parser');
const TestSkipper = require('lib/test-reader/test-skipper');
const Events = require('lib/constants/runner-events');
const SetsBuilder = require('gemini-core').SetsBuilder;
const {makeConfigStub} = require('../../utils');
const _ = require('lodash');

describe('test-reader', () => {
    const sandbox = sinon.sandbox.create();

    const readTests_ = (opts = {}) => {
        opts = _.defaults(opts, {
            paths: [],
            config: makeConfigStub(),
            sets: [],
            ignore: [],
            grep: 'default-grep'
        });

        const reader = opts.reader || TestReader.create(opts.config);

        return reader.read(opts);
    };

    beforeEach(() => {
        sandbox.spy(SetsBuilder, 'create');
        sandbox.stub(SetsBuilder.prototype, 'useFiles').returnsThis();
        sandbox.stub(SetsBuilder.prototype, 'useSets').returnsThis();
        sandbox.stub(SetsBuilder.prototype, 'useBrowsers').returnsThis();

        sandbox.stub(SetsBuilder.prototype, 'build').resolves({groupByBrowser: () => ({})});

        sandbox.stub(TestParser, 'prepare');
        sandbox.spy(TestParser, 'create');
        sandbox.stub(TestParser.prototype, 'applySkip').returnsThis();
        sandbox.stub(TestParser.prototype, 'applyGrep').returnsThis();
        sandbox.stub(TestParser.prototype, 'loadFiles').returnsThis();
        sandbox.stub(TestParser.prototype, 'parse');

        sandbox.spy(TestSkipper, 'create');
    });

    afterEach(() => sandbox.restore());

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
            await readTests_({paths: ['some/path']});

            assert.calledOnceWith(SetsBuilder.prototype.useFiles, ['some/path']);
        });

        it('should use pased sets', async () => {
            await readTests_({sets: ['set1']});

            assert.calledOnceWith(SetsBuilder.prototype.useSets, ['set1']);
        });

        it('should use pased browsers', async () => {
            await readTests_({browsers: ['bro1']});

            assert.calledOnceWith(SetsBuilder.prototype.useBrowsers, ['bro1']);
        });

        it('should build set-collection using working directory', async () => {
            await readTests_();

            assert.calledOnceWith(SetsBuilder.prototype.build, process.cwd());
        });

        it('should pass ignore files to build', async () => {
            await readTests_({ignore: 'foo/bar'});

            assert.calledOnceWith(SetsBuilder.prototype.build, sinon.match.any, {ignore: 'foo/bar'});
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
            const groupByBrowser = sinon.stub().returns({});
            SetsBuilder.prototype.build.resolves({groupByBrowser});

            await readTests_();

            assert.calledOnce(groupByBrowser);
        });

        it('should prepare parser once before parsing', async () => {
            const groupByBrowser = sinon.stub().returns({
                bro1: [],
                bro2: []
            });
            SetsBuilder.prototype.build.resolves({groupByBrowser});

            await readTests_();

            assert.calledOnce(TestParser.prepare);
            assert.callOrder(TestParser.prepare, TestParser.create);
        });

        it('should create parser for each browser with the same config object', async () => {
            const groupByBrowser = sinon.stub().returns({
                bro1: [],
                bro2: []
            });
            SetsBuilder.prototype.build.resolves({groupByBrowser});

            const config = makeConfigStub();
            await readTests_({config});

            assert.calledTwice(TestParser.create);
            assert.calledWith(TestParser.create, 'bro1', config.system);
            assert.calledWith(TestParser.create, 'bro2', config.system);
        });

        it('should load files for each browser', async () => {
            const groupByBrowser = sinon.stub().returns({
                bro1: ['common/file', 'file1'],
                bro2: ['common/file', 'file2']
            });
            SetsBuilder.prototype.build.resolves({groupByBrowser});

            await readTests_();

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

            const specs = await readTests_();

            assert.deepEqual(specs, {
                bro1: [test1, test2],
                bro2: [test3, test4]
            });
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
            TestParser.prototype.loadFiles.reset();
            TestParser.prototype.loadFiles.callsFake(function() {
                calls.push('loadFiles');
                return this;
            });

            await readTests_();

            assert.deepEqual(calls, ['applyGrep', 'applyGrep', 'loadFiles', 'loadFiles']);
        });

        it('should load files for all browsers before parsing any', async () => {
            const groupByBrowser = sinon.stub().returns({
                bro1: [],
                bro2: []
            });
            SetsBuilder.prototype.build.resolves({groupByBrowser});

            const calls = [];
            TestParser.prototype.loadFiles.reset();
            TestParser.prototype.loadFiles.callsFake(function() {
                calls.push('loadFiles');
                return this;
            });
            TestParser.prototype.parse.callsFake(() => calls.push('parse'));

            await readTests_();

            assert.deepEqual(calls, ['loadFiles', 'loadFiles', 'parse', 'parse']);
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
                    const reader = TestReader.create(makeConfigStub())
                        .on(Events[event], onEvent);

                    TestParser.prototype.parse.callsFake(function() {
                        this.emit(Events[event], {foo: 'bar'});
                    });

                    await readTests_({reader});

                    assert.calledOnceWith(onEvent, {foo: 'bar'});
                });
            });

            it('should create test skipper', async () => {
                const config = makeConfigStub();

                await readTests_({config});

                assert.calledOnceWith(TestSkipper.create, config);
            });

            it('should share test skipper between all parsers', async () => {
                SetsBuilder.prototype.build.resolves({
                    groupByBrowser: () => ({
                        bro1: [],
                        bro2: []
                    })
                });

                await readTests_();

                assert.calledTwice(TestParser.prototype.applySkip);
                assert.equal(
                    TestParser.prototype.applySkip.firstCall.args[0],
                    TestParser.prototype.applySkip.secondCall.args[0]
                );
            });

            it('should apply grep to test parser', async () => {
                await readTests_({grep: 'foo bar'});

                assert.calledOnceWith(TestParser.prototype.applyGrep, 'foo bar');
            });

            it('should apply all props before loading files', async () => {
                await readTests_();

                assert.callOrder(TestParser.prototype.applySkip, TestParser.prototype.loadFiles);
                assert.callOrder(TestParser.prototype.applyGrep, TestParser.prototype.loadFiles);
            });

            it('should load files before parsing', async () => {
                await readTests_();

                assert.callOrder(TestParser.prototype.loadFiles, TestParser.prototype.parse);
            });
        });
    });
});
