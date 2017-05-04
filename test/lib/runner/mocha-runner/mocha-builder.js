'use strict';

const MochaBuilder = require('../../../../lib/runner/mocha-runner/mocha-builder');
const MochaAdapter = require('../../../../lib/runner/mocha-runner/mocha-adapter');
const RunnerEvents = require('../../../../lib/constants/runner-events');

describe('mocha-runner/mocha-builder', () => {
    const sandbox = sinon.sandbox.create();

    // We can't call constructor because it creates mocha instance inside
    const mkMochaAdapterStub_ = () => Object.create(MochaAdapter.prototype);
    const buildAdapters_ = (paths, opts) => MochaBuilder.create({}).buildAdapters(paths, opts);

    beforeEach(() => {
        sandbox.stub(MochaAdapter.prototype, 'attachTitleValidator').returnsThis();
        sandbox.stub(MochaAdapter.prototype, 'applySkip').returnsThis();
        sandbox.stub(MochaAdapter.prototype, 'loadFiles').returnsThis();
        sandbox.stub(MochaAdapter.prototype, 'run');
    });

    afterEach(() => sandbox.restore());

    describe('buildAdapters', () => {
        beforeEach(() => {
            sandbox.stub(MochaAdapter, 'create').callsFake(() => mkMochaAdapterStub_());
        });

        it('should create mocha instance for each file', () => {
            const mochas = buildAdapters_(['some/file', 'another/file']);

            assert.calledTwice(MochaAdapter.prototype.loadFiles);
            assert.calledWith(MochaAdapter.prototype.loadFiles, ['some/file']);
            assert.calledWith(MochaAdapter.prototype.loadFiles, ['another/file']);

            const mochaInstances = MochaAdapter.prototype.loadFiles.thisValues;
            assert.notStrictEqual(mochaInstances[0], mochaInstances[1]);
            assert.deepEqual(mochas, mochaInstances);
        });

        it('should create one instance if single instance option is present', () => {
            buildAdapters_(['some/file', 'another/file'], {singleInstance: true});

            assert.calledOnceWith(MochaAdapter.prototype.loadFiles, ['some/file', 'another/file']);
            assert.lengthOf(MochaAdapter.prototype.loadFiles.thisValues, 1);
        });

        it('should pass mocha opts to mocha adapter', () => {
            const mochaBuilder = MochaBuilder.create({mochaOpts: {foo: 'bar'}});

            mochaBuilder.buildAdapters(['some/file']);

            assert.calledOnceWith(MochaAdapter.create, {foo: 'bar'});
        });

        it('should share single opts object between all mocha instances', () => {
            MochaBuilder
                .create({mochaOpts: {foo: 'bar'}})
                .buildAdapters(['some/file', 'another/file']);

            assert.strictEqual(
                MochaAdapter.create.firstCall.args[0],
                MochaAdapter.create.secondCall.args[0]
            );
        });

        it('should pass browser agent to mocha adapter', () => {
            const mochaBuilder = MochaBuilder.create({}, {browserId: 'bro'});

            mochaBuilder.buildAdapters(['some/file']);

            assert.calledOnceWith(MochaAdapter.create, sinon.match.any, {browserId: 'bro'});
        });

        it('should pass ctx to mocha adapter', () => {
            const mochaBuilder = MochaBuilder.create({ctx: {foo: 'bar'}});

            mochaBuilder.buildAdapters(['some/file']);

            assert.calledOnceWith(MochaAdapter.create, sinon.match.any, sinon.match.any, {foo: 'bar'});
        });

        it('should share ctx from config between all mocha instances', () => {
            MochaBuilder
                .create({ctx: {foo: 'bar'}})
                .buildAdapters(['some/file', 'another/file']);

            assert.strictEqual(
                MochaAdapter.create.firstCall.args[2],
                MochaAdapter.create.secondCall.args[2]
            );
        });

        it('should skip test using test skipper', () => {
            const testSkipper = {foo: 'bar'};

            MochaBuilder
                .create({}, {}, testSkipper)
                .buildAdapters(['some/file']);

            assert.calledOnceWith(MochaAdapter.prototype.applySkip, testSkipper);
        });

        it('should skip test before file adding', () => {
            buildAdapters_(['some/file']);

            assert.callOrder(
                MochaAdapter.prototype.applySkip,
                MochaAdapter.prototype.loadFiles
            );
        });

        it('should call title validator for each file', () => {
            buildAdapters_(['some/file', 'another/file']);

            assert.calledTwice(MochaAdapter.prototype.attachTitleValidator);
            assert.strictEqual(
                MochaAdapter.prototype.attachTitleValidator.args[0],
                MochaAdapter.prototype.attachTitleValidator.args[0]
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

                    MochaAdapter.prototype.loadFiles.onFirstCall().callsFake(function() {
                        mochaAdapter.emit(event, 'some-data');
                        return this;
                    });

                    const mochaBuilder = MochaBuilder.create({});
                    const spy = sinon.spy();

                    mochaBuilder.on(event, spy);
                    mochaBuilder.buildAdapters(['some/file']);

                    assert.calledOnce(spy);
                    assert.calledWith(spy, 'some-data');
                });
            });
        });
    });
});
