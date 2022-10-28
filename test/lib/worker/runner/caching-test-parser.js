'use strict';

const CachingTestParser = require('lib/worker/runner/caching-test-parser');
const RunnerEvents = require('lib/worker/constants/runner-events');
const TestParser = require('lib/test-reader/mocha-test-parser');
const TestCollection = require('lib/test-collection');
const {makeConfigStub, makeTest} = require('../../../utils');

describe('worker/runner/caching-test-parser', () => {
    const sandbox = sinon.sandbox.create();

    const mkCachingParser_ = (opts = {}) => {
        const config = opts.config || makeConfigStub();
        return CachingTestParser.create(config);
    };

    beforeEach(() => {
        sandbox.stub(TestParser, 'prepare');
        sandbox.stub(TestParser, 'create').returns(Object.create(TestParser.prototype));
        sandbox.stub(TestParser.prototype, 'applyConfigController').returnsThis();
        sandbox.stub(TestParser.prototype, 'loadFiles').resolvesThis();
        sandbox.stub(TestParser.prototype, 'parse').returns([]);
    });

    afterEach(() => sandbox.restore());

    describe('constructor', () => {
        it('should prepare test parser', () => {
            mkCachingParser_();

            assert.calledOnce(TestParser.prepare);
        });
    });

    describe('parse', () => {
        it('should create test parser', async () => {
            const config = makeConfigStub();
            const cachingParser = mkCachingParser_({config});

            await cachingParser.parse({browserId: 'bro'});

            assert.calledOnceWith(TestParser.create, 'bro', config);
        });

        [
            'BEFORE_FILE_READ',
            'AFTER_FILE_READ'
        ].forEach((event) => {
            it(`should passthrough ${event} event from caching test parser`, async () => {
                const onEvent = sinon.spy().named(`on${event}`);
                const cachingParser = mkCachingParser_()
                    .on(RunnerEvents[event], onEvent);

                TestParser.prototype.parse.callsFake(function() {
                    this.emit(RunnerEvents[event], {foo: 'bar'});
                    return [];
                });

                await cachingParser.parse({});

                assert.calledOnceWith(onEvent, {foo: 'bar'});
            });
        });

        it('should apply config controller before loading file', async () => {
            const cachingParser = mkCachingParser_();

            await cachingParser.parse({});

            assert.callOrder(
                TestParser.prototype.applyConfigController,
                TestParser.prototype.loadFiles
            );
        });

        it('should load file', async () => {
            const cachingParser = mkCachingParser_();

            await cachingParser.parse({file: 'some/file.js'});

            assert.calledOnceWith(TestParser.prototype.loadFiles, 'some/file.js');
        });

        it('should load file before parse', async () => {
            const cachingParser = mkCachingParser_();

            await cachingParser.parse({});

            assert.callOrder(
                TestParser.prototype.loadFiles,
                TestParser.prototype.parse
            );
        });

        it('should return parsed tests', async () => {
            const cachingParser = mkCachingParser_();
            const tests = [makeTest(), makeTest()];
            TestParser.prototype.parse.returns(tests);

            const result = await cachingParser.parse({});

            assert.deepEqual(result, tests);
        });

        it('should parse each file in each browser only once', async () => {
            const cachingParser = mkCachingParser_();
            const tests = [makeTest(), makeTest()];
            TestParser.prototype.parse.returns(tests);

            await cachingParser.parse({file: 'some/file.js', browserId: 'bro'});
            const result = await cachingParser.parse({file: 'some/file.js', browserId: 'bro'});

            assert.deepEqual(result, tests);
            assert.calledOnce(TestParser.prototype.parse);
        });

        it('should parse same file in different browsers', async () => {
            const cachingParser = mkCachingParser_();

            await cachingParser.parse({file: 'some/file.js', browserId: 'bro1'});
            await cachingParser.parse({file: 'some/file.js', browserId: 'bro2'});

            assert.calledTwice(TestParser.prototype.parse);
        });

        it('should parse different files in same browser', async () => {
            const cachingParser = mkCachingParser_();

            await cachingParser.parse({file: 'some/file.js', browserId: 'bro'});
            await cachingParser.parse({file: 'other/file.js', browserId: 'bro'});

            assert.calledTwice(TestParser.prototype.parse);
        });

        it('should emit AFTER_TESTS_READ event on parse', async () => {
            const onAfterTestsRead = sinon.spy().named('onAfterTestsRead');
            const cachingParser = mkCachingParser_()
                .on(RunnerEvents.AFTER_TESTS_READ, onAfterTestsRead);

            await cachingParser.parse({});

            assert.calledOnceWith(onAfterTestsRead, sinon.match.instanceOf(TestCollection));
        });

        it('should create test collection with parsed tests', async () => {
            const cachingParser = mkCachingParser_();
            const tests = [makeTest(), makeTest()];
            TestParser.prototype.parse.returns(tests);

            sinon.spy(TestCollection, 'create');

            await cachingParser.parse({browserId: 'bro'});

            assert.calledOnceWith(TestCollection.create, {bro: tests});
        });

        it('should emit AFTER_TESTS_READ event only once for each file in each browser', async () => {
            const onAfterTestsRead = sinon.spy().named('onAfterTestsRead');
            const cachingParser = mkCachingParser_()
                .on(RunnerEvents.AFTER_TESTS_READ, onAfterTestsRead);

            await cachingParser.parse({file: 'some/file.js', browserId: 'bro'});
            await cachingParser.parse({file: 'some/file.js', browserId: 'bro'});

            assert.calledOnce(onAfterTestsRead);
        });

        it('should emit AFTER_TESTS_READ event for the same file in different browsers', async () => {
            const onAfterTestsRead = sinon.spy().named('onAfterTestsRead');
            const cachingParser = mkCachingParser_()
                .on(RunnerEvents.AFTER_TESTS_READ, onAfterTestsRead);

            await cachingParser.parse({file: 'some/file.js', browserId: 'bro1'});
            await cachingParser.parse({file: 'some/file.js', browserId: 'bro2'});

            assert.calledTwice(onAfterTestsRead);
        });

        it('should emit AFTER_TESTS_READ event for different files in the same browser', async () => {
            const onAfterTestsRead = sinon.spy().named('onAfterTestsRead');
            const cachingParser = mkCachingParser_()
                .on(RunnerEvents.AFTER_TESTS_READ, onAfterTestsRead);

            await cachingParser.parse({file: 'some/file.js', browserId: 'bro'});
            await cachingParser.parse({file: 'other/file.js', browserId: 'bro'});

            assert.calledTwice(onAfterTestsRead);
        });
    });
});
