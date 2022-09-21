'use strict';

const SimpleTestParser = require('build/worker/runner/sequence-test-parser');
const RunnerEvents = require('build/worker/constants/runner-events');
const TestParser = require('build/test-reader/mocha-test-parser');
const {makeConfigStub, makeTest} = require('../../../utils');

describe('worker/runner/simple-test-parser', () => {
    const sandbox = sinon.sandbox.create();

    const mkSimpleParser_ = (opts = {}) => {
        const config = opts.config || makeConfigStub();
        return SimpleTestParser.create(config);
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
            mkSimpleParser_();

            assert.calledOnce(TestParser.prepare);
        });

        it('should not create test parser', () => {
            mkSimpleParser_();

            assert.notCalled(TestParser.create);
        });
    });

    describe('parse', () => {
        it('should create test parser', async () => {
            const config = makeConfigStub();
            const simpleParser = mkSimpleParser_({config});

            await simpleParser.parse({browserId: 'bro'});

            assert.calledOnceWith(TestParser.create, 'bro', config);
        });

        [
            'BEFORE_FILE_READ',
            'AFTER_FILE_READ'
        ].forEach((event) => {
            it(`should passthrough ${event} event from inner test parser`, async () => {
                const onEvent = sinon.spy().named(`on${event}`);
                const simpleParser = mkSimpleParser_()
                    .on(RunnerEvents[event], onEvent);

                TestParser.prototype.parse.callsFake(function() {
                    this.emit(RunnerEvents[event], {foo: 'bar'});
                    return [];
                });

                await simpleParser.parse({});

                assert.calledOnceWith(onEvent, {foo: 'bar'});
            });
        });

        it('should apply config controller before loading file', async () => {
            const simpleParser = mkSimpleParser_();

            await simpleParser.parse({});

            assert.callOrder(
                TestParser.prototype.applyConfigController,
                TestParser.prototype.loadFiles
            );
        });

        it('should load file', async () => {
            const simpleParser = mkSimpleParser_();

            await simpleParser.parse({file: 'some/file.js'});

            assert.calledOnceWith(TestParser.prototype.loadFiles, 'some/file.js');
        });

        it('should load file before parse', async () => {
            const simpleParser = mkSimpleParser_();

            await simpleParser.parse({});

            assert.callOrder(
                TestParser.prototype.loadFiles,
                TestParser.prototype.parse
            );
        });

        it('should return parsed tests', async () => {
            const simpleParser = mkSimpleParser_();
            const tests = [makeTest(), makeTest()];
            TestParser.prototype.parse.returns(tests);

            const result = await simpleParser.parse({});

            assert.deepEqual(result, tests);
        });
    });
});
