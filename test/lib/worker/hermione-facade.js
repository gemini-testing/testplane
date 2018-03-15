'use strict';

const proxyquire = require('proxyquire');
const {AsyncEmitter} = require('gemini-core').events;
const Hermione = require('lib/worker/hermione');
const {makeConfigStub} = require('../../utils');

describe('worker/hermione-facade', () => {
    const sandbox = sinon.createSandbox();
    let HermioneFacade;
    let hermione;
    let config;
    let ipc;

    beforeEach(() => {
        ipc = new AsyncEmitter();
        HermioneFacade = proxyquire('lib/worker/hermione-facade', {
            // TODO: think about how to make it easier
            '../utils/ipc': {on: ipc.on.bind(ipc), emit: ipc.emit.bind(ipc)}
        });

        config = makeConfigStub();

        hermione = Object.assign(new AsyncEmitter(), {
            init: sandbox.spy().named('hermioneInit'),
            config
        });
        sandbox.stub(Hermione, 'create').returns(hermione);

        ipc.on('worker.init', () => {
            process.nextTick(() => ipc.emit('master.init'));
        });
        ipc.on('worker.syncConfig', () => {
            process.nextTick(() => ipc.emit('master.syncConfig', {config}));
        });
    });

    afterEach(() => sandbox.restore());

    it('should init hermione', () => {
        const hermioneFacade = HermioneFacade.create();

        return hermioneFacade.init()
            .then(() => assert.calledOnce(hermione.init));
    });

    it('should init hermione before running tests', () => {
        hermione.runTest = sandbox.spy().named('hermioneRunTest');

        const hermioneFacade = HermioneFacade.create();

        return hermioneFacade.runTest()
            .then(() => assert.callOrder(hermione.init, hermione.runTest));
    });
});
