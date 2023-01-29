'use strict';

const proxyquire = require('proxyquire');
const {EventEmitter} = require('events');
const _ = require('lodash');
const RuntimeConfig = require('lib/config/runtime-config');
const Events = require('lib/constants/runner-events');
const WorkerProcess = require('lib/utils/worker-process');

describe('WorkersRegistry', () => {
    const sandbox = sinon.sandbox.create();

    let workersImpl, workerFarm;

    const mkWorkersRegistry_ = (config = {}) => {
        config = _.defaults(config, {
            system: {}
        });

        const WorkersRegistry = proxyquire('../../../lib/utils/workers-registry', {'worker-farm': workerFarm});
        const workersRegistry = WorkersRegistry.create(config);
        workersRegistry.init();

        return workersRegistry;
    };

    const initChild_ = () => {
        const {onChild} = workerFarm.firstCall.args[0];

        const child = new EventEmitter();
        child.send = sandbox.stub();
        onChild(child);

        return child;
    };

    beforeEach(() => {
        workersImpl = sandbox.stub().yieldsRight();
        workerFarm = sandbox.stub().returns(workersImpl);

        workerFarm.end = sandbox.stub().yieldsRight();

        sandbox.stub(RuntimeConfig, 'getInstance');
    });

    afterEach(() => sandbox.restore());

    describe('constructor', () => {
        it('should init worker farm', () => {
            mkWorkersRegistry_({system: {
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
                sinon.match('lib/utils/processor.js')
            );
        });

        it('should init worker farm in debug mode', () => {
            RuntimeConfig.getInstance.returns({inspectMode: {inspect: '9229'}});

            mkWorkersRegistry_({
                system: {
                    workers: 100500,
                    testsPerWorker: 500100
                }
            });

            assert.calledOnceWith(workerFarm,
                {
                    workerOptions: {execArgv: ['--inspect=9229']},
                    maxConcurrentWorkers: 1,
                    maxCallsPerWorker: Infinity,
                    maxConcurrentCallsPerWorker: Infinity,
                    autoStart: true,
                    maxRetries: 0,
                    onChild: sinon.match.func
                },
                sinon.match('lib/utils/processor.js')
            );
        });
    });

    describe('communication with worker', () => {
        it('should reply to worker init request', () => {
            RuntimeConfig.getInstance.returns({baz: 'qux'});
            mkWorkersRegistry_({configPath: 'foo/bar'});

            const child = initChild_();

            child.emit('message', {event: 'worker.init'});

            assert.calledOnceWith(child.send, {
                event: 'master.init',
                configPath: 'foo/bar',
                runtimeConfig: {baz: 'qux'}
            });
        });

        it('should reply to worker sync config request', () => {
            mkWorkersRegistry_({
                serialize: () => ({foo: 'bar'})
            });

            const child = initChild_();

            child.emit('message', {event: 'worker.syncConfig'});

            assert.calledOnceWith(child.send, {
                event: 'master.syncConfig',
                config: {foo: 'bar'}
            });
        });

        describe('other events', () => {
            it('should emit one event through workers object', () => {
                const workersRegistry = mkWorkersRegistry_();
                const workers = workersRegistry.register(null, []);
                const child = initChild_();

                const onEvent = sandbox.stub().named('onEvent');
                workers.once('foo', onEvent);
                child.emit('message', {event: 'foo', bar: 'baz'});

                assert.calledOnceWith(onEvent, {bar: 'baz'});
            });

            it('should emit few events sequentially through workers object', () => {
                const workersRegistry = mkWorkersRegistry_();
                const workers = workersRegistry.register(null, []);
                const child = initChild_();

                const onFooEvent = sandbox.stub().named('onFooEvent');
                workers.once('foo', onFooEvent);
                child.emit('message', {event: 'foo', bar: 'baz'});

                const onBarEvent = sandbox.stub().named('onBarEvent');
                workers.once('bar', onBarEvent);
                child.emit('message', {event: 'bar', baz: 'qux'});

                assert.calledOnceWith(onFooEvent, {bar: 'baz'});
                assert.calledOnceWith(onBarEvent, {baz: 'qux'});
            });
        });

        it('should not emit unknown events (without event field) through workers object', () => {
            const workersRegistry = mkWorkersRegistry_();
            const workers = workersRegistry.register(null, []);

            const onEvent = sandbox.stub().named('onEvent');
            workers.on('foo', onEvent);

            const child = initChild_();
            child.emit('message', {foo: 'bar'});

            assert.notCalled(onEvent);
        });
    });

    describe('execute worker\'s method', () => {
        it('should run test in worker', () => {
            const workersRegistry = mkWorkersRegistry_();
            const workers = workersRegistry.register('worker.js', ['runTest']);

            return workers
                .runTest('foo', {bar: 'baz'})
                .then(() => assert.calledOnceWith(workersImpl, 'worker.js', 'runTest', ['foo', {bar: 'baz'}]));
        });
    });

    describe('end', () => {
        it('should end created worker farm', async () => {
            await mkWorkersRegistry_().end();

            assert.calledOnceWith(workerFarm.end, workersImpl);
        });
    });

    describe('isEnded', () => {
        it('should return false when worker farm is not ended', () => {
            const workersRegistry = mkWorkersRegistry_();
            workersRegistry.register('worker.js', ['runTest']);

            assert.isFalse(workersRegistry.isEnded());
        });

        it('should return true when worker farm is ended', async () => {
            const workersRegistry = mkWorkersRegistry_();
            workersRegistry.register('worker.js', ['runTest']);

            await workersRegistry.end();

            assert.isTrue(workersRegistry.isEnded());
        });
    });

    describe('NEW_WORKER_PROCESS event', () => {
        it('should pass a worker process instance', () => {
            const onNewWorkerProcess = sinon.stub().named('onNewWorkerProcess');
            const workersRegistry = mkWorkersRegistry_();
            workersRegistry.on(Events.NEW_WORKER_PROCESS, onNewWorkerProcess);
            const workerProcessStub = sinon.stub().named('workerProcess');
            sinon.stub(WorkerProcess, 'create').returns(workerProcessStub);

            const child = initChild_();

            assert.calledOnceWith(onNewWorkerProcess, workerProcessStub);
            assert.calledOnceWith(WorkerProcess.create, child);
        });
    });
});
