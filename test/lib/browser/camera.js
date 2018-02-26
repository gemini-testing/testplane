'use strict';

const {Image} = require('gemini-core');
const Camera = require('../../../lib/browser/camera');

describe('camera', () => {
    const sandbox = sinon.sandbox.create();
    let session, imageStub;

    const mkCamera = (browser = {publicAPI: session}) => Camera.create(browser);

    beforeEach(() => {
        session = {
            screenshot: sandbox.stub().named('screenshot').resolves({value: 'base64hash'})
        };
        imageStub = {
            getSize: sandbox.stub().named('getSize'),
            crop: sandbox.stub().named('crop')
        };

        sandbox.stub(Image, 'fromBase64').returns(imageStub);
    });

    afterEach(() => sandbox.restore());

    describe('captureViewportImage', () => {
        it('take screenshot', () => {
            const camera = mkCamera();

            return camera.captureViewportImage()
                .then(() => assert.calledOnce(session.screenshot));
        });

        it('should create Image instance from captured screenshot', () => {
            const camera = mkCamera();

            return camera.captureViewportImage()
                .then(() => assert.calledOnceWith(Image.fromBase64, 'base64hash'));
        });

        it('should crop image according to calibration result', () => {
            const camera = mkCamera();
            camera.calibrate({top: 6, left: 4});

            imageStub.getSize.returns({width: 100, height: 200});

            return camera.captureViewportImage()
                .then(() => assert.calledWith(imageStub.crop, {
                    left: 4,
                    top: 6,
                    width: 100 - 4,
                    height: 200 - 6
                }));
        });

        it('should not crop image if camera is not calibrated', () => {
            const camera = mkCamera();

            return camera.captureViewportImage()
                .then((img) => assert.deepEqual(img, imageStub));
        });
    });

    describe('calibration', () => {
        it('should return calibration', () => {
            const camera = mkCamera();

            camera.calibrate({top: 6, left: 4});

            assert.deepEqual(camera.calibration, {top: 6, left: 4});
        });
    });
});
