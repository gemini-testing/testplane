'use strict';

const Camera = require('build/core/browser/camera');
const Image = require('build/core/image');
const utils = require('build/core/browser/camera/utils');

describe('browser/camera', () => {
    const sandbox = sinon.sandbox.create();

    beforeEach(() => {
        sandbox.stub(Image, 'fromBase64');
    });

    afterEach(() => sandbox.restore());

    describe('captureViewportImage', () => {
        it('should take screenshot', () => {
            const takeScreenshot = sinon.stub().resolves({foo: 'bar'});
            const camera = Camera.create(null, takeScreenshot);

            Image.fromBase64.withArgs({foo: 'bar'}).returns('foo bar');

            return assert.becomes(camera.captureViewportImage(), 'foo bar');
        });

        describe('crop', () => {
            let image, camera;

            beforeEach(() => {
                image = sinon.createStubInstance(Image);
                Image.fromBase64.returns(image);
            });

            describe('calibration', () => {
                beforeEach(() => {
                    camera = Camera.create(null, sinon.stub().resolves());
                });

                it('should apply calibration on taken screenshot', () => {
                    image.getSize.returns({width: 100, height: 200});

                    camera.calibrate({top: 6, left: 4});

                    return camera.captureViewportImage()
                        .then(() => {
                            assert.calledWith(image.crop, {
                                left: 4,
                                top: 6,
                                width: 100 - 4,
                                height: 200 - 6
                            });
                        });
                });

                it('should not apply calibration if camera is not calibrated', () => {
                    return camera.captureViewportImage()
                        .then(() => assert.notCalled(image.crop));
                });
            });

            describe('crop to viewport', () => {
                const mkCamera_ = (browserOptions) => {
                    const screenshotMode = (browserOptions || {}).screenshotMode || 'auto';
                    return new Camera(screenshotMode, sinon.stub().resolves());
                };

                const page = {
                    viewport: {
                        top: 1,
                        left: 1,
                        width: 100,
                        height: 100
                    }
                };

                beforeEach(() => {
                    sandbox.stub(utils, 'isFullPage');
                });

                it('should not crop to viewport if page disposition was not passed', () => {
                    return mkCamera_().captureViewportImage()
                        .then(() => assert.notCalled(image.crop));
                });

                it('should crop fullPage image with viewport value if page disposition was set', () => {
                    utils.isFullPage.withArgs(image, page, 'fullPage').returns(true);

                    return mkCamera_({screenshotMode: 'fullPage'}).captureViewportImage(page)
                        .then(() => {
                            assert.calledWith(image.crop, page.viewport);
                        });
                });

                it('should crop not fullPage image to the left and right', () => {
                    utils.isFullPage.withArgs(image, page, 'viewport').returns(false);

                    return mkCamera_({screenshotMode: 'viewport'}).captureViewportImage(page)
                        .then(() => {
                            assert.calledWith(image.crop, {
                                top: 0, left: 0,
                                width: page.viewport.width,
                                height: page.viewport.height
                            });
                        });
                });
            });
        });
    });
});
