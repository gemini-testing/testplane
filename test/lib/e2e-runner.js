'use strict';

var E2ERunner = require('../../lib/e2e-runner'),
    MainRunner = require('../../lib/runner'),
    RunnerEvents = require('../../lib/constants/runner-events'),
    plugins = require('../../lib/plugins'),
    RunnerFacade = require('../../lib/e2e-runner-facade'),
    utils = require('../utils'),
    EventEmitter = require('events').EventEmitter;

describe('e2e-runner', function() {
    var sandbox = sinon.sandbox.create();

    describe('run', function() {
        beforeEach(function() {
            sandbox.stub(MainRunner, 'create');
            MainRunner.create.returns(sinon.createStubInstance(MainRunner));

            sandbox.stub(plugins);
        });

        afterEach(function() {
            sandbox.restore();
        });

        function stubMainRunner_(runFn) {
            var mainRunner = new EventEmitter();

            mainRunner.run = sandbox.stub(MainRunner.prototype, 'run', runFn && runFn.bind(null, mainRunner));
            MainRunner.create.returns(mainRunner);
            return mainRunner;
        }

        function run_() {
            return new E2ERunner(utils.makeConfigStub())
                .run();
        }

        describe('load plugins', function() {
            it('should load plugins', function() {
                return run_()
                    .then(function() {
                        assert.calledWith(plugins.load, sinon.match.instanceOf(RunnerFacade));
                    });
            });

            it('should create facade with runner and config', function() {
                var config = utils.makeConfigStub(),
                    e2eRunner = new E2ERunner(config),
                    mainRunner = stubMainRunner_();

                sandbox.stub(RunnerFacade.prototype, '__constructor');

                return e2eRunner.run()
                    .then(function() {
                        assert.calledWith(RunnerFacade.prototype.__constructor, mainRunner, config);
                    });
            });
        });

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
