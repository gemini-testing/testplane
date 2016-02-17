'use strict';

var Hermione = require('../../lib/hermione'),
    Runner = require('../../lib/runner'),
    RunnerEvents = require('../../lib/constants/runner-events'),
    plugins = require('../../lib/plugins'),
    RunnerFacade = require('../../lib/hermione-facade'),
    utils = require('../utils'),
    EventEmitter = require('events').EventEmitter;

describe('hermione', function() {
    var sandbox = sinon.sandbox.create();

    describe('run', function() {
        beforeEach(function() {
            sandbox.stub(Runner, 'create');
            Runner.create.returns(sinon.createStubInstance(Runner));

            sandbox.stub(plugins);
        });

        afterEach(function() {
            sandbox.restore();
        });

        function stubRunner_(runFn) {
            var runner = new EventEmitter();

            runner.run = sandbox.stub(Runner.prototype, 'run', runFn && runFn.bind(null, runner));
            Runner.create.returns(runner);
            return runner;
        }

        function run_() {
            return new Hermione(utils.makeConfigStub())
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
                    hermione = new Hermione(config),
                    runner = stubRunner_();

                sandbox.stub(RunnerFacade.prototype, '__constructor');

                return hermione.run()
                    .then(function() {
                        assert.calledWith(RunnerFacade.prototype.__constructor, runner, config);
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
            stubRunner_(function(runner) {
                runner.emit(RunnerEvents.TEST_FAIL);
            });

            return run_()
                .then(function(success) {
                    assert.isFalse(success);
                });
        });

        it('should return false if there were some errors', function() {
            stubRunner_(function(runner) {
                runner.emit(RunnerEvents.ERROR);
            });

            return run_()
                .then(function(success) {
                    assert.isFalse(success);
                });
        });
    });
});
