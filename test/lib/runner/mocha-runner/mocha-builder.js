'use strict';

const BrowserAgent = require('gemini-core').BrowserAgent;
const MochaBuilder = require('../../../../lib/runner/mocha-runner/mocha-builder');
const MochaAdapter = require('../../../../lib/runner/mocha-runner/mocha-adapter');
const SingleTestMochaAdapter = require('../../../../lib/runner/mocha-runner/single-test-mocha-adapter');
const RunnerEvents = require('../../../../lib/constants/runner-events');

describe('mocha-runner/mocha-builder', () => {
    const sandbox = sinon.sandbox.create();

    // We can't call constructor because it creates mocha instance inside
    const mkMochaAdapterStub_ = () => Object.create(MochaAdapter.prototype);

    beforeEach(() => {
        sandbox.stub(BrowserAgent, 'create');

        sandbox.stub(SingleTestMochaAdapter, 'create').returns({tests: []});

        sandbox.stub(MochaAdapter, 'prepare');
        sandbox.stub(MochaAdapter, 'create').callsFake(() => mkMochaAdapterStub_());
        sandbox.stub(MochaAdapter.prototype, 'applySkip').returnsThis();
        sandbox.stub(MochaAdapter.prototype, 'loadFiles');
    });

    afterEach(() => sandbox.restore());

    describe('prepare', () => {
        it('should prepare mocha adapter', () => {
            MochaBuilder.prepare();

            assert.calledOnce(MochaAdapter.prepare);
        });
    });

    describe('buildAdapters', () => {
        const buildAdapters_ = (paths) => MochaBuilder.create('bro', {}).buildAdapters(paths);

        it('should build single test mocha adapters', () => {
            SingleTestMochaAdapter.create
                .withArgs(sinon.match.instanceOf(MochaAdapter), 'first/file', 0).returns({tests: ['test1']})
                .withArgs(sinon.match.instanceOf(MochaAdapter), 'first/file', 1).returns({tests: ['test2']})
                .withArgs(sinon.match.instanceOf(MochaAdapter), 'second/file', 0).returns({tests: ['test3']});

            assert.deepEqual(buildAdapters_(['first/file', 'second/file']), [
                {tests: ['test1']},
                {tests: ['test2']},
                {tests: ['test3']}
            ]);
        });

        it('should pass config to mocha adapter', () => {
            const mochaBuilder = MochaBuilder.create('bro', {some: 'config'});

            mochaBuilder.buildAdapters(['some/file']);

            assert.calledOnceWith(MochaAdapter.create, sinon.match.any, {some: 'config'});
        });

        it('should share single opts object between all mocha instances', () => {
            MochaBuilder
                .create('bro', {})
                .buildAdapters(['some/file', 'another/file']);

            assert.strictEqual(
                MochaAdapter.create.firstCall.args[0],
                MochaAdapter.create.secondCall.args[0]
            );
        });

        it('should pass browser agent to mocha adapter', () => {
            BrowserAgent.create.withArgs('bro', {browser: 'pool'}).returns({browser: 'agent'});

            const mochaBuilder = MochaBuilder.create('bro', {}, {browser: 'pool'});

            mochaBuilder.buildAdapters(['some/file']);

            assert.calledWith(MochaAdapter.create, {browser: 'agent'});
        });

        it('should share ctx from config between all mocha instances', () => {
            MochaBuilder
                .create('bro', {ctx: {foo: 'bar'}})
                .buildAdapters(['some/file', 'another/file']);

            assert.strictEqual(
                MochaAdapter.create.firstCall.args[2],
                MochaAdapter.create.secondCall.args[2]
            );
        });

        it('should skip test using test skipper', () => {
            MochaBuilder
                .create('bro', {}, {}, {test: 'skipper'})
                .buildAdapters(['some/file']);

            assert.calledWith(MochaAdapter.prototype.applySkip, {test: 'skipper'});
        });

        it('should apply test skipper before test loading', () => {
            buildAdapters_(['some/file']);

            assert.callOrder(
                MochaAdapter.prototype.applySkip,
                SingleTestMochaAdapter.create
            );
        });

        describe('should passthrough events from a mocha instance', () => {
            const events = [
                RunnerEvents.BEFORE_FILE_READ,
                RunnerEvents.AFTER_FILE_READ
            ];

            events.forEach((event) => {
                it(`${event}`, () => {
                    const mochaAdapter = mkMochaAdapterStub_();
                    MochaAdapter.create.returns(mochaAdapter);

                    SingleTestMochaAdapter.create.callsFake(function() {
                        mochaAdapter.emit(event, 'some-data');
                        return {tests: []};
                    });

                    const mochaBuilder = MochaBuilder.create('bro', {});
                    const spy = sinon.spy();

                    mochaBuilder.on(event, spy);
                    mochaBuilder.buildAdapters(['some/file']);

                    assert.calledOnceWith(spy, 'some-data');
                });
            });
        });
    });

    describe('buildSingleAdapter', () => {
        it('should pass browser agent to mocha adapter', () => {
            BrowserAgent.create.withArgs('bro', {browser: 'pool'}).returns({browser: 'agent'});

            const mochaBuilder = MochaBuilder.create('bro', {}, {browser: 'pool'});

            mochaBuilder.buildSingleAdapter(['some/file']);

            assert.calledWith(MochaAdapter.create, {browser: 'agent'});
        });

        it('should pass config to mocha adapter', () => {
            const mochaBuilder = MochaBuilder.create(null, {some: 'config'});

            mochaBuilder.buildSingleAdapter();

            assert.calledWith(MochaAdapter.create, sinon.match.any, {some: 'config'});
        });

        it('should skip test using test skipper', () => {
            MochaBuilder
                .create('bro', {}, {}, {test: 'skipper'})
                .buildSingleAdapter();

            assert.calledWith(MochaAdapter.prototype.applySkip, {test: 'skipper'});
        });

        it('should apply test skipper before files adding', () => {
            MochaBuilder
                .create(null, {})
                .buildSingleAdapter();

            assert.callOrder(
                MochaAdapter.prototype.applySkip,
                MochaAdapter.prototype.loadFiles
            );
        });

        describe('should passthrough events from a mocha instance', () => {
            const events = [
                RunnerEvents.BEFORE_FILE_READ,
                RunnerEvents.AFTER_FILE_READ
            ];

            events.forEach((event) => {
                it(`${event}`, () => {
                    const mochaAdapter = mkMochaAdapterStub_();
                    MochaAdapter.create.returns(mochaAdapter);

                    MochaAdapter.prototype.loadFiles.callsFake(function() {
                        mochaAdapter.emit(event, 'some-data');
                        return this;
                    });

                    const mochaBuilder = MochaBuilder.create(null, {});
                    const spy = sinon.spy();

                    mochaBuilder.on(event, spy);
                    mochaBuilder.buildSingleAdapter();

                    assert.calledOnceWith(spy, 'some-data');
                });
            });
        });
    });
});
