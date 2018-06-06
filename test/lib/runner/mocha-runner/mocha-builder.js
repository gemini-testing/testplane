'use strict';

const BrowserAgent = require('gemini-core').BrowserAgent;
const MochaBuilder = require('../../../../lib/runner/mocha-runner/mocha-builder');
const MochaAdapter = require('../../../../lib/runner/mocha-runner/mocha-adapter');
const RunnerEvents = require('../../../../lib/constants/runner-events');

describe('mocha-runner/mocha-builder', () => {
    const sandbox = sinon.sandbox.create();

    // We can't call constructor because it creates mocha instance inside
    const mkMochaAdapterStub_ = () => Object.create(MochaAdapter.prototype);

    beforeEach(() => {
        sandbox.stub(BrowserAgent, 'create');

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

    describe('buildSingleAdapter', () => {
        it('should pass browser id to mocha adapter', () => {
            const mochaBuilder = MochaBuilder.create('bro', {});

            mochaBuilder.buildSingleAdapter(['some/file']);

            assert.calledWith(MochaAdapter.create, 'bro');
        });

        it('should pass config to mocha adapter', () => {
            const mochaBuilder = MochaBuilder.create(null, {some: 'config'});

            mochaBuilder.buildSingleAdapter();

            assert.calledWith(MochaAdapter.create, sinon.match.any, {some: 'config'});
        });

        it('should skip test using test skipper', () => {
            MochaBuilder
                .create('bro', {}, {test: 'skipper'})
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
