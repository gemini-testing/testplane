import makeDebug from "debug";
import { CompositeImage } from "./composite-image";
import { Image, Rect } from "../../image";
import { PrepareScreenshotResult } from "./types";
import { ExistingBrowser } from "../existing-browser";
import { assertCorrectCaptureAreaBounds } from "./validation";
import { AssertViewOpts } from "../../config/types";
import { findScrollParentAndScrollBy, getBoundingRects } from "./utils";

const debug = makeDebug("testplane:screenshots:screen-shooter");

interface ScreenShooterOpts extends AssertViewOpts {
    debugId?: string;
}

interface ExtendImageResult {
    hasReachedScrollLimit: boolean;
}

interface CaptureImageResult {
    image: Image;
    meta: PrepareScreenshotResult;
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

    async capture(
        selectorOrSectorsArray: string | string[],
        opts: ScreenShooterOpts = {},
    ): Promise<CaptureImageResult> {
        const selectors = ([] as string[]).concat(selectorOrSectorsArray);
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

        browserPrepareScreenshotDebug(
            `[${opts.debugId}] browser logs during prepareScreenshot call:\n${page.debugLog}`,
        );
        delete page.debugLog;

        assertCorrectCaptureAreaBounds(
            JSON.stringify(selectors),
            page.viewport,
            page.viewportOffset,
            page.captureArea,
            opts,
        );

        debug(`[${opts.debugId}] prepareScreenshot result: %O`, page);

        const viewportImage = await this._browser.captureViewportImage(page, opts.screenshotDelay);
        const image = CompositeImage.create(page.captureArea, page.safeArea, page.ignoreAreas);
        await image.registerViewportImageAtOffset(viewportImage, page.scrollElementOffset, page.viewportOffset);

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
        const COMPOSITING_ITERATIONS_LIMIT = 50;
        let iterations = 0;
        let hasReachedScrollLimit = false;

        while (
            opts.compositeImage &&
            image.hasNotCapturedArea() &&
            iterations < COMPOSITING_ITERATIONS_LIMIT &&
            !hasReachedScrollLimit
        ) {
            const result = await this._scrollOnceAndExtendImage(image, page, opts);
            hasReachedScrollLimit = result.hasReachedScrollLimit;

            iterations++;
        }
    }

    private async _scrollOnceAndExtendImage(
        image: CompositeImage,
        page: PrepareScreenshotResult,
        opts: ScreenShooterOpts,
    ): Promise<ExtendImageResult> {
        const nextNotCapturedArea = image.getNextNotCapturedArea() as Rect;

        const boundingRectsBeforeScroll = await getBoundingRects(
            this._browser.publicAPI,
            this._selectorsToCapture,
        ).catch(() => null);

        debug("boundingRectBeforeScroll: %O", boundingRectsBeforeScroll);

        const physicalScrollHeight = Math.max(
            Math.min(nextNotCapturedArea.height, page.safeArea.height),
            2 * page.pixelRatio,
        );
        const logicalScrollHeight = Math.ceil(physicalScrollHeight / page.pixelRatio) - 1;

        const browserScrollByDebug = makeDebug("testplane:screenshots:browser:scrollBy");
        const scrollResult = await findScrollParentAndScrollBy(this._browser.publicAPI, {
            x: 0,
            y: logicalScrollHeight,
            selectorToScroll: opts.selectorToScroll,
            selectorsToCapture: this._selectorsToCapture,
            debug: browserScrollByDebug.enabled,
        });
        const {
            viewportOffset: logicalViewportOffset,
            scrollElementOffset: logicalScrollElementOffset,
            readableSelectorToScrollDescr,
            debugLog,
        } = scrollResult;
        browserScrollByDebug(debugLog);

        const windowOffset = {
            top: logicalViewportOffset.top * page.pixelRatio,
            left: logicalViewportOffset.left * page.pixelRatio,
        };
        const containerOffset = {
            top: logicalScrollElementOffset.top * page.pixelRatio,
            left: logicalScrollElementOffset.left * page.pixelRatio,
        };

        const boundingRectsAfterScroll = await getBoundingRects(
            this._browser.publicAPI,
            this._selectorsToCapture,
        ).catch(() => null);

        debug("boundingRectAfterScroll: %O", boundingRectsAfterScroll);
        const hasReachedScrollLimit =
            (boundingRectsBeforeScroll &&
                boundingRectsAfterScroll &&
                boundingRectsBeforeScroll.length === boundingRectsAfterScroll.length &&
                boundingRectsBeforeScroll.every(
                    (rectBeforeScroll, index) => rectBeforeScroll.top === boundingRectsAfterScroll[index].top,
                )) ||
            this._lastVerticalScrollOffset === windowOffset.top + containerOffset.top;
        debug(
            "have we reached scroll limit? (all bounding rects have the same top values) : %O",
            hasReachedScrollLimit,
        );

        if (hasReachedScrollLimit) {
            if (opts.allowViewportOverflow) {
                return { hasReachedScrollLimit: true };
            } else {
                console.warn(
                    `Warning: when capturing the ${opts.debugId} screenshot, we failed to capture the whole area.\n` +
                        `Here's what happened:\n` +
                        `- you requested to capture the following selectors: ${this._selectorsToCapture.join("; ")}\n` +
                        (opts.selectorToScroll
                            ? `- you requested to scroll the following selector: ${opts.selectorToScroll}`
                            : `- we auto-detected element to scroll ${readableSelectorToScrollDescr} and tried scrolling it\n`) +
                        `- we reached the scroll limit, but weren't able to capture the whole area\n\n` +
                        `Here's what you can do:\n` +
                        `- set allowViewportOverflow to true in assertView options to silence this warning\n` +
                        `- check and adjust selectors that you want to capture or selectorToScroll`,
                );

                return { hasReachedScrollLimit: true };
            }
        }

        debug(
            "Scrolled by %dpx to extend image.\n  nextNotCapturedArea was: %O\n  current container scroll offset: %O\n  current window scroll offset: %O",
            logicalScrollHeight,
            nextNotCapturedArea,
            containerOffset,
            windowOffset,
        );

        const newImage = await this._browser.captureViewportImage(page, opts.screenshotDelay);

        await image.registerViewportImageAtOffset(newImage, containerOffset, windowOffset);

        this._lastVerticalScrollOffset = windowOffset.top + containerOffset.top;

        return { hasReachedScrollLimit: false };
    }
}
