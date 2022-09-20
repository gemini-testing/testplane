'use strict';

const path = require('path');
const fs = require('fs');
const Promise = require('bluebird');
const Image = require('lib/core/image');
const Calibrator = require('lib/core/calibrator');
const {CoreError} = require('lib/core/errors');

describe('calibrator', () => {
    let browser, calibrator;

    const mkBrowser = () => {
        return {
            open: () => {},
            evalScript: () => {},
            captureViewportImage: () => {}
        };
    };

    const setScreenshot = (imageName) => {
        const imgPath = path.join(__dirname, '..', '..', '..', 'fixtures', imageName);
        const imgData = fs.readFileSync(imgPath);

        browser.captureViewportImage.returns(Promise.resolve(new Image(imgData)));
    };

    beforeEach(() => {
        browser = mkBrowser();

        sinon.stub(browser);
        browser.evalScript.returns(Promise.resolve({innerWidth: 984})); // width of viewport in test image
        browser.open.returns(Promise.resolve());

        calibrator = new Calibrator();
    });

    [
        {data: {innerWidth: 984}, name: 'wd'},
        {data: {value: {innerWidth: 984}}, name: 'webdriverio'}
    ].forEach(({data, name}) => {
        it(`should calculate correct crop area for ${name}`, () => {
            setScreenshot('calibrate.png');
            browser.evalScript.returns(Promise.resolve(data));

            const result = calibrator.calibrate(browser);

            return Promise.all([
                assert.eventually.propertyVal(result, 'top', 2),
                assert.eventually.propertyVal(result, 'left', 2)
            ]);
        });
    });

    it('should return also features detected by script', () => {
        setScreenshot('calibrate.png');
        browser.evalScript.returns(Promise.resolve({feature: 'value', innerWidth: 984}));

        const result = calibrator.calibrate(browser);

        return assert.eventually.propertyVal(result, 'feature', 'value');
    });

    it('should not perform the calibration process two times', () => {
        setScreenshot('calibrate.png');

        return calibrator.calibrate(browser)
            .then(() => calibrator.calibrate(browser))
            .then(() => {
                assert.calledOnce(browser.open);
                assert.calledOnce(browser.evalScript);
                assert.calledOnce(browser.captureViewportImage);
            });
    });

    it('should return cached result second time', () => {
        setScreenshot('calibrate.png');

        const result = calibrator.calibrate(browser)
            .then(() => calibrator.calibrate(browser));

        return Promise.all([
            assert.eventually.propertyVal(result, 'top', 2),
            assert.eventually.propertyVal(result, 'left', 2)
        ]);
    });

    it('should fail on broken calibration page', () => {
        setScreenshot('calibrate-broken.png');

        return assert.isRejected(calibrator.calibrate(browser), CoreError);
    });
});
