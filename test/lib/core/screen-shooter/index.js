'use strict';

const Image = require('lib/core/image');
const ScreenShooter = require('lib/core/screen-shooter');
const Viewport = require('lib/core/screen-shooter/viewport');

describe('screen-shooter', () => {
    const sandbox = sinon.sandbox.create();

    beforeEach(() => {
        sandbox.spy(Viewport, 'create');
        sandbox.stub(Viewport.prototype, 'crop');
        sandbox.stub(Viewport.prototype, 'ignoreAreas');
        sandbox.spy(Viewport.prototype, 'extendBy');
    });

    afterEach(() => sandbox.restore());

    describe('capture', () => {
        let browser;

        const stubPage = (page) => Object.assign({viewport: {}, captureArea: {}}, page);
        const capture = (page, opts) => ScreenShooter.create(browser).capture(stubPage(page), opts);

        beforeEach(() => {
            browser = {
                config: {},
                captureViewportImage: sandbox.stub().resolves(),
                scrollBy: sandbox.stub().resolves()
            };
        });

        it('should take vieport image', () => {
            return capture({viewport: 'foo', captureArea: 'bar'})
                .then(() => assert.calledOnceWith(browser.captureViewportImage, sinon.match({viewport: 'foo', captureArea: 'bar'})));
        });

        describe('should create Viewport instance', () => {
            it('with viewport data', async () => {
                await capture({viewport: 'foo'});

                assert.calledOnceWith(Viewport.create, 'foo');
            });

            it('with viewport image', async () => {
                browser.captureViewportImage.resolves({bar: 'baz'});

                await capture();

                assert.calledOnceWith(Viewport.create, sinon.match.any, {bar: 'baz'});
            });

            it('with pixelRatio data', async () => {
                await capture({pixelRatio: 'qux'});

                assert.calledOnceWith(Viewport.create, sinon.match.any, sinon.match.any, 'qux');
            });

            ['allowViewportOverflow', 'compositeImage'].forEach((option) => {
                it(`with passed "${option}" option`, async () => {
                    await capture({}, {[option]: true});

                    assert.calledOnceWith(
                        Viewport.create, sinon.match.any, sinon.match.any, sinon.match.any, sinon.match({[option]: true})
                    );
                });
            });
        });

        it('should pass screenshotDelay from options to captureViewportImage', async () => {
            await capture(stubPage(), {screenshotDelay: 2000});

            assert.calledWithMatch(browser.captureViewportImage, sinon.match.any, 2000);
        });

        it('should crop image of passed size', () => {
            return capture({captureArea: {foo: 'bar'}})
                .then(() => assert.calledOnceWith(Viewport.prototype.crop, {foo: 'bar'}));
        });

        it('should clear configured ignore areas', () => {
            return capture({ignoreAreas: {foo: 'bar'}})
                .then(() => assert.calledWith(Viewport.prototype.ignoreAreas, {foo: 'bar'}));
        });

        it('should return croped image', () => {
            Viewport.prototype.crop.resolves({foo: 'bar'});

            return assert.becomes(capture(), {foo: 'bar'});
        });

        describe('if validation fails', () => {
            describe('with NOT `HeightViewportError`', () => {
                it('should not crop image', () => {
                    return capture({captureArea: {top: -1}})
                        .catch(() => assert.notCalled(Viewport.prototype.crop));
                });
            });

            describe('with `HeightViewportError`', () => {
                it('should not crop image if "compositeImage" is switched off', async () => {
                    try {
                        await capture({captureArea: {height: 7}, viewport: {top: 0, height: 5}}, {compositeImage: false});
                    } catch (err) {
                        assert.notCalled(Viewport.prototype.crop);
                    }
                });

                describe('option "compositeImage" is switched on', () => {
                    let image;

                    beforeEach(() => {
                        image = sinon.createStubInstance(Image);
                        image.crop.resolves({});
                        image.getSize.returns({});
                        image.save.resolves();

                        browser.captureViewportImage.resolves(image);
                    });

                    it('should scroll vertically if capture area is higher then viewport', async () => {
                        const page = {captureArea: {top: 0, height: 7}, viewport: {top: 0, height: 5}};

                        await capture(page, {compositeImage: true});

                        assert.calledOnceWith(browser.scrollBy, {x: 0, y: 2, selector: undefined});
                    });

                    it('should scroll vertically relative to the passed "selectorToScroll" option', async () => {
                        const page = {captureArea: {top: 0, height: 7}, viewport: {top: 0, height: 5}};

                        await capture(page, {compositeImage: true, selectorToScroll: '.some-elem'});

                        assert.calledOnceWith(browser.scrollBy, {x: 0, y: 2, selector: '.some-elem'});
                    });

                    it('should scroll vertically until the end of capture area', async () => {
                        const page = {captureArea: {top: 0, height: 11}, viewport: {top: 0, height: 5}};

                        await capture(page, {compositeImage: true});

                        assert.calledTwice(browser.scrollBy);
                        assert.calledWith(browser.scrollBy, {x: 0, y: 5, selector: undefined});
                        assert.calledWith(browser.scrollBy, {x: 0, y: 1, selector: undefined});
                    });

                    it('should capture scrolled viewport image', async () => {
                        const page = {captureArea: {top: 0, height: 7}, viewport: {top: 0, height: 5}};

                        await capture(page, {compositeImage: true});

                        assert.calledWithMatch(browser.captureViewportImage, {viewport: {top: 2}});
                    });

                    // Test does not fairly check that `captureViewportImage` was called after resolving of `scrollBy`
                    it('should capture viewport image after scroll', async () => {
                        const page = {captureArea: {top: 0, height: 7}, viewport: {top: 0, height: 5}};
                        const scrolledPage = {captureArea: {top: 0, height: 7}, viewport: {top: 2, height: 5}};

                        const captureViewportImage = browser.captureViewportImage.withArgs(scrolledPage).named('captureViewportImage');
                        const scroll = browser.scrollBy.withArgs({x: 0, y: 2, selector: undefined}).named('scroll');

                        await capture(page, {compositeImage: true});

                        assert.callOrder(scroll, captureViewportImage);
                    });

                    it('should extend original image by scrolled viewport image', async () => {
                        const page = {captureArea: {top: 0, height: 7}, viewport: {top: 0, height: 5}};
                        const scrolledPage = {captureArea: {top: 0, height: 7}, viewport: {top: 2, height: 5}};
                        const scrolledViewportScreenshot = image;

                        browser.captureViewportImage.withArgs(scrolledPage).returns(Promise.resolve(scrolledViewportScreenshot));

                        await capture(page, {compositeImage: true});

                        assert.calledOnceWith(Viewport.prototype.extendBy, 2, scrolledViewportScreenshot);
                    });

                    it('should crop capture area which is higher then viewport', async () => {
                        const page = {captureArea: {top: 0, height: 7}, viewport: {top: 0, height: 5}};

                        await capture(page, {compositeImage: true});

                        assert.calledOnceWith(Viewport.prototype.crop, page.captureArea);
                    });

                    it('should clear configured ignore areas', async () => {
                        await capture({ignoreAreas: {foo: 'bar'}}, {compositeImage: true});

                        assert.calledWith(Viewport.prototype.ignoreAreas, {foo: 'bar'});
                    });

                    it('should return cropped image', () => {
                        Viewport.prototype.crop.resolves('foo bar');

                        return assert.becomes(capture(), 'foo bar');
                    });
                });
            });
        });
    });
});
