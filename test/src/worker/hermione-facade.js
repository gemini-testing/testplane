'use strict';

const AsyncEmitter = require('src/events/async-emitter');
const Hermione = require('src/worker/hermione');
const {makeConfigStub} = require('../../utils');
const ipc = require('src/utils/ipc');
const HermioneFacade = require('src/worker/hermione-facade');

describe('worker/hermione-facade', () => {
    const sandbox = sinon.createSandbox();
    let hermione;
    let hermioneFacade;

    beforeEach(() => {
        const config = makeConfigStub();

        sandbox.stub(ipc);
        ipc.on.withArgs('master.init').yieldsAsync({runtimeConfig: {}});
        ipc.on.withArgs('master.syncConfig').yieldsAsync({config});

        sandbox.spy(HermioneFacade.prototype, 'syncConfig');

        hermione = Object.assign(new AsyncEmitter(), {
            init: sandbox.spy().named('hermioneInit'),
            config
        });
        sandbox.stub(Hermione, 'create').returns(hermione);

        hermioneFacade = HermioneFacade.create();
    });

    afterEach(() => sandbox.restore());

    describe('init', () => {
        it('should init hermione', async () => {
            await hermioneFacade.init();

            assert.calledOnce(hermione.init);
        });

        it('should not sync config', async () => {
            await hermioneFacade.init();

            assert.notCalled(HermioneFacade.prototype.syncConfig);
        });

        it('should require passed modules', async () => {
            const hermioneFacadeModule = module.children.find(({filename}) => /\/hermione-facade\.js$/.test(filename));
            sandbox.stub(hermioneFacadeModule, 'require');

            ipc.on.withArgs('master.init').yieldsAsync({
                runtimeConfig: {requireModules: ['foo']}
            });

            await hermioneFacade.init();

            assert.calledOnceWith(hermioneFacadeModule.require, 'foo');
        });
    });

    describe('runTest', () => {
        beforeEach(() => {
            hermione.runTest = sandbox.spy().named('hermioneRunTest');
        });

        it('should init hermione before running test', async () => {
            await hermioneFacade.runTest();

            assert.callOrder(hermione.init, hermione.runTest);
        });

        it('should sync config before running test', async () => {
            await hermioneFacade.runTest();

            assert.callOrder(HermioneFacade.prototype.syncConfig, hermione.runTest);
        });
    });
});
