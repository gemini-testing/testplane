'use strict';

const {assert} = require('chai');
const webdriverio = require('webdriverio');
const {clientBridge} = require('gemini-core');
const {mkExistingBrowser_: mkBrowser_, mkSessionStub_} = require('../../utils');

describe('"getConfig" command', () => {
    const sandbox = sinon.sandbox.create();
    let session;

    beforeEach(() => {
        session = mkSessionStub_();
        sandbox.stub(webdriverio, 'attach').resolves(session);
        sandbox.stub(clientBridge, 'build').resolves();
    });

    afterEach(() => sandbox.restore());

    it('should exist', async () => {
        await mkBrowser_().init();

        assert.isFunction(session.getConfig);
    });

    it('should return object', async () => {
        await mkBrowser_().init();

        const config = session.getConfig();
        assert.isObject(config);
    });

    it('should have desiredCapabilities', async () => {
        await mkBrowser_().init();

        const config = session.getConfig();
        assert.isDefined(config.desiredCapabilities);
        assert.isObject(config.desiredCapabilities);
    });

    it('should have gridUrl', async () => {
        await mkBrowser_().init();

        const config = session.getConfig();
        assert.isString(config.gridUrl);
    });

    it('should have baseUrl', async () => {
        await mkBrowser_().init();

        const config = session.getConfig();
        assert.isString(config.baseUrl);
    });
});
