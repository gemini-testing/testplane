'use strict';

const _ = require('lodash');
const pluginsLoader = require('plugins-loader');
const q = require('q');
const qUtils = require('qemitter/utils');
const Config = require('../../../lib/config');
const RunnerEvents = require('../../../lib/constants/runner-events');
const WorkerRunnerEvents = require('../../../lib/worker/constants/runner-events');
const Hermione = require('../../../lib/worker/hermione');
const Runner = require('../../../lib/worker/runner');
const makeConfigStub = require('../../utils').makeConfigStub;

describe('worker/hermione', () => {
    const sandbox = sinon.sandbox.create();

    beforeEach(() => {
        sandbox.stub(Config, 'create').returns(makeConfigStub());

        sandbox.stub(pluginsLoader, 'load');

        sandbox.spy(Runner, 'create');
        sandbox.stub(Runner.prototype, 'init');
        sandbox.stub(Runner.prototype, 'runTest');
    });

    afterEach(() => sandbox.restore());

    describe('constructor', () => {
        it('should create a config from the passed path', () => {
            Hermione.create('some-config-path.js');

            assert.calledOnceWith(Config.create, 'some-config-path.js');
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

    describe('init', () => {
        beforeEach(() => {
            sandbox.spy(qUtils, 'passthroughEvent');
        });

        it('should create a runner instance', () => {
            Config.create.returns({some: 'config'});

            Hermione.create().init();

            assert.calledOnceWith(Runner.create, {some: 'config'});
        });

        it('should init a runner instance', () => {
            Hermione.create().init({bro: ['file']});

            assert.calledOnceWith(Runner.prototype.init, {bro: ['file']});
        });

        describe('loading of plugins', () => {
            it('should load plugins', () => {
                Hermione.create().init();

                assert.calledOnce(pluginsLoader.load);
            });

            it('should load plugins for hermione instance', () => {
                Hermione.create().init();

                assert.calledWith(pluginsLoader.load, sinon.match.instanceOf(Hermione));
            });

            it('should load plugins from config', () => {
                Config.create.returns(makeConfigStub({plugins: {'some-plugin': true}}));

                Hermione.create().init();

                assert.calledWith(pluginsLoader.load, sinon.match.any, {'some-plugin': true});
            });

            it('should load plugins with appropriate prefix', () => {
                Hermione.create().init();

                assert.calledWith(pluginsLoader.load, sinon.match.any, sinon.match.any, 'hermione-');
            });

            it('should load plugins before creating of any runner', () => {
                Hermione.create().init();

                assert.callOrder(pluginsLoader.load, Runner.create);
            });
        });

        describe('should passthrough', () => {
            it('all subprocess runner events', () => {
                const hermione = Hermione.create();
                hermione.init();

                const events = [
                    WorkerRunnerEvents.BEFORE_FILE_READ,
                    WorkerRunnerEvents.AFTER_FILE_READ,
                    WorkerRunnerEvents.NEW_BROWSER
                ];

                events.forEach((event, name) => {
                    const spy = sinon.spy().named(`${name} handler`);
                    hermione.on(event, spy);

                    Runner.create.returnValues[0].emit(event);

                    assert.calledOnce(spy);
                });
            });

            it('all subprocess runner event before initialization of a runner', () => {
                const hermione = Hermione.create();
                hermione.init();

                assert.calledOnceWith(qUtils.passthroughEvent, Runner.create.returnValues[0], hermione, [
                    WorkerRunnerEvents.BEFORE_FILE_READ,
                    WorkerRunnerEvents.AFTER_FILE_READ,
                    WorkerRunnerEvents.NEW_BROWSER
                ]);
                assert.callOrder(qUtils.passthroughEvent, Runner.prototype.init);
            });
        });
    });

    describe('runTest', () => {
        it('should run test', () => {
            Runner.prototype.runTest.withArgs('fullTitle', {some: 'options'}).returns(q('foo bar'));

            const hermione = Hermione.create();
            hermione.init();

            return assert.becomes(hermione.runTest('fullTitle', {some: 'options'}), 'foo bar');
        });
    });
});
