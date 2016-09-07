'use strict';

const q = require('q');
const Browser = require('../../../lib/browser');
const BasicPool = require('../../../lib/browser-pool/basic-pool');
const browserWithId = require('../../utils').browserWithId;

describe('Unlimited pool', () => {
    const sandbox = sinon.sandbox.create();

    let browser;
    let config;
    let pool;

    const requestBrowser = () => pool.getBrowser('id');

    beforeEach(() => {
        browser = sandbox.stub(browserWithId('id'));
        browser.init.returns(q(browser));
        browser.quit.returns(q(browser));

        sandbox.stub(Browser, 'create').returns(browser);

        config = {
            browsers: {
                id: {
                    desiredCapabilities: {browserName: 'id'}
                }
            }
        };

        pool = new BasicPool(config);
    });

    afterEach(() => sandbox.restore());

    it('should create new browser when requested', () => {
        return requestBrowser()
            .then(() => assert.calledWith(Browser.create, config));
    });

    it('should init a browser', () => {
        return requestBrowser()
            .then(() => assert.calledOnce(browser.init));
    });

    it('should quit a browser when freed', () => {
        return requestBrowser()
            .then((browser) => pool.freeBrowser(browser))
            .then(() => assert.calledOnce(browser.quit));
    });

    it('should reject browser initiation after termination', () => {
        pool.terminate();

        return assert.isRejected(requestBrowser());
    });
});
