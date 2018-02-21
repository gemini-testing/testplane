'use strict';

const HermioneFacade = require('lib/worker/hermione-facade');
const Hermione = require('lib/worker/hermione');
const RuntimeConfig = require('lib/config/runtime-config');
const Promise = require('bluebird');

describe('worker/hermione-facade', () => {
    const sandbox = sinon.sandbox.create();

    let initCallbackArg;
    let syncCallbackArg;

    const sendMessageToInit = () => {
        const callback = process.on.getCall(0).args[1];
        callback(initCallbackArg);
    };

    const sendMessageToSync = () => {
        const callback = process.on.getCall(1).args[1];
        callback(syncCallbackArg);
    };

    const mkRuntimeConfigStub = () => {
        const config = {extend: sandbox.stub()};

        sandbox.stub(RuntimeConfig, 'getInstance').returns(config);
        return config;
    };

    const mkHermioneStub = () => {
        const hermione = {
            configPath: 'config/path',
            runTest: sandbox.stub(),
            config: {mergeWith: sandbox.stub()}
        };

        sandbox.stub(Hermione, 'create').returns(hermione);
        return hermione;
    };

    beforeEach(() => {
        process.send = sandbox.stub().named('process.send');
        sandbox.stub(process, 'on');
        mkHermioneStub();
        mkRuntimeConfigStub();

        initCallbackArg = {
            event: 'master.init',
            configPath: 'config/path',
            runtimeConfig: {foo: 'runtime', bar: 'config'}
        };
        syncCallbackArg = {
            event: 'master.syncConfig',
            config: {system: {mochaOpts: {grep: 'grep'}}}
        };
    });

    afterEach(() => {
        process.send = undefined;
        sandbox.restore();
    });

    describe('init', () => {
        let hermioneFacade;
        let init;

        beforeEach(() => {
            hermioneFacade = HermioneFacade.create();
            init = sandbox.spy(hermioneFacade, 'init');

            hermioneFacade.init();
        });

        it('should be called only once', () => {
            hermioneFacade.init(); //again

            assert.calledOnce(init);
        });

        it('should send worker.init event', () => {
            return Promise.delay(10).then(() => {
                assert.calledOnceWith(process.send, {event: 'worker.init'});
            });
        });

        it('should subscribe on "message" event', () => {
            return Promise.delay(10).then(() => {
                assert.calledOnceWith(process.on, 'message');
                assert.isFunction(process.on.getCall(0).args[1]);
            });
        });

        describe('process.on "message"', () => {
            let callback;

            beforeEach(() => {
                return Promise.delay(10).then(() => {
                    callback = process.on.getCall(0).args[1];
                });
            });

            it('should not fulfill without "message" event', () => {
                return Promise.delay(50).then(() => {
                    assert.isTrue(hermioneFacade.promise.isPending());
                });
            });

            it('should not fulfill if event is not "master.init"', () => {
                initCallbackArg.event = 'not.master.init';
                callback(initCallbackArg);

                return Promise.delay(50).then(() => {
                    assert.isTrue(hermioneFacade.promise.isPending());
                });
            });

            it('should fulfill with "master.init" event', () => {
                callback(initCallbackArg);

                return Promise.delay(50).then(() => {
                    assert.isTrue(hermioneFacade.promise.isFulfilled());
                });
            });

            it('should extend RuntimeConfig', () => {
                const runtimeConfig = RuntimeConfig.getInstance();

                callback(initCallbackArg);

                return hermioneFacade.promise.then(() => {
                    assert.calledOnceWith(runtimeConfig.extend, {foo: 'runtime', bar: 'config'});
                });
            });

            it('should create Hermione instance', () => {
                callback(initCallbackArg);

                return hermioneFacade.promise.then(() => {
                    assert.calledWith(Hermione.create, 'config/path');
                });
            });
        });
    });

    describe('syncConfig', () => {
        let hermioneFacade;
        let syncConfig;

        beforeEach(() => {
            hermioneFacade = HermioneFacade.create();
            syncConfig = sandbox.spy(hermioneFacade, 'syncConfig');

            hermioneFacade.syncConfig();

            return Promise.delay(10).then(sendMessageToInit);
        });

        it('should be called only once', () => {
            hermioneFacade.syncConfig(); //again

            assert.calledOnce(syncConfig);
        });

        it('should send worker.syncConfig event', () => {
            return Promise.delay(50).then(() => {
                assert.calledWith(process.send, {event: 'worker.syncConfig'});
            });
        });

        it('should subscribe on "message" event', () => {
            return Promise.delay(50).then(() => {
                assert.calledTwice(process.on);
                assert.calledWith(process.on, 'message');
                assert.isFunction(process.on.getCall(1).args[1]);
            });
        });

        describe('process.on "message"', () => {
            let callback;

            beforeEach(() => {
                return Promise.delay(50).then(() => {
                    callback = process.on.getCall(1).args[1];
                });
            });

            it('should not fulfill without "message" event', () => {
                return Promise.delay(50).then(() => {
                    assert.isTrue(hermioneFacade.promise.isPending());
                });
            });

            it('should not fulfill if event is not "master.syncConfig"', () => {
                syncCallbackArg.event = 'not.master.syncConfig';
                callback(syncCallbackArg);

                return Promise.delay(50).then(() => {
                    assert.isTrue(hermioneFacade.promise.isPending());
                });
            });

            it('should fulfill with "master.init" event', () => {
                callback(syncCallbackArg);

                return Promise.delay(50).then(() => {
                    assert.isTrue(hermioneFacade.promise.isFulfilled());
                });
            });

            it('should remove grep and merge hermione\'s config', () => {
                const hermione = Hermione.create();

                callback(syncCallbackArg);

                assert.calledOnceWith(hermione.config.mergeWith, {system: {mochaOpts: {}}});
            });
        });
    });

    describe('runTest', () => {
        let hermioneFacade;
        let syncConfig;

        beforeEach(() => {
            hermioneFacade = HermioneFacade.create();
            syncConfig = sandbox.spy(hermioneFacade, 'syncConfig');
        });

        it('should sync config first', () => {
            hermioneFacade.runTest();

            Promise.delay(10).then(() => assert.called(syncConfig));
        });

        it('should run hermione tests', () => {
            const hermione = Hermione.create();

            process.on.onFirstCall().callsFake(sendMessageToInit);
            process.on.onSecondCall().callsFake(sendMessageToSync);

            return hermioneFacade.runTest('arg1', 'arg2').then(() => {
                assert.calledWith(hermione.runTest, 'arg1', 'arg2');
            });
        });
    });
});
