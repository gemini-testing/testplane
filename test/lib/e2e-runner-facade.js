'use strict';

var E2ERunnerFacade = require('../../lib/e2e-runner-facade'),
    RunnerEvents = require('../../lib/constants/runner-events'),
    signalHandler = require('../../lib/signal-handler'),
    utils = require('../utils'),
    QEmitter = require('qemitter'),
    _ = require('lodash');

describe('e2e-runner-facade', function() {
    it('should provide access to passed config', function() {
        var config = utils.makeConfigStub();

        var facade = new E2ERunnerFacade(new QEmitter(), config);

        assert.equal(facade.config, config);
    });

    it('should provide access to events', function() {
        var facade = new E2ERunnerFacade(new QEmitter(), utils.makeConfigStub()),
            expectedEvents = _.extend(_.clone(RunnerEvents), {EXIT: 'exit'});

        assert.deepEqual(facade.events, expectedEvents);
    });

    it('should passthrough all runner events', function() {
        var runner = new QEmitter(),
            facade = new E2ERunnerFacade(runner, utils.makeConfigStub());

        _.forEach(RunnerEvents, function(event, name) {
            var spy = sinon.spy().named(name + ' handler');
            facade.on(event, spy);

            runner.emit(event);

            assert.calledOnce(spy);
        });
    });

    it('should passthrough exit event from signalHandler', function() {
        var facade = new E2ERunnerFacade(new QEmitter(), utils.makeConfigStub()),
            onExit = sinon.spy().named('onExit');

        facade.on('exit', onExit);

        signalHandler.emit('exit');

        assert.calledOnce(onExit);
    });
});
