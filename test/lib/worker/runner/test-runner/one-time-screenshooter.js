'use strict';

const _ = require('lodash');
const Promise = require('bluebird');
const {Image} = require('gemini-core');
const OneTimeScreenshooter = require('lib/worker/runner/test-runner/one-time-screenshooter');
const {mkSessionStub_} = require('../../../browser/utils');

describe('worker/runner/test-runner/one-time-screenshooter', () => {
    const sandbox = sinon.sandbox.create();

    const mkBrowser_ = (opts = {}) => {
        const session = mkSessionStub_();
        return {
            publicAPI: _.extend(session, opts),
            setHttpTimeout: sinon.spy().named('setHttpTimeout'),
            restoreHttpTimeout: sinon.spy().named('restoreHttpTimeout')
        };
    };

    const mkScreenshooter_ = (opts = {}) => {
        const config = _.defaults(opts.config, {
            screenshotOnReject: true,
            screenshotOnRejectTimeout: 100500
        });
        const browser = opts.browser || mkBrowser_();

        return OneTimeScreenshooter.create(config, browser);
    };

    const stubImage_ = (size = {width: 100500, height: 500100}) => {
        return {
            getSize: sandbox.stub().named('getSize').returns(size)
        };
    };

    beforeEach(() => {
        sandbox.stub(Image, 'fromBase64').returns(stubImage_());
    });

    afterEach(() => sandbox.restore());

    describe('extendWithPageScreenshot', () => {
        it('should resolve with passed error', async () => {
            const error = new Error();

            const result = await mkScreenshooter_().extendWithPageScreenshot(error);

            assert.equal(result, error);
        });

        it('should extend passed error with page screenshot data', async () => {
            const browser = mkBrowser_({
                screenshot: () => Promise.resolve({value: 'base64img'})
            });
            const screenshooter = mkScreenshooter_({browser});
            Image.fromBase64.withArgs('base64img').returns(stubImage_({width: 100, height: 200}));

            const error = await screenshooter.extendWithPageScreenshot(new Error());

            assert.deepPropertyVal(error, 'screenshot', {base64: 'base64img', size: {width: 100, height: 200}});
        });

        it('should resolve with unmodified error if failed to take screenshot', async () => {
            const browser = mkBrowser_({
                screenshot: () => Promise.reject(new Error('foo'))
            });
            const screenshooter = mkScreenshooter_({browser});

            const error = new Error();
            const err = await screenshooter.extendWithPageScreenshot(error);

            assert.equal(err, error);
            assert.notProperty(error, 'screenshot');
        });

        it('should not try to take screenshot if error already has screenshot', async () => {
            const error = new Error();
            error.screenshot = 'base64img';

            const browser = mkBrowser_();
            await mkScreenshooter_({browser}).extendWithPageScreenshot(error);

            assert.notCalled(browser.publicAPI.screenshot);
        });

        it('should not try to take screenshot if already took one', async () => {
            const browser = mkBrowser_();
            const screenshooter = mkScreenshooter_({browser});

            await screenshooter.extendWithPageScreenshot(new Error());
            await screenshooter.extendWithPageScreenshot(new Error());

            assert.calledOnce(browser.publicAPI.screenshot);
        });

        it('should not try to take screenshot if already failed to take one', async () => {
            const browser = mkBrowser_({
                screenshot: sinon.stub().rejects(new Error('foo'))
            });
            const screenshooter = mkScreenshooter_({browser});

            const error = new Error();
            await screenshooter.extendWithPageScreenshot(error);
            await screenshooter.extendWithPageScreenshot(error);

            assert.calledOnce(browser.publicAPI.screenshot);
        });

        it('should not try to take screenshot if screenshotOnReject is disabled in config', async () => {
            const config = {screenshotOnReject: false};
            const browser = mkBrowser_();
            const screenshooter = mkScreenshooter_({config, browser});

            await screenshooter.extendWithPageScreenshot(new Error());

            assert.notCalled(browser.publicAPI.screenshot);
        });

        it('should set custom http timeout for screenshot', async () => {
            const config = {screenshotOnRejectTimeout: 15};
            const browser = mkBrowser_();
            const screenshooter = mkScreenshooter_({config, browser});

            await screenshooter.extendWithPageScreenshot(new Error());

            assert.calledOnceWith(browser.setHttpTimeout, 15);
        });

        it('should restore session http timeout after taking screenshot', async () => {
            const afterScreenshot = sinon.stub().named('afterScreenshot').resolves({});
            const browser = mkBrowser_({
                screenshot: () => Promise.delay(10).then(afterScreenshot)
            });

            await mkScreenshooter_({browser}).extendWithPageScreenshot(new Error());

            assert.calledOnce(browser.restoreHttpTimeout);
            assert.callOrder(afterScreenshot, browser.restoreHttpTimeout);
        });

        it('should restore session http timeout even if failed to take screenshot', async () => {
            const browser = mkBrowser_({
                screenshot: () => Promise.reject(new Error())
            });

            await mkScreenshooter_({browser}).extendWithPageScreenshot(new Error());

            assert.calledOnce(browser.restoreHttpTimeout);
        });
    });
});
