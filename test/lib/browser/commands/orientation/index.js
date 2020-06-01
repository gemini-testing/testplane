'use strict';

const webdriverio = require('@gemini-testing/webdriverio');
const {mkExistingBrowser_: mkBrowser_, mkSessionStub_} = require('../../utils');

describe('orientation command', () => {
    const sandbox = sinon.sandbox.create();
    let session;

    beforeEach(() => {
        session = mkSessionStub_();
        sandbox.stub(webdriverio, 'remote');
        webdriverio.remote.returns(session);
    });

    afterEach(() => sandbox.restore());

    it('should rewrite base `orientation` command', () => {
        mkBrowser_();

        assert.calledWith(session.addCommand, 'orientation', sinon.match.func, true);
    });

    it('should call base `orientation` command without arguments if arguments are not passed', async () => {
        const baseOrientationFn = session.orientation;

        mkBrowser_();

        await session.orientation();

        assert.equal(baseOrientationFn.lastCall.args.length, 0);
    });

    it('should not throw if orientation does not return current state', async () => {
        const baseOrientationFn = session.orientation;
        baseOrientationFn.resolves({value: null});

        mkBrowser_();

        await assert.isFulfilled(session.orientation('portrait'));
    });

    it('should return current orientation if command was called without arguments', async () => {
        const baseOrientationFn = session.orientation;
        baseOrientationFn.resolves({value: 'portrait'});

        mkBrowser_();

        const orientation = await session.orientation();

        assert.deepEqual(orientation, {value: 'portrait'});
    });

    it('should return orientation if it does not differ from the current one', async () => {
        const baseOrientationFn = session.orientation;
        baseOrientationFn.withArgs('portrait').resolves({value: 'Already in portrait'});

        mkBrowser_();

        const orientation = await session.orientation('portrait');

        assert.deepEqual(orientation, {value: 'Already in portrait'});
    });

    it('should not wait for orientation change if it does not differ from the current one', async () => {
        const baseOrientationFn = session.orientation;
        baseOrientationFn.withArgs('portrait').resolves({value: 'Already in portrait'});

        mkBrowser_();

        await session.orientation('portrait');

        assert.notCalled(session.waitUntil);
    });

    it('should return changed orientation if it differs from the current one', async () => {
        const baseOrientationFn = session.orientation;
        baseOrientationFn.resolves({value: 'portrait'});

        mkBrowser_();

        const orientation = await session.orientation('portrait');

        assert.deepEqual(orientation, {value: 'portrait'});
    });

    it('should not wait for orientation change if option "waitOrientationChange" set to false', async () => {
        const baseOrientationFn = session.orientation;
        baseOrientationFn.resolves({value: 'portrait'});

        mkBrowser_({waitOrientationChange: false});

        await session.orientation('portrait');

        assert.notCalled(session.waitUntil);
    });

    it('should wait for orientation change', async () => {
        const baseOrientationFn = session.orientation;
        baseOrientationFn.resolves({value: 'portrait'});

        mkBrowser_();

        await session.orientation('portrait');

        assert.callOrder(session.orientation, session.waitUntil);
    });

    it('should wait for orientation change using a timeout from a browser config', async () => {
        mkBrowser_({waitTimeout: 100500});

        await session.orientation('portrait');

        assert.calledOnceWith(session.waitUntil, sinon.match.func, 100500, 'Orientation did not changed to \'portrait\' in 100500 ms');
    });
});
