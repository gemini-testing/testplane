'use strict';

const webdriverio = require('webdriverio');
const {mkExistingBrowser_: mkBrowser_, mkSessionStub_} = require('../../utils');

describe('"getConfig" command', () => {
    const sandbox = sinon.sandbox.create();
    let session;

    beforeEach(() => {
        session = mkSessionStub_();
        sandbox.stub(webdriverio, 'attach').resolves(session);
    });

    afterEach(() => sandbox.restore());

    it('should return object', async () => {
        await mkBrowser_().init();

        assert.isFunction(session.getConfig);
        const browserConfig = session.getConfig();
        assert.isObject(browserConfig);
    });

    it('should have defined baseUrl', async () => {
        await mkBrowser_({
            baseUrl: 'http://custom_base_url'
        }).init();

        const browserConfig = session.getConfig();
        assert.equal(browserConfig.baseUrl, 'http://custom_base_url');
    });
});
