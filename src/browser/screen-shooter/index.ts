import makeDebug from "debug";
import { CompositeImage } from "./composite-image";
import { Image, Rect } from "../../image";
import { PrepareScreenshotResult } from "./types";
import { ExistingBrowser } from "../existing-browser";
import { assertCorrectCaptureAreaBounds } from "./validation";
import { AssertViewOpts } from "../../config/types";
import { WdioBrowser } from "../../types";

const debug = makeDebug("testplane:screenshots:screen-shooter");

interface ScreenShooterOpts extends AssertViewOpts {
    debugId?: string;
}

interface CropImageOpts {
    screenshotDelay?: number;
    compositeImage?: boolean;
    selectorToScroll?: string;
}

interface ExtendImageResult {
    hasReachedScrollLimit: boolean;
}

async function getBoundingRect(browser: WdioBrowser, selector: string): Promise<Rect> {
    return browser.execute((selector: string) => {
        const element = document.querySelector(selector);

        if (!element) {
            throw new Error(`Element with selector ${selector} not found`);
        }

        const rect = element.getBoundingClientRect();

        return {
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
        };
    }, selector);
}

export class ScreenShooter {
    private _browser: ExistingBrowser;
    private _lastVerticalScrollOffset: number = -1;
    private _selectorsToCapture: string[] = [];

    static create(browser: ExistingBrowser): ScreenShooter {
        return new this(browser);
    }

    constructor(browser: ExistingBrowser) {
        this._browser = browser;
    }

    async capture(selectors: string[], opts: ScreenShooterOpts = {}): Promise<{ image: Image, meta: PrepareScreenshotResult }> {
        this._selectorsToCapture = selectors;

        const browserPrepareScreenshotDebug = makeDebug("testplane:screenshots:browser:prepareScreenshot");

        const page = await this._browser.prepareScreenshot(selectors, {
            ignoreSelectors: ([] as string[]).concat(opts.ignoreElements ?? []),
            allowViewportOverflow: opts.allowViewportOverflow,
            captureElementFromTop: opts.captureElementFromTop,
            selectorToScroll: opts.selectorToScroll,
            disableAnimation: opts.disableAnimation,
            debug: browserPrepareScreenshotDebug.enabled,
        });

        browserPrepareScreenshotDebug(`[${opts.debugId}] browser logs during prepareScreenshot call:\n${page.debugLog}`);
        delete page.debugLog;

        assertCorrectCaptureAreaBounds(JSON.stringify(selectors), page.viewport, page.captureArea, opts);

        debug(`[${opts.debugId}] prepareScreenshot result: %O`, page);

        const viewportImage = await this._browser.captureViewportImage(page, opts.screenshotDelay);
        const image = CompositeImage.create(page.captureArea, page.safeArea, page.ignoreAreas);
        await image.registerViewportImageAtOffset(viewportImage, { top: page.containerScrollY, left: page.containerScrollX }, page.windowScrollY, page.windowScrollX);

        await this._captureOverflowingAreaIfNeeded(image, page, opts);

        return {
            image: await image.render(),
            meta: page,
        };
    }

    private async _captureOverflowingAreaIfNeeded(
        image: CompositeImage,
        page: PrepareScreenshotResult,
        opts: ScreenShooterOpts,
    ): Promise<void> {
        const COMPOSITE_ITERATIONS_LIMIT = 25;
        let iterations = 0;
        let hasReachedScrollLimit = false;

        while (opts.compositeImage && image.hasNotCapturedArea() && iterations < COMPOSITE_ITERATIONS_LIMIT && !hasReachedScrollLimit) {
            const result = await this._scrollOnceAndExtendImage(image, page, opts);
            hasReachedScrollLimit = result.hasReachedScrollLimit;

            iterations++;
        }
    }

    private async _scrollOnceAndExtendImage(image: CompositeImage, page: PrepareScreenshotResult, opts: ScreenShooterOpts): Promise<ExtendImageResult> {
        const nextNotCapturedArea = image.getNextNotCapturedArea() as Rect;

        const boundingRectBeforeScroll = await getBoundingRect(this._browser.publicAPI, this._selectorsToCapture[0]).catch(() => null);

        const physicalScrollHeight = Math.max(Math.min(nextNotCapturedArea.height, page.safeArea.height), 2 * page.pixelRatio);
        const logicalScrollHeight = Math.ceil(physicalScrollHeight / page.pixelRatio) - 1;
        const logicalScrollOffset = await this._browser.scrollBy({ x: 0, y: logicalScrollHeight, selector: opts.selectorToScroll });

        const boundingRectAfterScroll = await getBoundingRect(this._browser.publicAPI, this._selectorsToCapture[0]).catch(() => null);

        // So, here's we just check that this scroll has worked. We do that by checking if target area client bounding rect has changed.
        // If it didn't, it means that we either reached scroll limit or using wrong selector to scroll altogether.
        if (boundingRectBeforeScroll && boundingRectAfterScroll && boundingRectBeforeScroll.top === boundingRectAfterScroll.top) {
            if (opts.allowViewportOverflow) {
                return { hasReachedScrollLimit: true }; // TODO give this param a better name
            } else {
                throw new Error('Most likely you are using wrong selector to scroll. Make sure it\'s possible to capture the whole area using ');
            }
        }

        const containerScrollOffset = opts.selectorToScroll ? {
            top: logicalScrollOffset.top * page.pixelRatio,
            left: logicalScrollOffset.left * page.pixelRatio,
        } : { top: 0, left: 0 };
        const windowScrollY = opts.selectorToScroll ? page.windowScrollY : logicalScrollOffset.top * page.pixelRatio;
        const windowScrollX = opts.selectorToScroll ? page.windowScrollX : logicalScrollOffset.left * page.pixelRatio;

        if (this._lastVerticalScrollOffset === logicalScrollOffset.top) {
            debug('Reached scroll limit!');

            // TODO: throw an error if allowViewportOverflow is false and some not captured area is left

            return { hasReachedScrollLimit: true };
        }

        debug('Scrolled by %dpx to extend image.\n  nextNotCapturedArea was: %O\n  current container scroll offset: %O\n  current window scroll offset: %O', logicalScrollHeight, nextNotCapturedArea, containerScrollOffset, { windowScrollY, windowScrollX });

        const newImage = await this._browser.captureViewportImage(page, opts.screenshotDelay);

        await image.registerViewportImageAtOffset(newImage, containerScrollOffset, windowScrollY, windowScrollX);

        this._lastVerticalScrollOffset = logicalScrollOffset.top;

        return { hasReachedScrollLimit: false };
    }
}
