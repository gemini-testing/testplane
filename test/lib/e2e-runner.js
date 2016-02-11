'use strict';

var E2ERunner = require('../../lib/e2e-runner'),
    MainRunner = require('../../lib/runner'),
    RunnerEvents = require('../../lib/constants/runner-events'),
    utils = require('../utils'),
    EventEmitter = require('events').EventEmitter;

describe('e2e-runner', function() {
    var sandbox = sinon.sandbox.create();

    describe('run', function() {
        beforeEach(function() {
            sandbox.stub(MainRunner, 'create');
            MainRunner.create.returns(sinon.createStubInstance(MainRunner));
        });

        afterEach(function() {
            sandbox.restore();
        });

        function stubMainRunner_(runFn) {
            var mainRunner = new EventEmitter();

            mainRunner.run = sandbox.stub(MainRunner.prototype, 'run', runFn.bind(null, mainRunner));
            MainRunner.create.returns(mainRunner);
        }

        function run_() {
            return new E2ERunner(utils.makeConfigStub())
                .run();
        }

        it('should return true if there are no failed tests', function() {
            return run_()
                .then(function(success) {
                    assert.ok(success);
                });
        });

        it('should return false if there are failed tests', function() {
            stubMainRunner_(function(runner) {
                runner.emit(RunnerEvents.TEST_FAIL);
            });

            return run_()
                .then(function(success) {
                    assert.isFalse(success);
                });
        });

        it('should return false if there were some errors', function() {
            stubMainRunner_(function(runner) {
                runner.emit(RunnerEvents.ERROR);
            });

            return run_()
                .then(function(success) {
                    assert.isFalse(success);
                });
        });
    });
});
