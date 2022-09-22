import Viewport from './viewport';
import HeightViewportError from './viewport/coord-validator/errors/height-viewport-error';

import type Image from '../image';
import type ExistingBrowser from '../../browser/existing-browser';
import type {Page} from '../types/page';

type ImageProcessingOpts = {
    compositeImage?: boolean;
    screenshotDelay?: number;
    selectorToScroll?: string;
};

type ScreenShooterOpts = ImageProcessingOpts & {
    allowViewportOverflow?: boolean;
};

export default class ScreenShooter {
    static create(browser: ExistingBrowser): ScreenShooter {
        return new ScreenShooter(browser);
    }

    constructor(private _browser: ExistingBrowser) {}

    async capture(page: Page, opts: ScreenShooterOpts = {}): Promise<Image> {
        const {allowViewportOverflow, compositeImage, screenshotDelay, selectorToScroll} = opts;
        const viewportOpts = {allowViewportOverflow, compositeImage};
        const cropImageOpts = {screenshotDelay, compositeImage, selectorToScroll};

        const viewportImage = await this._browser.captureViewportImage(page, screenshotDelay);
        const viewport = Viewport.create(page.viewport, viewportImage, page.pixelRatio, viewportOpts);

        return this._cropImage(viewport, page, cropImageOpts);
    }

    private async _cropImage(viewport: Viewport, page: Page, opts: ImageProcessingOpts): Promise<Image> {
        try {
            viewport.validate(page.captureArea, this._browser);
        } catch (e) {
            if (e instanceof HeightViewportError && opts.compositeImage) {
                return this._extendImage(viewport, page, opts);
            }

            throw e;
        }

        viewport.ignoreAreas(page.ignoreAreas);

        return viewport.crop(page.captureArea);
    }

    private async _extendImage(viewport: Viewport, page: Page, opts: ImageProcessingOpts): Promise<Image> {
        const scrollHeight = Math.min(
            viewport.getVerticalOverflow(page.captureArea),
            page.viewport.height
        );

        await this._browser.scrollBy({x: 0, y: scrollHeight, selector: opts.selectorToScroll});
        page.viewport.top += scrollHeight;

        const newImage = await this._browser.captureViewportImage(page, opts.screenshotDelay);

        await viewport.extendBy(scrollHeight, newImage);

        return this._cropImage(viewport, page, opts);
    }
}
