'use strict';

const BrowserAgent = require('../../../../lib/browser-agent');
const MochaAdapter = require('../../../../lib/runner/mocha-runner/mocha-adapter');
const MochaRunner = require('../../../../lib/runner/mocha-runner');
const TestSkipper = require('../../../../lib/runner/test-skipper');
const q = require('q');

describe('mocha-runner', () => {
    const sandbox = sinon.sandbox.create();

    const mochaRunnerInit = () => {
        return new MochaRunner(
            {mochaOpts: {}},
            sinon.createStubInstance(BrowserAgent),
            sinon.createStubInstance(TestSkipper)
        );
    };

    const run_ = (suites, filterFn) => {
        return mochaRunnerInit().run(suites || ['test_suite'], filterFn);
    };

    // We can't call constructor because it creates mocha instance inside
    const mkMochaAdapterStub_ = () => Object.create(MochaAdapter.prototype);

    beforeEach(() => {
        sandbox.stub(MochaAdapter, 'create', () => mkMochaAdapterStub_());

        sandbox.stub(MochaAdapter.prototype, 'addFile').returnsThis();
        sandbox.stub(MochaAdapter.prototype, 'attachTestFilter').returnsThis();
        sandbox.stub(MochaAdapter.prototype, 'attachEmitFn').returnsThis();
        sandbox.stub(MochaAdapter.prototype, 'run').returns(q());
        sandbox.stub(MochaAdapter.prototype, 'applySkip').returnsThis();
    });

    afterEach(() => sandbox.restore());

    describe('run', () => {
        it('should create mocha instance for each file', () => {
            return run_(['path/to/file', 'path/to/other/file'])
                .then(() => {
                    assert.calledTwice(MochaAdapter.prototype.addFile);
                    assert.calledWith(MochaAdapter.prototype.addFile, 'path/to/file');
                    assert.calledWith(MochaAdapter.prototype.addFile, 'path/to/other/file');

                    const mochaInstances = MochaAdapter.prototype.addFile.thisValues;
                    assert.notStrictEqual(mochaInstances[0], mochaInstances[1]);
                });
        });

        it('should share single opts object between all mocha instances', () => {
            return run_(['path/to/file', 'path/to/other/file'])
                .then(() => assert.equal(
                    MochaAdapter.create.firstCall.args[0],
                    MochaAdapter.create.secondCall.args[0]
                ));
        });

        it('should run all mocha instances', () => {
            return run_(['some/file', 'other/file'])
                .then(() => assert.calledTwice(MochaAdapter.prototype.run));
        });

        it('should skip test using test skipper', () => {
            return run_()
                .then(() => assert.calledWith(MochaAdapter.prototype.applySkip, sinon.match.instanceOf(TestSkipper)));
        });

        it('should skip test before file adding', () => {
            return run_()
                .then(() => {
                    assert.callOrder(
                        MochaAdapter.prototype.applySkip,
                        MochaAdapter.prototype.addFile
                    );
                });
        });

        it('should add filter function for tests before file adding', () => {
            return run_()
                .then(() => assert.callOrder(
                    MochaAdapter.prototype.attachTestFilter,
                    MochaAdapter.prototype.addFile
                ));
        });

        it('should create all mocha instances before run any of them', () => {
            MochaAdapter.create.restore();
            MochaAdapter.prototype.run.restore();

            const order = [];
            sandbox.stub(MochaAdapter, 'create', () => {
                order.push('create');
                return mkMochaAdapterStub_();
            });
            sandbox.stub(MochaAdapter.prototype, 'run', () => order.push('run'));

            return run_(['some/file', 'other/file'])
                .then(() => assert.deepEqual(order, ['create', 'create', 'run', 'run']));
        });

        it('should wait until all mocha instances will finish their work', () => {
            const firstResolveMarker = sandbox.stub().named('First resolve marker');
            const secondResolveMarker = sandbox.stub().named('Second resolve marker');

            MochaAdapter.prototype.run.onFirstCall().returns(q().then(firstResolveMarker));
            MochaAdapter.prototype.run.onSecondCall().returns(q.delay(1).then(secondResolveMarker));

            return run_(['path/to/suite', 'path/to/another/suite'])
                .then(() => {
                    assert.called(firstResolveMarker);
                    assert.called(secondResolveMarker);
                });
        });

        it('should be rejected if one of mocha instances rejected on run', () => {
            MochaAdapter.prototype.run.returns(q.reject('Error'));

            return assert.isRejected(run_(), /Error/);
        });
    });
});
