'use strict';

const EventEmitter = require('events').EventEmitter;

const q = require('q');
const globExtra = require('glob-extra');
const pluginsLoader = require('plugins-loader');

const Hermione = require('../../lib/hermione');
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
            sandbox.stub(pluginsLoader, 'load');
        });

        afterEach(() => sandbox.restore());

        const stubRunner_ = (runFn) => {
            const runner = new EventEmitter();

            runner.run = sandbox.stub(Runner.prototype, 'run', runFn && runFn.bind(null, runner));
            Runner.create.returns(runner);
            return runner;
        };

        const run_ = (opts) => new Hermione(utils.makeConfigStub(opts), {reporters: []}).run();

        describe('load plugins', () => {
            it('should load plugins', () => {
                return run_()
                    .then(() => assert.calledOnce(pluginsLoader.load));
            });

            it('should load plugins for hermione facade instance', () => {
                const config = utils.makeConfigStub();
                const options = {reporters: []};
                const hermione = new Hermione(config, options);
                const runner = stubRunner_();

                return hermione.run()
                    .then(() => assert.calledWith(pluginsLoader.load, new RunnerFacade(runner, config)));
            });

            it('should load plugins from config', () => {
                return run_({plugins: {'some-plugin': true}})
                    .then(() => assert.calledWith(pluginsLoader.load, sinon.match.any, {'some-plugin': true}));
            });

            it('should load plugins with appropriate prefix', () => {
                return run_()
                    .then(() => assert.calledWith(pluginsLoader.load, sinon.match.any, sinon.match.any, 'hermione-'));
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
