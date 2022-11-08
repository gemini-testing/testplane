'use strict';

const _ = require('lodash');

const Image = require('lib/core/image');
const Viewport = require('lib/core/screen-shooter/viewport');
const CoordValidator = require('lib/core/screen-shooter/viewport/coord-validator');

describe('Viewport', () => {
    const sandbox = sinon.sandbox.create();
    let image;

    const createViewport = (opts = {}) => new Viewport(
        {
            pixelRatio: opts.pixelRatio || 1,
            captureArea: opts.captureArea || {},
            viewport: opts.viewport || {},
            ignoreAreas: opts.ignoreAreas || []
        },
        opts.image || image,
        {allowViewportOverflow: opts.allowViewportOverflow, compositeImage: opts.compositeImage}
    );

    beforeEach(() => {
        image = sandbox.createStubInstance(Image);
        image.getSize.resolves({width: 100500, height: 500100});
    });

    afterEach(() => sandbox.restore());

    describe('validate', () => {
        const validate = (opts) => {
            opts = _.defaults(opts || {}, {
                captureArea: opts.captureArea,
                viewport: opts.viewport,
                allowViewportOverflow: opts.allowViewportOverflow,
                compositeImage: opts.compositeImage,
                browser: 'default-bro'
            });

            const viewport = createViewport(opts);

            return viewport.validate(opts.browser);
        };

        beforeEach(() => {
            sandbox.spy(CoordValidator, 'create');
            sandbox.stub(CoordValidator.prototype, 'validate');
        });

        it('should create coordinates validator with passed browser', () => {
            validate({browser: 'some-browser'});

            assert.calledWith(CoordValidator.create, 'some-browser');
        });

        ['allowViewportOverflow', 'compositeImage'].forEach((option) => {
            it(`should create coordinates validator with passed "${option}" option`, () => {
                validate({browser: 'some-browser', [option]: true});

                assert.calledWith(CoordValidator.create, 'some-browser', sinon.match({[option]: true}));
            });
        });

        it('should validate passed capture area', () => {
            const viewport = {left: 0, top: 0, width: 2, height: 2};
            const captureArea = {left: 1, top: 1, width: 1, height: 1};

            validate({viewport, captureArea});

            assert.calledWith(CoordValidator.prototype.validate, viewport, captureArea);
        });
    });

    describe('ignoreAreas', () => {
        let image;

        beforeEach(() => image = sinon.createStubInstance(Image));

        it('should ignore passed area', async () => {
            const viewport = createViewport({ignoreAreas: [{left: 1, top: 1, width: 10, height: 10}]});

            await viewport.ignoreAreas(image, {left: 0, top: 0, width: 100, height: 100});

            assert.calledOnceWith(image.addClear, {left: 1, top: 1, width: 10, height: 10});
            assert.calledOnceWith(image.applyClear);
        });

        it('should ignore multiple areas', async () => {
            const firstArea = {left: 20, top: 12, width: 12, height: 13};
            const secondArea = {left: 12, top: 42, width: 30, height: 23};
            const viewport = createViewport({ignoreAreas: [firstArea, secondArea]});

            await viewport.ignoreAreas(image, {left: 0, top: 0, width: 100, height: 100});

            assert.calledWith(image.addClear.firstCall, firstArea);
            assert.calledWith(image.addClear.secondCall, secondArea);
            assert.calledOnceWith(image.applyClear);
        });

        it('should consider pixel ratio', async () => {
            const firstArea = {left: 20, top: 12, width: 30, height: 5};
            const secondArea = {left: 12, top: 35, width: 25, height: 15};
            const pixelRatio = 2;
            const viewport = createViewport({
                ignoreAreas: [firstArea, secondArea],
                pixelRatio
            });

            await viewport.ignoreAreas(image, {left: 0, top: 0, width: 100, height: 100});

            assert.calledWith(image.addClear.firstCall, {left: 40, top: 24, width: 60, height: 10});
            assert.calledWith(image.addClear.secondCall, {left: 24, top: 70, width: 50, height: 30});
        });

        describe('should crop ignore area to image area', () => {
            it('inside', async () => {
                const viewport = createViewport({ignoreAreas: [{left: 0, top: 0, width: 1000, height: 1000}]});

                await viewport.ignoreAreas(image, {left: 10, top: 10, width: 100, height: 100});

                assert.calledOnceWith(image.addClear, {left: 0, top: 0, width: 100, height: 100});
            });

            it('top left', async () => {
                const viewport = createViewport({ignoreAreas: [{left: 10, top: 10, width: 1000, height: 1000}]});

                await viewport.ignoreAreas(image, {left: 0, top: 0, width: 100, height: 100});

                assert.calledOnceWith(image.addClear, {left: 10, top: 10, width: 90, height: 90});
            });

            it('top right', async () => {
                const viewport = createViewport({ignoreAreas: [{left: 0, top: 10, width: 100, height: 100}]});

                await viewport.ignoreAreas(image, {left: 50, top: 0, width: 100, height: 100});

                assert.calledOnceWith(image.addClear, {left: 0, top: 10, width: 50, height: 90});
            });

            it('bottom left', async () => {
                const viewport = createViewport({ignoreAreas: [{left: 10, top: 10, width: 100, height: 100}]});

                await viewport.ignoreAreas(image, {left: 0, top: 50, width: 100, height: 100});

                assert.calledOnceWith(image.addClear, {left: 10, top: 0, width: 90, height: 60});
            });

            it('bottom right', async () => {
                const viewport = createViewport({
                    ignoreAreas: [{left: 10, top: 10, width: 100, height: 100}],
                    pixelRatio: 1
                });

                await viewport.ignoreAreas(image, {left: 50, top: 50, width: 100, height: 100});

                assert.calledOnceWith(image.addClear, {left: 0, top: 0, width: 60, height: 60});
            });
        });

        describe('should not clear area if area is outside of image area', () => {
            it('bottom right', async () => {
                const viewport = createViewport({ignoreAreas: [{left: 0, top: 0, width: 30, height: 30}]});

                await viewport.ignoreAreas(image, {left: 50, top: 50, width: 100, height: 100});

                assert.notCalled(image.addClear);
            });

            it ('top left', async () => {
                const viewport = createViewport({ignoreAreas: [{left: 50, top: 50, width: 100, height: 100}]});

                await viewport.ignoreAreas(image, {left: 0, top: 0, width: 40, height: 40});

                assert.notCalled(image.addClear);
            });
        });
    });

    describe('handleImage', () => {
        it('should apply "ignoreAreas" to the image', async () => {
            const vieport = createViewport();
            sandbox.stub(vieport, 'ignoreAreas');

            await vieport.handleImage(image);

            assert.calledOnceWith(vieport.ignoreAreas, image);
        });

        it('should call apply "ignoreAreas" before crop', async () => {
            const vieport = createViewport();
            sandbox.stub(vieport, 'ignoreAreas');

            await vieport.handleImage(image);

            assert.callOrder(vieport.ignoreAreas, image.crop);
        });

        describe('should crop to captureArea', () => {
            beforeEach(() => image.getSize.resolves({width: 7, height: 10}));

            it('with default area', async () => {
                const vieport = createViewport({
                    captureArea: {left: 1, top: 2, width: 3, height: 4},
                    viewport: {left: 0, top: 0, width: 10, height: 10}
                });

                await vieport.handleImage(image);

                assert.calledOnceWith(image.crop, {left: 1, top: 2, width: 3, height: 4});
            });

            it('considering pixel ratio', async () => {
                const vieport = createViewport({
                    captureArea: {left: 1, top: 2, width: 3, height: 4},
                    viewport: {left: 0, top: 0, width: 10, height: 10},
                    pixelRatio: 2
                });

                await vieport.handleImage(image);

                assert.calledOnceWith(image.crop, {left: 2, top: 4, width: 5, height: 8});
            });

            it('with given area', async () => {
                const vieport = createViewport({
                    captureArea: {left: 1, top: 2, width: 3, height: 4},
                    viewport: {left: 0, top: 0, width: 10, height: 10}
                });

                await vieport.handleImage(image, {left: 0, top: 0, width: 7, height: 10});

                assert.calledOnceWith(image.crop, {left: 1, top: 2, width: 3, height: 4});
            });

            it('with top offset', async () => {
                const vieport = createViewport({
                    captureArea: {left: 1, top: 2, width: 3, height: 4},
                    viewport: {left: 0, top: 0, width: 10, height: 10}
                });

                await vieport.handleImage(image, {left: 0, top: 7, width: 7, height: 3});

                assert.calledOnceWith(image.crop, {left: 1, top: 9, width: 3, height: 3});
            });

            it('with negative offsets in captureAreas', async () => {
                const vieport = createViewport({
                    captureArea: {left: -1, top: -2, width: 7, height: 8},
                    viewport: {left: 4, top: 3, width: 10, height: 10}
                });

                await vieport.handleImage(image);

                assert.calledOnceWith(image.crop, {left: 0, top: 0, width: 3, height: 8});
            });
        });
    });

    describe('composite', () => {
        it('should call "applyJoin"', async () => {
            const viewport = createViewport();

            await viewport.composite();

            assert.calledOnce(image.applyJoin);
        });

        it('should return composed image', async () => {
            const viewport = createViewport();

            const newImage = await viewport.composite();

            assert.match(image, newImage);
        });
    });

    describe('save', () => {
        it('should save viewport image', async () => {
            const viewport = createViewport();

            await viewport.save('path/to/img');

            assert.calledWith(image.save, 'path/to/img');
        });
    });

    describe('extendBy', () => {
        let newImage;

        beforeEach(() => {
            newImage = sinon.createStubInstance(Image);

            newImage.crop.resolves();
            newImage.getSize.resolves({});
        });

        it('should increase viewport height value by scroll height', async () => {
            const viewport = createViewport({
                captureArea: {top: 0, height: 7},
                viewport: {top: 0, height: 5}
            });

            await viewport.extendBy(2, newImage);

            assert.equal(viewport.getVerticalOverflow(), 0);
        });

        it('should crop new image by passed scroll height', async () => {
            newImage.getSize.resolves({height: 4, width: 2});
            const viewport = createViewport({
                captureArea: {left: 0, top: 0, width: 4, height: 20},
                viewport: {left: 0, top: 0, width: 4, height: 8},
                pixelRatio: 0.5
            });

            await viewport.extendBy(2, newImage);

            assert.calledWith(newImage.crop, {left: 0, top: 3, width: 2, height: 1});
        });

        it('should join original image with cropped image', async () => {
            const viewport = createViewport();

            await viewport.extendBy(null, newImage);

            assert.calledOnce(newImage.crop);
            assert.calledWith(image.addJoin, newImage);
        });
    });

    describe('getVerticalOverflow', () => {
        it('should get outside height', () => {
            const viewport = createViewport({
                captureArea: {top: 0, height: 15},
                viewport: {top: 0, height: 5}
            });

            assert.equal(viewport.getVerticalOverflow(), 10);
        });
    });
});
