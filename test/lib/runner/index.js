'use strict';

var q = require('q'),
    EventEmitter = require('events').EventEmitter,
    Runner = require('../../../lib/runner/index'),
    BrowserRunner = require('../../../lib/runner/browser-runner'),
    BrowserPool = require('../../../lib/browser-pool'),

    createConfig_ = require('../../utils').createConfg,

    RunnerEvents = require('../../../lib/constants/runner-events');

describe('Runner', function() {
    var sandbox = sinon.sandbox.create();

    function run_(browserIds) {
        return new Runner(createConfig_(browserIds)).run();
    }

    beforeEach(function() {
        sandbox.stub(BrowserPool.prototype);
        sandbox.stub(BrowserRunner.prototype);

        BrowserRunner.prototype.run.returns(q.resolve());
    });

    afterEach(function() {
        sandbox.restore();
    });

    describe('constructor', function() {
        /*jshint nonew: false */
        it('should create browser pool', function() {
            var config = createConfig_();

            new Runner(config);

            assert.called(BrowserPool.prototype.__constructor, config);
        });

        it('should create browser runners for each browser in config', function() {
            var config = createConfig_(['browser1', 'browser2']);

            new Runner(config);

            assert.calledTwice(BrowserRunner.prototype.__constructor);
            assert.calledWith(BrowserRunner.prototype.__constructor, config, 'browser1');
            assert.calledWith(BrowserRunner.prototype.__constructor, config, 'browser2');
        });
    });

    describe('run', function() {
        it('should emit `RunnerEvents.RUNNER_START` event', function() {
            var onStartRunner = sandbox.spy().named('onStartRunner'),
                runner = new Runner(createConfig_());

            runner.on(RunnerEvents.RUNNER_START, onStartRunner);

            return runner.run()
                .then(function() {
                    assert.called(onStartRunner);
                });
        });

        it('should emit `RunnerEvents.RUNNER_END` event', function() {
            var onEndRunner = sandbox.spy().named('onEndRunner'),
                runner = new Runner(createConfig_());

            runner.on(RunnerEvents.RUNNER_END, onEndRunner);

            return runner.run()
                .then(function() {
                    assert.called(onEndRunner);
                });
        });

        it('should emit events in correct order', function() {
            var onStartRunner = sandbox.spy().named('onStartRunner'),
                onEndRunner = sandbox.spy().named('onEndRunner'),
                runner = new Runner(createConfig_());

            runner.on(RunnerEvents.RUNNER_START, onStartRunner);
            runner.on(RunnerEvents.RUNNER_END, onEndRunner);

            return runner.run()
                .then(function() {
                    assert.callOrder(onStartRunner, onEndRunner);
                });
        });

        it('should run all browser runners', function() {
            return run_(['browser1', 'browser2'])
                .then(function() {
                    assert.calledTwice(BrowserRunner.prototype.run);
                });
        });

        it('should wait until all browser runners will finish', function() {
            var firstResolveMarker = sandbox.stub().named('First resolve marker'),
                secondResolveMarker = sandbox.stub().named('Second resolve marker');

            BrowserRunner.prototype.run.onFirstCall().returns(q.resolve().then(firstResolveMarker));
            BrowserRunner.prototype.run.onSecondCall().returns(q.delay(1).then(secondResolveMarker));

            return run_(['browser1', 'browser2'])
                .then(function() {
                    assert.called(firstResolveMarker);
                    assert.called(secondResolveMarker);
                });
        });

        it('should be rejected if one of browser runners rejected', function() {
            BrowserRunner.prototype.run.returns(q.reject());

            return assert.isRejected(run_());
        });
    });

    it('should passthrough events from browser runners', function() {
        var emitter = new EventEmitter();

        emitter.run = sandbox.stub().returns(q.resolve());
        BrowserRunner.prototype.__constructor.returns(emitter);

        var runner = new Runner(createConfig_()),
            onTestPass = sandbox.spy().named('onTestPass');

        runner.on(RunnerEvents.TEST_PASS, onTestPass);
        runner.run();
        emitter.emit(RunnerEvents.TEST_PASS);

        assert.called(onTestPass);
    });
});
