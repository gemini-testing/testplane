import makeDebug from "debug";
import { CompositeImage } from "./composite-image";
import { Image, Rect } from "../../image";
import { PrepareScreenshotResult } from "./types";
import { ExistingBrowser } from "../existing-browser";

const debug = makeDebug("testplane:screenshots:screen-shooter");

interface ScreenShooterOpts {
    allowViewportOverflow?: boolean;
    compositeImage?: boolean;
    screenshotDelay?: number;
    selectorToScroll?: string;
    debugId?: string;
}

interface CropImageOpts {
    screenshotDelay?: number;
    compositeImage?: boolean;
    selectorToScroll?: string;
}

export class ScreenShooter {
    private _browser: ExistingBrowser;

    static create(browser: ExistingBrowser): ScreenShooter {
        return new this(browser);
    }

    constructor(browser: ExistingBrowser) {
        this._browser = browser;
    }

    async capture(page: PrepareScreenshotResult, opts: ScreenShooterOpts = {}): Promise<Image> {
        const { compositeImage, screenshotDelay, selectorToScroll } = opts;
        const cropImageOpts: CropImageOpts = { screenshotDelay, compositeImage, selectorToScroll };

        const viewportImage = await this._browser.captureViewportImage(page, screenshotDelay);
        const image = CompositeImage.create(page.captureArea, page.safeArea, page.ignoreAreas);
        await image.registerViewportImageAtOffset(viewportImage, { top: page.containerScrollY, left: page.containerScrollX }, page.windowScrollY, page.windowScrollX);

        // await new Promise(resolve => setTimeout(resolve, 100000));

        await this._captureOverflowingAreaIfNeeded(image, page, cropImageOpts);

        return image.render();
    }

    private async _captureOverflowingAreaIfNeeded(
        image: CompositeImage,
        page: PrepareScreenshotResult,
        opts: CropImageOpts,
    ): Promise<void> {
        const COMPOSITE_ITERATIONS_LIMIT = 25;
        let iterations = 0;

        while (opts.compositeImage && image.hasNotCapturedArea() && iterations < COMPOSITE_ITERATIONS_LIMIT) {
            await this._scrollOnceAndExtendImage(image, page, opts);
            iterations++;
        }
    }

    private async _scrollOnceAndExtendImage(image: CompositeImage, page: PrepareScreenshotResult, opts: CropImageOpts): Promise<void> {
        const nextNotCapturedArea = image.getNextNotCapturedArea() as Rect;
        const physicalScrollHeight = Math.min(nextNotCapturedArea.height, page.safeArea.height);
        const logicalScrollHeight = Math.ceil(physicalScrollHeight / page.pixelRatio);
        // debugger;

        const logicalScrollOffset = await this._browser.scrollBy({ x: 0, y: logicalScrollHeight, selector: opts.selectorToScroll });
        const containerScrollOffset = opts.selectorToScroll ? {
            top: logicalScrollOffset.top * page.pixelRatio,
            left: logicalScrollOffset.left * page.pixelRatio,
        } : { top: 0, left: 0 };
        const windowScrollY = opts.selectorToScroll ? page.windowScrollY : logicalScrollOffset.top * page.pixelRatio;
        const windowScrollX = opts.selectorToScroll ? page.windowScrollX : logicalScrollOffset.left * page.pixelRatio;

        debug('Scrolled by %dpx to extend image.\n  nextNotCapturedArea was: %O\n  current container scroll offset: %O\n  current window scroll offset: %O', logicalScrollHeight, nextNotCapturedArea, containerScrollOffset, { windowScrollY, windowScrollX });

        const newImage = await this._browser.captureViewportImage(page, opts.screenshotDelay);

        await image.registerViewportImageAtOffset(newImage, containerScrollOffset, windowScrollY, windowScrollX);
    }
}
