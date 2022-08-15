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

    it('should exist', async () => {
        await mkBrowser_().init();

        assert.isFunction(session.getConfig);
    });

    it('should return object', async () => {
        await mkBrowser_().init();

        const browserConfig = session.getConfig();
        assert.isObject(browserConfig);
    });

    it('should have defined desiredCapabilities', async () => {
        await mkBrowser_({
            desiredCapabilities: {
                killProcessByName: true,
                honorSystemProxy: false,
                ensureCleanSession: true
            }
        }).init();

        const browserConfig = session.getConfig();
        assert.isDefined(browserConfig.desiredCapabilities);
        assert.isObject(browserConfig.desiredCapabilities);
        assert.nestedPropertyVal(browserConfig, 'desiredCapabilities.killProcessByName', true);
        assert.nestedPropertyVal(browserConfig, 'desiredCapabilities.honorSystemProxy', false);
        assert.nestedPropertyVal(browserConfig, 'desiredCapabilities.ensureCleanSession', true);
    });

    it('should have defined gridUrl', async () => {
        await mkBrowser_({
            gridUrl: 'http://test_new_host:1234/wd/hub?query=value'
        }).init();

        const browserConfig = session.getConfig();
        assert.equal(browserConfig.gridUrl, 'http://test_new_host:1234/wd/hub?query=value');
    });

    it('should have defined baseUrl', async () => {
        await mkBrowser_({
            baseUrl: 'http://custom_base_url'
        }).init();

        const browserConfig = session.getConfig();
        assert.equal(browserConfig.baseUrl, 'http://custom_base_url');
    });
});
