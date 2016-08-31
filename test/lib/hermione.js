'use strict';

const EventEmitter = require('events').EventEmitter;

const q = require('q');
const globExtra = require('glob-extra');

const Hermione = require('../../lib/hermione');
const plugins = require('../../lib/plugins');
const Runner = require('../../lib/runner');
const RunnerEvents = require('../../lib/constants/runner-events');
const RunnerFacade = require('../../lib/hermione-facade');
const utils = require('../utils');

describe('hermione', () => {
    const sandbox = sinon.sandbox.create();

    describe('run', () => {
        beforeEach(() => {
            sandbox.stub(Runner, 'create');
            Runner.create.returns(sinon.createStubInstance(Runner));

            sandbox.stub(globExtra, 'expandPaths').returns(q([]));

            sandbox.stub(plugins);
        });

        afterEach(() => sandbox.restore());

        const stubRunner_ = (runFn) => {
            const runner = new EventEmitter();

            runner.run = sandbox.stub(Runner.prototype, 'run', runFn && runFn.bind(null, runner));
            Runner.create.returns(runner);
            return runner;
        };

        const run_ = () => new Hermione(utils.makeConfigStub()).run();

        describe('load plugins', () => {
            it('should load plugins', () => {
                return run_()
                    .then(() => {
                        assert.calledWith(plugins.load, sinon.match.instanceOf(RunnerFacade));
                    });
            });

            it('should create facade with runner and config', () => {
                const config = utils.makeConfigStub();
                const hermione = new Hermione(config);
                const runner = stubRunner_();

                sandbox.stub(RunnerFacade.prototype, '__constructor');

                return hermione.run()
                    .then(() => {
                        assert.calledWith(RunnerFacade.prototype.__constructor, runner, config);
                    });
            });
        });

        it('should return true if there are no failed tests', () => {
            return run_()
                .then((success) => assert.ok(success));
        });

        it('should return false if there are failed tests', () => {
            stubRunner_((runner) => {
                runner.emit(RunnerEvents.TEST_FAIL);
            });

            return run_()
                .then((success) => assert.isFalse(success));
        });

        it('should return false if there were some errors', () => {
            stubRunner_((runner) => runner.emit(RunnerEvents.ERROR));

            return run_()
                .then((success) => assert.isFalse(success));
        });
    });
});
