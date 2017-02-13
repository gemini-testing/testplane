'use strict';

const _ = require('lodash');
const q = require('q');
const BrowserAgent = require('../../../../lib/browser-agent');
const MochaAdapter = require('../../../../lib/runner/mocha-runner/mocha-adapter');
const MochaRunner = require('../../../../lib/runner/mocha-runner');
const TestSkipper = require('../../../../lib/runner/test-skipper');

describe('mocha-runner', () => {
    const sandbox = sinon.sandbox.create();

    const mochaRunnerInit = () => {
        return new MochaRunner(
            {system: {mochaOpts: {}, ctx: {}}},
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
        sandbox.stub(MochaAdapter, 'init');
        sandbox.stub(MochaAdapter.prototype, 'addFiles').returnsThis();
        sandbox.stub(MochaAdapter.prototype, 'attachTestFilter').returnsThis();
        sandbox.stub(MochaAdapter.prototype, 'attachTitleValidator').returnsThis();
        sandbox.stub(MochaAdapter.prototype, 'attachEmitFn').returnsThis();
        sandbox.stub(MochaAdapter.prototype, 'run').returns(q());
        sandbox.stub(MochaAdapter.prototype, 'applySkip').returnsThis();
    });

    afterEach(() => sandbox.restore());

    describe('init', () => {
        it('should init mocha adapter', () => {
            MochaRunner.init();

            assert.calledOnce(MochaAdapter.init);
        });
    });

    describe('run', () => {
        beforeEach(() => sandbox.stub(MochaAdapter, 'create', () => mkMochaAdapterStub_()));

        it('should create mocha instance for each file', () => {
            return run_(['path/to/file', 'path/to/other/file'])
                .then(() => {
                    assert.calledTwice(MochaAdapter.prototype.addFiles);
                    assert.calledWith(MochaAdapter.prototype.addFiles, ['path/to/file']);
                    assert.calledWith(MochaAdapter.prototype.addFiles, ['path/to/other/file']);

                    const mochaInstances = MochaAdapter.prototype.addFiles.thisValues;

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

        it('should share a ctx from config between all mocha instances', () => {
            return run_(['path/to/file', 'path/to/other/file'])
                .then(() => assert.equal(
                    MochaAdapter.create.firstCall.args[2],
                    MochaAdapter.create.secondCall.args[2]
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
                        MochaAdapter.prototype.addFiles
                    );
                });
        });

        it('should add filter function for tests before file adding', () => {
            return run_()
                .then(() => assert.callOrder(
                    MochaAdapter.prototype.attachTestFilter,
                    MochaAdapter.prototype.addFiles
                ));
        });

        it('should attach emit function before file adding', () => {
            return run_()
                .then(() => assert.callOrder(
                    MochaAdapter.prototype.attachEmitFn,
                    MochaAdapter.prototype.addFiles
                ));
        });

        it('should call title vaidator for each file', () => {
            return run_(['some/path/file.js', 'other/path/file.js'])
                .then(() => {
                    assert.calledTwice(MochaAdapter.prototype.attachTitleValidator);
                    assert.calledWith(MochaAdapter.prototype.attachTitleValidator, {});
                });
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

    describe('buildSuiteTree', () => {
        beforeEach(() => {
            sandbox.stub(MochaAdapter, 'create').returns(Object.create(MochaAdapter.prototype));
        });

        it('should build suite tree for specified paths', () => {
            const mochaRunner = mochaRunnerInit();

            mochaRunner.buildSuiteTree(['some/path']);

            assert.called(MochaAdapter.create);
            assert.calledWith(MochaAdapter.prototype.addFiles, ['some/path']);
        });

        it('should not filter apply filter function', () => {
            const mochaRunner = mochaRunnerInit();

            mochaRunner.buildSuiteTree(['some/path']);
            assert.calledWith(MochaAdapter.prototype.attachTestFilter, undefined);
        });

        it('should call title validator for passed files', () => {
            const mochaRunner = mochaRunnerInit();
            mochaRunner.buildSuiteTree(['some/path/file1.js', 'other/path/file2.js']);

            assert.calledOnce(MochaAdapter.prototype.attachTitleValidator);
            assert.calledWith(MochaAdapter.prototype.attachTitleValidator, {});
        });

        it('should skip test using test skipper', () => {
            const mochaRunner = mochaRunnerInit();

            mochaRunner.buildSuiteTree(['some/path']);
            assert.calledWith(MochaAdapter.prototype.applySkip, sinon.match.instanceOf(TestSkipper));
        });

        it('should build suite tree if passed specified as string', () => {
            const mochaRunner = mochaRunnerInit();

            mochaRunner.buildSuiteTree('some/path');

            assert.called(MochaAdapter.create);
            assert.calledWith(MochaAdapter.prototype.addFiles, ['some/path']);
        });

        it('should return suite of mocha-adapter', () => {
            const mochaRunner = mochaRunnerInit();
            const suiteStub = sandbox.stub();
            MochaAdapter.create.returns(_.extend(Object.create(MochaAdapter.prototype), {suite: suiteStub}));

            const suiteTree = mochaRunner.buildSuiteTree(['some/path']);
            assert.deepEqual(suiteTree, suiteStub);
        });
    });
});
