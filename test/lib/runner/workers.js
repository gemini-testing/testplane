'use strict';

const proxyquire = require('proxyquire');
const {EventEmitter} = require('events');
const _ = require('lodash');
const RuntimeConfig = require('lib/config/runtime-config');

describe('Workers', () => {
    const sandbox = sinon.sandbox.create();

    let workersImpl, workerFarm;

    const mkWorkers_ = (config = {}) => {
        config = _.defaults(config, {
            system: {}
        });

        const Workers = proxyquire('../../../lib/runner/workers', {'@gemini-testing/worker-farm': workerFarm});

        return Workers.create(config);
    };

    beforeEach(() => {
        workersImpl = {
            runTest: sandbox.stub().yields()
        };

        workerFarm = sandbox.stub().returns(workersImpl);
        workerFarm.end = sandbox.stub();

        sandbox.stub(RuntimeConfig, 'getInstance');
    });

    afterEach(() => sandbox.restore());

    describe('constructor', () => {
        it('should init worker farm', () => {
            mkWorkers_({system: {
                workers: 100500,
                testsPerWorker: 500100
            }});

            assert.calledOnceWith(workerFarm,
                {
                    maxConcurrentWorkers: 100500,
                    maxCallsPerWorker: 500100,
                    maxConcurrentCallsPerWorker: Infinity,
                    autoStart: true,
                    maxRetries: 0,
                    onChild: sinon.match.func
                },
                sinon.match('lib/worker/index.js'),
                ['runTest']
            );
        });
    });

    describe('communication with worker', () => {
        const initChild_ = () => {
            const {onChild} = workerFarm.firstCall.args[0];

            const child = new EventEmitter();
            child.send = sandbox.stub();
            onChild(child);

            return child;
        };

        it('should reply to worker init request', () => {
            RuntimeConfig.getInstance.returns({baz: 'qux'});
            mkWorkers_({configPath: 'foo/bar'});

            const child = initChild_();

            child.emit('message', {event: 'worker.init'});

            assert.calledOnceWith(child.send, {
                event: 'master.init',
                configPath: 'foo/bar',
                runtimeConfig: {baz: 'qux'}
            });
        });

        it('should reply to worker sync config request', () => {
            mkWorkers_({
                serialize: () => ({foo: 'bar'})
            });

            const child = initChild_();

            child.emit('message', {event: 'worker.syncConfig'});

            assert.calledOnceWith(child.send, {
                event: 'master.syncConfig',
                config: {foo: 'bar'}
            });
        });
    });

    describe('runTest', () => {
        it('should run test in worker', () => {
            return mkWorkers_()
                .runTest('foo', {bar: 'baz'})
                .then(() => assert.calledOnceWith(workersImpl.runTest, 'foo', {bar: 'baz'}));
        });
    });

    describe('end', () => {
        it('should end created worker farm', () => {
            mkWorkers_().end();

            assert.calledOnceWith(workerFarm.end, workersImpl);
        });
    });
});
