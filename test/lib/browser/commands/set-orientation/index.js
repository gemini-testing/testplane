'use strict';

const webdriverio = require('webdriverio');
const clientBridge = require('lib/browser/client-bridge');
const {mkExistingBrowser_: mkBrowser_, mkSessionStub_} = require('../../utils');

describe('"setOrientation" command', () => {
    const sandbox = sinon.sandbox.create();
    let session;

    beforeEach(() => {
        session = mkSessionStub_();
        sandbox.stub(webdriverio, 'attach').resolves(session);
        sandbox.stub(clientBridge, 'build').resolves();
    });

    afterEach(() => sandbox.restore());

    it('should not overwrite command `setOrientation` if it does not exist`', async () => {
        session.setOrientation = undefined;

        await mkBrowser_().init();

        assert.neverCalledWith(session.overwriteCommand, 'setOrientation');
    });

    it('should overwrite `setOrientation` command', async () => {
        await mkBrowser_().init();

        assert.calledWith(session.overwriteCommand, 'setOrientation', sinon.match.func);
    });

    it('should not throw if orientation does not return current state', async () => {
        const origSetOrientationFn = session.setOrientation;
        origSetOrientationFn.resolves(null);

        await mkBrowser_().init();

        await assert.isFulfilled(session.setOrientation('portrait'));
    });

    describe('if new orientation does not differ from the current one', () => {
        beforeEach(() => {
            const origSetOrientationFn = session.setOrientation;
            origSetOrientationFn.withArgs('portrait').resolves('Already in portrait');
        });

        it('should return orientation', async () => {
            await mkBrowser_().init();

            const orientation = await session.setOrientation('portrait');

            assert.equal(orientation, 'Already in portrait');
        });

        it('should not wait for orientation change', async () => {
            await mkBrowser_().init();

            await session.setOrientation('portrait');

            assert.notCalled(session.waitUntil);
        });
    });

    it('should return changed orientation if it differs from the current one', async () => {
        const origSetOrientationFn = session.setOrientation;
        origSetOrientationFn.resolves('portrait');
        await mkBrowser_().init();

        const orientation = await session.setOrientation('portrait');

        assert.equal(orientation, 'portrait');
    });

    describe('if option "waitOrientationChange" set to false', () => {
        beforeEach(() => {
            const origSetOrientationFn = session.setOrientation;
            origSetOrientationFn.resolves('portrait');
        });

        it('should not get initial body width', async () => {
            await mkBrowser_({waitOrientationChange: false}).init();

            await session.setOrientation('portrait');

            assert.notCalled(session.execute);
        });

        it('should not wait for orientation change', async () => {
            await mkBrowser_({waitOrientationChange: false}).init();

            await session.setOrientation('portrait');

            assert.notCalled(session.waitUntil);
        });
    });

    it('should wait for orientation change', async () => {
        const origSetOrientationFn = session.setOrientation;
        origSetOrientationFn.resolves('portrait');
        await mkBrowser_().init();

        await session.setOrientation('portrait');

        assert.callOrder(session.setOrientation, session.waitUntil);
    });

    it('should wait for orientation change using a timeout from a browser config', async () => {
        await mkBrowser_({waitTimeout: 100500}).init();

        await session.setOrientation('portrait');

        assert.calledOnceWith(session.waitUntil, sinon.match.func, 100500, 'Orientation did not changed to \'portrait\' in 100500 ms');
    });
});
