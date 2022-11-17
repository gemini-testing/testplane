'use strict';

const Camera = require('lib/browser/camera');
const Image = require('lib/core/image');
const utils = require('lib/browser/camera/utils');

describe('browser/camera', () => {
    const sandbox = sinon.sandbox.create();
    let image;

    beforeEach(() => {
        image = sinon.createStubInstance(Image);
        image.getSize.resolves({width: 100500, height: 500100});
        image.crop.resolves();

        sandbox.stub(Image, 'fromBase64').returns(image);
    });

    afterEach(() => sandbox.restore());

    describe('captureViewportImage', () => {
        it('should take screenshot', () => {
            const takeScreenshot = sinon.stub().resolves({foo: 'bar'});
            const camera = Camera.create(null, takeScreenshot);

            Image.fromBase64.withArgs({foo: 'bar'}).returns(image);

            return assert.becomes(camera.captureViewportImage(), image);
        });

        describe('crop', () => {
            describe('calibration', () => {
                it('should apply calibration on taken screenshot', async () => {
                    const camera = Camera.create(null, sinon.stub().resolves());
                    image.getSize.resolves({width: 10, height: 10});

                    camera.calibrate({top: 6, left: 4});
                    await camera.captureViewportImage();

                    assert.calledOnceWith(image.crop, {
                        left: 4,
                        top: 6,
                        width: 10 - 4,
                        height: 10 - 6
                    });
                });
            });

            describe('crop to viewport', () => {
                let page;

                const mkCamera_ = (browserOptions) => {
                    const screenshotMode = (browserOptions || {}).screenshotMode || 'auto';
                    return new Camera(screenshotMode, sinon.stub().resolves());
                };

                beforeEach(() => {
                    sandbox.stub(utils, 'isFullPage');

                    page = {
                        pixelRatio: 1,
                        viewport: {
                            left: 1,
                            top: 1,
                            width: 100,
                            height: 100
                        }
                    };
                });

                it('should not crop to viewport if page disposition was not passed', async () => {
                    await mkCamera_().captureViewportImage();

                    assert.notCalled(image.crop);
                });

                it('should crop fullPage image with viewport value if page disposition was set', async () => {
                    utils.isFullPage.returns(true);

                    await mkCamera_({screenshotMode: 'fullPage'}).captureViewportImage(page);

                    assert.calledOnceWith(image.crop, page.viewport);
                });

                it('should crop not fullPage image to the left and right', async () => {
                    utils.isFullPage.returns(false);

                    await mkCamera_({screenshotMode: 'viewport'}).captureViewportImage(page);

                    assert.calledOnceWith(image.crop, {
                        left: 0, top: 0,
                        height: page.viewport.height,
                        width: page.viewport.width
                    });
                });

                it('should crop considering pixel ratio', async () => {
                    utils.isFullPage.returns(true);

                    const scaledPage = {
                        pixelRatio: 2,
                        viewport: {left: 2, top: 3, width: 10, height: 12}
                    };

                    await mkCamera_({screenshotMode: 'fullPage'}).captureViewportImage(scaledPage);

                    assert.calledOnceWith(image.crop, {left: 4, top: 6, width: 20, height: 24});
                });
            });
        });
    });
});
