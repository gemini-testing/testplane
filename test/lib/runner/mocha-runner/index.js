'use strict';

var BrowserAgent = require('../../../../lib/browser-agent'),
    MochaAdapter = require('../../../../lib/runner/mocha-runner/mocha-adapter'),
    MochaRunner = require('../../../../lib/runner/mocha-runner'),
    q = require('q');

describe('mocha-runner', function() {
    var sandbox = sinon.sandbox.create();

    function run_(suites, filterFn) {
        return new MochaRunner(
            {mochaOpts: {}},
            sinon.createStubInstance(BrowserAgent)
        ).run(suites || ['test_suite'], filterFn);
    }

    beforeEach(function() {
        sandbox.stub(MochaAdapter.prototype);
        MochaAdapter.prototype.addFile.returnsThis();
        MochaAdapter.prototype.attachTestFilter.returnsThis();
        MochaAdapter.prototype.attachEmitFn.returnsThis();
    });

    afterEach(function() {
        sandbox.restore();
    });

    describe('run', function() {
        it('should create mocha instance for each file', function() {
            return run_(['path/to/file', 'path/to/other/file'])
                .then(function() {
                    assert.calledTwice(MochaAdapter.prototype.__constructor);
                    assert.calledWith(MochaAdapter.prototype.addFile, 'path/to/file');
                    assert.calledWith(MochaAdapter.prototype.addFile, 'path/to/other/file');

                    var mochaInstances = MochaAdapter.prototype.addFile.thisValues;
                    assert.notEqual(mochaInstances[0], mochaInstances[1]);
                });
        });

        it('should share single opts object between all mocha instances', function() {
            return run_(['path/to/file', 'path/to/other/file'])
                .then(function() {
                    assert.equal(
                        MochaAdapter.prototype.__constructor.firstCall.args[0],
                        MochaAdapter.prototype.__constructor.secondCall.args[0]
                    );
                });
        });

        it('should run all mocha instances', function() {
            return run_(['some/file', 'other/file'])
                .then(function() {
                    assert.calledTwice(MochaAdapter.prototype.run);
                });
        });

        it('should create all mocha instances before run any of them', function() {
            MochaAdapter.prototype.__constructor.restore();
            MochaAdapter.prototype.run.restore();

            var order = [];
            sandbox.stub(MochaAdapter.prototype, '__constructor', function() {
                order.push('constructor');
            });
            sandbox.stub(MochaAdapter.prototype, 'run', function() {
                order.push('run');
            });

            return run_(['some/file', 'other/file'])
                .then(function() {
                    assert.deepEqual(order, ['constructor', 'constructor', 'run', 'run']);
                });
        });

        it('should wait until all mocha instances will finish their work', function() {
            var firstResolveMarker = sandbox.stub().named('First resolve marker'),
                secondResolveMarker = sandbox.stub().named('Second resolve marker');

            MochaAdapter.prototype.run.onFirstCall().returns(q().then(firstResolveMarker));
            MochaAdapter.prototype.run.onSecondCall().returns(q.delay(1).then(secondResolveMarker));

            return run_(['path/to/suite', 'path/to/another/suite'])
                .then(function() {
                    assert.called(firstResolveMarker);
                    assert.called(secondResolveMarker);
                });
        });

        it('should be rejected if one of mocha instances rejected on run', function() {
            MochaAdapter.prototype.run.returns(q.reject('Error'));

            return assert.isRejected(run_(), /Error/);
        });
    });
});
