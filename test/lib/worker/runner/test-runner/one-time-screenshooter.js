'use strict';

const _ = require('lodash');
const Promise = require('bluebird');
const fs = require('fs');
const Image = require('lib/core/image');
const ScreenShooter = require('lib/core/screen-shooter');
const temp = require('lib/core/temp');
const OneTimeScreenshooter = require('lib/worker/runner/test-runner/one-time-screenshooter');
const RuntimeConfig = require('lib/config/runtime-config');
const logger = require('lib/utils/logger');
const {mkSessionStub_} = require('../../../browser/utils');

describe('worker/runner/test-runner/one-time-screenshooter', () => {
    const sandbox = sinon.sandbox.create();

    const mkBrowser_ = (opts = {}) => {
        const session = mkSessionStub_();
        return {
            publicAPI: _.extend(session, {
                takeScreenshot: sinon.stub().resolves('base64')
            }, opts),
            evalScript: sinon.stub().named('evalScript').resolves({height: 0, width: 0}),
            prepareScreenshot: sinon.stub().named('prepareScreenshot').resolves(),
            setHttpTimeout: sinon.spy().named('setHttpTimeout'),
            restoreHttpTimeout: sinon.spy().named('restoreHttpTimeout')
        };
    };

    const mkScreenshooter_ = (opts = {}) => {
        const config = _.defaults(opts.config, {
            takeScreenshotOnFails: {
                testFail: true,
                assertViewFail: true
            },
            takeScreenshotOnFailsTimeout: 100500
        });
        const browser = opts.browser || mkBrowser_();

        return OneTimeScreenshooter.create(config, browser);
    };

    const stubImage_ = (size = {width: 100500, height: 500100}) => {
        return {
            getSize: sandbox.stub().named('getSize').returns(size),
            save: sandbox.stub().named('save').resolves()
        };
    };

    beforeEach(() => {
        sandbox.stub(ScreenShooter.prototype, 'capture').resolves(stubImage_());
        sandbox.stub(Image, 'fromBase64').returns(stubImage_());
        sandbox.stub(temp, 'attach').named('attach').returns();
        sandbox.stub(temp, 'path').named('path').returns();
        sandbox.stub(RuntimeConfig, 'getInstance').returns({tempOpts: {}});
        sandbox.stub(logger, 'warn');
        sandbox.stub(fs.promises, 'readFile').resolves(Buffer.from('buffer'));
    });

    afterEach(() => sandbox.restore());

    function testScreenshotCapturing(method, getArgs = () => []) {
        it('should capture viewport screenshot if option "takeScreenshotOnFailsMode" is not set', async () => {
            const browser = mkBrowser_();
            browser.publicAPI.takeScreenshot.resolves('base64');
            const imgStub = stubImage_({width: 100, height: 500});
            Image.fromBase64.returns(imgStub);
            const screenshooter = mkScreenshooter_({browser});

            await screenshooter[method](...getArgs());

            assert.deepEqual(screenshooter.getScreenshot(), {
                base64: 'base64',
                size: {width: 100, height: 500}
            });
        });

        it('should capture viewport screenshot if option "takeScreenshotOnFailsMode" is set to "viewport"', async () => {
            const browser = mkBrowser_();
            browser.publicAPI.takeScreenshot.resolves('base64');
            const imgStub = stubImage_({width: 100, height: 500});
            Image.fromBase64.returns(imgStub);
            const config = {takeScreenshotOnFailsMode: 'viewport'};
            const screenshooter = mkScreenshooter_({browser, config});

            await screenshooter[method](...getArgs());

            assert.deepEqual(screenshooter.getScreenshot(), {
                base64: 'base64',
                size: {width: 100, height: 500}
            });
        });

        it('should capture full page screenshot if option "takeScreenshotOnFailsMode" is set to "fullpage"', async () => {
            const browser = mkBrowser_();
            browser.evalScript.resolves({width: 100, height: 500});
            browser.prepareScreenshot
                .withArgs([{top: 0, left: 0, width: 100, height: 500}], {
                    ignoreSelectors: [],
                    captureElementFromTop: true,
                    allowViewportOverflow: true
                })
                .resolves('page-data');
            const imgStub = stubImage_({width: 100, height: 500});
            ScreenShooter.prototype.capture
                .withArgs('page-data', {
                    compositeImage: true,
                    allowViewportOverflow: true
                })
                .resolves(imgStub);
            RuntimeConfig.getInstance.returns({tempOpts: {some: 'opts'}});
            temp.path
                .withArgs({some: 'opts', suffix: '.png'})
                .returns('some-path');
            fs.promises.readFile
                .withArgs('some-path')
                .resolves(Buffer.from('base64'));
            const config = {takeScreenshotOnFailsMode: 'fullpage'};
            const screenshooter = mkScreenshooter_({browser, config});

            await screenshooter[method](...getArgs());

            assert.calledOnceWith(imgStub.save, 'some-path');
            assert.deepEqual(screenshooter.getScreenshot(), {
                base64: 'YmFzZTY0',
                size: {width: 100, height: 500}
            });
        });

        it('should not try to capture screenshot if it has already taken', async () => {
            const browser = mkBrowser_();
            const screenshooter = mkScreenshooter_({browser});

            await screenshooter[method](...getArgs());
            await screenshooter[method](...getArgs());

            assert.calledOnce(browser.publicAPI.takeScreenshot);
        });

        it('should not try to capture screenshot if already failed to take one', async () => {
            const browser = mkBrowser_();
            browser.publicAPI.takeScreenshot.rejects(new Error('foo'));

            const screenshooter = mkScreenshooter_({browser});

            await screenshooter[method](...getArgs());
            await screenshooter[method](...getArgs());

            assert.calledOnce(browser.publicAPI.takeScreenshot);
        });

        it('should resolve if failed to take screenshot', async () => {
            const browser = mkBrowser_();
            browser.publicAPI.takeScreenshot.rejects(new Error('foo'));

            const screenshooter = mkScreenshooter_({browser});

            await assert.isFulfilled(screenshooter[method](...getArgs()));
        });

        it('should set custom http timeout for screenshot', async () => {
            const config = {takeScreenshotOnFailsTimeout: 15};
            const browser = mkBrowser_();
            const screenshooter = mkScreenshooter_({config, browser});

            await screenshooter[method](...getArgs());

            assert.calledOnceWith(browser.setHttpTimeout, 15);
        });

        it('should restore session http timeout after taking screenshot', async () => {
            const afterScreenshot = sinon.stub().named('afterScreenshot').resolves({});
            const browser = mkBrowser_();
            browser.publicAPI.takeScreenshot.callsFake(() => Promise.delay(10).then(afterScreenshot));

            await mkScreenshooter_({browser})[method](...getArgs());

            assert.calledOnce(browser.restoreHttpTimeout);
            assert.callOrder(afterScreenshot, browser.restoreHttpTimeout);
        });

        it('should restore session http timeout even if failed to take screenshot', async () => {
            const browser = mkBrowser_();
            browser.publicAPI.takeScreenshot.rejects(new Error('foo'));

            await mkScreenshooter_({browser})[method](...getArgs());

            assert.calledOnce(browser.restoreHttpTimeout);
        });

        it('should fail with timeout error on long execution of "screenshot" command', async () => {
            const config = {takeScreenshotOnFailsTimeout: 10};
            const browser = mkBrowser_();
            browser.publicAPI.takeScreenshot.callsFake(() => Promise.delay(20));

            const screenshooter = mkScreenshooter_({config, browser});

            await screenshooter[method](...getArgs());

            assert.calledOnceWith(logger.warn, sinon.match(/timed out after 10 ms/));
        });
    }

    describe('extendWithScreenshot', () => {
        it('should resolve with passed error', async () => {
            const error = new Error();
            const result = await mkScreenshooter_().extendWithScreenshot(error);

            assert.equal(result, error);
        });

        it('should extend passed error with screenshot data', async () => {
            const browser = mkBrowser_();
            browser.publicAPI.takeScreenshot.resolves('base64');
            const screenshooter = mkScreenshooter_({browser});
            Image.fromBase64.withArgs('base64').returns(stubImage_({width: 100, height: 200}));

            const error = await screenshooter.extendWithScreenshot(new Error());

            assert.deepPropertyVal(error, 'screenshot', {base64: 'base64', size: {width: 100, height: 200}});
        });

        it('should not modify error if it already has screenshot', async () => {
            const browser = mkBrowser_();
            const screenshooter = mkScreenshooter_({browser});

            const originalError = new Error();
            originalError.screenshot = 'screenshot';
            await screenshooter.extendWithScreenshot(originalError);

            assert.notCalled(browser.publicAPI.takeScreenshot);
        });

        it('should not modify error if suboption "testFail" is set to false', async () => {
            const screenshooter = mkScreenshooter_({config: {
                takeScreenshotOnFails: {
                    testFail: false
                }
            }});

            const originalError = new Error();
            const error = await screenshooter.extendWithScreenshot(originalError);

            assert.equal(error, originalError);
            assert.notProperty(error, 'screenshot');
        });

        it('should resolve with unmodified error if failed to capture screenshot', async () => {
            const browser = mkBrowser_({
                takeScreenshot: () => Promise.reject(new Error('foo'))
            });
            const screenshooter = mkScreenshooter_({browser});

            const originalError = new Error();
            const error = await screenshooter.extendWithScreenshot(originalError);

            assert.equal(error, originalError);
            assert.notProperty(error, 'screenshot');
        });

        testScreenshotCapturing('extendWithScreenshot', () => [new Error()]);
    });

    describe('captureScreenshotOnAssertViewFail', () => {
        it('should not modify error if suboption "assertViewFail" is set to false', async () => {
            const browser = mkBrowser_();
            const screenshooter = mkScreenshooter_({browser, config: {
                takeScreenshotOnFails: {
                    assertViewFail: false
                }
            }});

            await screenshooter.captureScreenshotOnAssertViewFail();

            assert.notCalled(browser.publicAPI.takeScreenshot);
        });

        testScreenshotCapturing('captureScreenshotOnAssertViewFail');
    });

    describe('getScreenshot', () => {
        it('should return captured screenshot', async () => {
            Image.fromBase64.returns(stubImage_({width: 100, height: 200}));

            const screenshooter = mkScreenshooter_({});

            await screenshooter.captureScreenshotOnAssertViewFail();

            assert.deepEqual(screenshooter.getScreenshot(), {base64: 'base64', size: {width: 100, height: 200}});
        });
    });
});
