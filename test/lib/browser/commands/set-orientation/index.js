'use strict';

const webdriverio = require('@gemini-testing/webdriverio');
const {mkExistingBrowser_: mkBrowser_, mkSessionStub_} = require('../../utils');

describe('setOrientation command', () => {
    const sandbox = sinon.sandbox.create();
    let session;

    beforeEach(() => {
        session = mkSessionStub_();
        sandbox.stub(webdriverio, 'remote');
        webdriverio.remote.returns(session);
    });

    afterEach(() => sandbox.restore());

    it('should rewrite base `setOrientation` command', () => {
        mkBrowser_();

        assert.calledWith(session.addCommand, 'setOrientation', sinon.match.func, true);
    });

    it('should not set orientation if it is already set', async () => {
        const baseSetOrientationFn = session.setOrientation;

        mkBrowser_();

        session.getOrientation.resolves('portrait');

        await session.setOrientation('portrait');

        assert.notCalled(baseSetOrientationFn);
    });

    it('should set orientation', async () => {
        const baseSetOrientationFn = session.setOrientation;
        baseSetOrientationFn.resolves('portrait');

        mkBrowser_();

        session.getOrientation.resolves('landscape');

        const orientation = await session.setOrientation('portrait');

        assert.equal(orientation, 'portrait');
        assert.calledOnceWith(baseSetOrientationFn, 'portrait');
    });

    it('should wait for orientation change', async () => {
        mkBrowser_();

        await session.setOrientation('portrait');

        assert.callOrder(session.setOrientation, session.waitUntil);
    });

    it('should wait for orientation change using a timeout from a browser config', async () => {
        mkBrowser_({waitTimeout: 100500});

        await session.setOrientation('portrait');

        assert.calledOnceWith(session.waitUntil, sinon.match.func, 100500, 'Orientation did not changed to \'portrait\' in 100500 ms');
    });
});
