'use strict';

const _ = require('lodash');
const pluginsLoader = require('plugins-loader');
const q = require('q');
const Config = require('lib/config');
const RunnerEvents = require('lib/constants/runner-events');
const WorkerRunnerEvents = require('lib/worker/constants/runner-events');
const Hermione = require('lib/worker/hermione');
const Runner = require('lib/worker/runner');
const makeConfigStub = require('../../utils').makeConfigStub;

describe('worker/hermione', () => {
    const sandbox = sinon.sandbox.create();

    beforeEach(() => {
        sandbox.stub(Config, 'create').returns(makeConfigStub());

        sandbox.stub(pluginsLoader, 'load');

        sandbox.spy(Runner, 'create');
        sandbox.stub(Runner.prototype, 'runTest');
    });

    afterEach(() => sandbox.restore());

    describe('constructor', () => {
        it('should create a config from the passed path', () => {
            Hermione.create('some-config-path.js');

            assert.calledOnceWith(Config.create, 'some-config-path.js');
        });

        it('should create a runner instance', () => {
            Config.create.returns({some: 'config'});

            Hermione.create();

            assert.calledOnceWith(Runner.create, {some: 'config'});
        });

        it('should passthrough all runner events', () => {
            const hermione = Hermione.create();

            [
                WorkerRunnerEvents.BEFORE_FILE_READ,
                WorkerRunnerEvents.AFTER_FILE_READ,
                WorkerRunnerEvents.NEW_BROWSER
            ].forEach((event, name) => {
                const spy = sinon.spy().named(`${name} handler`);
                hermione.on(event, spy);

                Runner.create.returnValues[0].emit(event);

                assert.calledOnce(spy);
            });
        });

        describe('loading of plugins', () => {
            it('should load plugins', () => {
                Hermione.create();

                assert.calledOnce(pluginsLoader.load);
            });

            it('should load plugins for hermione instance', () => {
                Hermione.create();

                assert.calledWith(pluginsLoader.load, sinon.match.instanceOf(Hermione));
            });

            it('should load plugins from config', () => {
                Config.create.returns(makeConfigStub({plugins: {'some-plugin': true}}));

                Hermione.create();

                assert.calledWith(pluginsLoader.load, sinon.match.any, {'some-plugin': true});
            });

            it('should load plugins with appropriate prefix', () => {
                Hermione.create();

                assert.calledWith(pluginsLoader.load, sinon.match.any, sinon.match.any, 'hermione-');
            });
        });
    });

    describe('should provide access to', () => {
        it('hermione events', () => {
            const expectedEvents = _.extend({}, RunnerEvents, WorkerRunnerEvents);

            assert.deepEqual(Hermione.create(makeConfigStub()).events, expectedEvents);
        });

        it('hermione configuration', () => {
            const config = {foo: 'bar'};

            Config.create.returns(config);

            assert.deepEqual(Hermione.create().config, config);
        });
    });

    describe('runTest', () => {
        it('should run test', () => {
            Runner.prototype.runTest.withArgs('fullTitle', {some: 'options'}).returns(q('foo bar'));

            const hermione = Hermione.create();

            return hermione.runTest('fullTitle', {some: 'options'})
                .then((result) => assert.equal(result, 'foo bar'));
        });
    });

    describe('isWorker', () => {
        it('should return "true"', () => {
            const hermione = Hermione.create();

            assert.isTrue(hermione.isWorker());
        });
    });
});
