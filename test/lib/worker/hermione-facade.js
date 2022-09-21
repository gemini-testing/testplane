'use strict';

const proxyquire = require('proxyquire').noCallThru();
const AsyncEmitter = require('build/core/events/async-emitter');
const Hermione = require('build/worker/hermione');
const {makeConfigStub} = require('../../utils');

describe('worker/hermione-facade', () => {
    const sandbox = sinon.createSandbox();
    let HermioneFacade;
    let hermione;
    let config;
    let runtimeConfig;
    let ipc;

    const proxyquireHermione_ = (modules) => {
        return proxyquire('build/worker/hermione-facade', {
            // TODO: think about how to make it easier
            '../utils/ipc': {on: ipc.on.bind(ipc), emit: ipc.emit.bind(ipc)},
            ...modules
        });
    };

    beforeEach(() => {
        ipc = new AsyncEmitter();
        HermioneFacade = proxyquireHermione_();
        sandbox.spy(HermioneFacade.prototype, 'syncConfig');

        config = makeConfigStub();
        runtimeConfig = {};

        hermione = Object.assign(new AsyncEmitter(), {
            init: sandbox.spy().named('hermioneInit'),
            config
        });
        sandbox.stub(Hermione, 'create').returns(hermione);

        ipc.on('worker.init', () => {
            process.nextTick(() => ipc.emit('master.init', {runtimeConfig}));
        });
        ipc.on('worker.syncConfig', () => {
            process.nextTick(() => ipc.emit('master.syncConfig', {config}));
        });
    });

    afterEach(() => sandbox.restore());

    describe('init', () => {
        it('should init hermione', () => {
            const hermioneFacade = HermioneFacade.create();

            return hermioneFacade.init()
                .then(() => assert.calledOnce(hermione.init));
        });

        it('should not sync config', () => {
            const hermioneFacade = HermioneFacade.create();

            return hermioneFacade.init()
                .then(() => assert.notCalled(HermioneFacade.prototype.syncConfig));
        });

        // TODO: implement correct check that module was required
        it.skip('should require passed modules', async () => {
            runtimeConfig = {requireModules: ['foo']};
            const fooRequire = sandbox.stub().returns({});

            HermioneFacade = proxyquireHermione_({
                foo: fooRequire()
            });
            const hermioneFacade = HermioneFacade.create();

            await hermioneFacade.init();

            assert.calledOnce(fooRequire);
        });
    });

    describe('runTest', () => {
        beforeEach(() => {
            hermione.runTest = sandbox.spy().named('hermioneRunTest');
        });

        it('should init hermione before running test', () => {
            const hermioneFacade = HermioneFacade.create();

            return hermioneFacade.runTest()
                .then(() => assert.callOrder(hermione.init, hermione.runTest));
        });

        it('should sync config before running test', () => {
            const hermioneFacade = HermioneFacade.create();

            return hermioneFacade.runTest()
                .then(() => assert.callOrder(HermioneFacade.prototype.syncConfig, hermione.runTest));
        });
    });
});
