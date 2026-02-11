import makeDebug from "debug";
import { CompositeImage } from "./composite-image";
import { Image, Rect } from "../../image";
import { PrepareScreenshotResult } from "./types";
import { ExistingBrowser } from "../existing-browser";
import { assertCorrectCaptureAreaBounds } from "./validation";
import type { AssertViewOpts } from "../../config/types";
import { findScrollParentAndScrollBy, getBoundingRects } from "./utils";
import { runWithoutHistory } from "../history";
import { runInEachDisplayedIframe } from "./iframe-utils";
import { NEW_ISSUE_LINK } from "../../constants/help";

const debug = makeDebug("testplane:screenshots:screen-shooter");
const pointerDebug = makeDebug("testplane:screenshots:browser:pointer");

interface ScreenShooterOpts extends AssertViewOpts {
    debugId?: string;
}

interface PrepareScreenshotOpts {
    ignoreSelectors?: string[];
    allowViewportOverflow?: boolean;
    captureElementFromTop?: boolean;
    selectorToScroll?: string;
    disableAnimation?: boolean;
    disableHover?: AssertViewOpts["disableHover"];
    compositeImage?: boolean;
    debug?: boolean;
    usePixelRatio?: boolean;
}

interface ClientBridgeErrorData {
    errorCode: string;
    message: string;
}

const isClientBridgeErrorData = (data: unknown): data is ClientBridgeErrorData => {
    return Boolean(data && (data as ClientBridgeErrorData).errorCode && (data as ClientBridgeErrorData).message);
};

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
    private _relativeRestorePointerPosition: { x: number; y: number } | null = null;

    static create(browser: ExistingBrowser): ScreenShooter {
        return new this(browser);
    }

    constructor(browser: ExistingBrowser) {
        this._browser = browser;
    }

    async capture(
        selectorsOrAreas: string | string[] | Rect | Rect[],
        opts: ScreenShooterOpts = {},
    ): Promise<CaptureImageResult> {
        const selectorsOrAreasArray = ([] as Array<string | Rect>).concat(selectorsOrAreas as Array<string | Rect>);
        const selectors = selectorsOrAreasArray.filter(
            (areaOrSelector): areaOrSelector is string => typeof areaOrSelector === "string",
        );
        this._selectorsToCapture = selectors;

        const browserPrepareScreenshotDebug = makeDebug("testplane:screenshots:browser:prepareScreenshot");
        try {
            const page = await this._prepareScreenshot(selectorsOrAreasArray, {
                ignoreSelectors: ([] as string[]).concat(opts.ignoreElements ?? []),
                allowViewportOverflow: opts.allowViewportOverflow,
                captureElementFromTop: opts.captureElementFromTop,
                selectorToScroll: opts.selectorToScroll,
                disableAnimation: opts.disableAnimation,
                disableHover: opts.disableHover,
                compositeImage: opts.compositeImage,
                debug: browserPrepareScreenshotDebug.enabled,
            });

            delete page.debugLog;

            assertCorrectCaptureAreaBounds(
                JSON.stringify(selectorsOrAreasArray),
                page.viewport,
                page.viewportOffset,
                page.captureArea,
                opts,
            );

            debug(`[${opts.debugId}] prepareScreenshot result: %O`, page);

            await this._preparePointerForScreenshot(page, opts);

            const viewport = {
                ...page.viewport,
                ...page.viewportOffset,
            };
            const viewportImage = await this._browser.captureViewportImage(viewport, opts.screenshotDelay);
            const image = CompositeImage.create(page.captureArea, page.safeArea, page.ignoreAreas);
            await image.registerViewportImageAtOffset(viewportImage, page.scrollElementOffset, page.viewportOffset);

            await this._captureOverflowingAreaIfNeeded(image, page, opts);

            debug(`[${opts.debugId}] All areas captured. Proceeding to render image`);

            return {
                image: await image.render(),
                meta: page,
            };
        } catch (error) {
            console.warn(`Failed to capture screenshot for selectors: ${JSON.stringify(selectorsOrAreasArray)}`);
            throw error;
        } finally {
            try {
                await this._cleanupScreenshot(opts);
            } catch (cleanupError) {
                const cleanupMessage = cleanupError instanceof Error ? cleanupError.message : String(cleanupError);
                console.warn(
                    `Warning: failed to cleanup after screenshot for selectors: ${JSON.stringify(
                        selectorsOrAreasArray,
                    )}\n` + `Cleanup error: ${cleanupMessage}`,
                );
            }
        }
    }

    private async _prepareScreenshot(
        areas: Array<string | Rect>,
        opts: PrepareScreenshotOpts = {},
    ): Promise<PrepareScreenshotResult> {
        return runWithoutHistory({}, async () => {
            const optsWithPixelRatio = {
                ...opts,
                usePixelRatio: this._browser.shouldUsePixelRatio,
            };

            const result = await this._browser.callMethodOnBrowserSide<PrepareScreenshotResult | ClientBridgeErrorData>(
                "prepareScreenshot",
                [areas, optsWithPixelRatio],
            );

            makeDebug("testplane:screenshots:browser:prepareScreenshot")((result as PrepareScreenshotResult).debugLog);

            if (isClientBridgeErrorData(result)) {
                throw new Error(
                    `Failed to perform the visual check, because we couldn't compute screenshot area to capture.\n\n` +
                        `What happened:\n` +
                        `- You called assertView command with the following selectors: ${JSON.stringify(areas)}\n` +
                        `- You passed the following options: ${JSON.stringify(optsWithPixelRatio)}\n` +
                        `- We tried to determine positions of these elements, but failed with the '${result.errorCode}' error: ${result.message}\n\n` +
                        `What you can do:\n` +
                        `- Check that passed selectors are valid and exist on the page\n` +
                        `- If you believe this is a bug on our side, re-run this test with DEBUG=testplane:screenshots* and file an issue with this log at ${NEW_ISSUE_LINK}\n`,
                );
            }

            if (this._browser.isWebdriverProtocol && opts.disableAnimation) {
                await this._disableIframeAnimations();
            }

            return result;
        });
    }

    private async _cleanupScreenshot(opts: ScreenShooterOpts = {}): Promise<void> {
        return runWithoutHistory({}, async () => {
            if (opts.disableAnimation) {
                await this._cleanupPageAnimations();
            }
            if (opts.disableHover && opts.disableHover !== "never") {
                await this._cleanupPointerEvents();
            }
            await this._restorePointerPosition();
        });
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

    private async _preparePointerForScreenshot(page: PrepareScreenshotResult, opts: ScreenShooterOpts): Promise<void> {
        if (!opts.disableHover || opts.disableHover === "never") {
            return;
        }

        if (!page.pointerEventsDisabled) {
            return;
        }

        return runWithoutHistory({}, async () => {
            let didMove = await this._movePointerBy(1, 0);
            if (didMove) {
                this._relativeRestorePointerPosition = { x: -1, y: 0 };
            } else if (!didMove) {
                didMove = await this._movePointerBy(-1, 0);
                if (didMove) {
                    this._relativeRestorePointerPosition = { x: 1, y: 0 };
                }
            }
        });
    }

    private async _disableIframeAnimations(): Promise<void> {
        await runInEachDisplayedIframe(this._browser.publicAPI, async () => {
            const result = await this._browser.callMethodOnBrowserSide<void | ClientBridgeErrorData>(
                "disableFrameAnimations",
            );

            if (isClientBridgeErrorData(result)) {
                throw new Error(
                    `Disable animations failed with error type '${result.errorCode}' and error message: ${result.message}`,
                );
            }
        });
    }

    private async _cleanupPageAnimations(): Promise<void> {
        await this._browser.callMethodOnBrowserSide("cleanupFrameAnimations");

        if (this._browser.isWebdriverProtocol) {
            await runInEachDisplayedIframe(this._browser.publicAPI, async () => {
                await this._browser.callMethodOnBrowserSide("cleanupFrameAnimations");
            });
        }
    }

    private async _cleanupPointerEvents(): Promise<void> {
        await this._browser.callMethodOnBrowserSide("cleanupPointerEvents");
    }

    private async _restorePointerPosition(): Promise<void> {
        if (!this._relativeRestorePointerPosition) {
            return;
        }

        await this._movePointerBy(this._relativeRestorePointerPosition.x, this._relativeRestorePointerPosition.y);
        this._relativeRestorePointerPosition = null;
    }

    private async _movePointerBy(x: number, y: number): Promise<boolean> {
        const session = this._browser.publicAPI;

        if (!session.isW3C) {
            pointerDebug("Skipping relative pointer move because session is not W3C");
            return false;
        }

        try {
            pointerDebug("Trying to move pointer by %dpx, %dpx", x, y);
            await session
                .action("pointer", { parameters: { pointerType: "mouse" } })
                .move({ duration: 0, origin: "pointer", x, y })
                .perform();
            pointerDebug("Pointer moved by %dpx, %dpx", x, y);
            return true;
        } catch (error) {
            pointerDebug("Failed to move pointer relatively: %O", error);
            return false;
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
            this._selectorsToCapture.length > 0 ? this._selectorsToCapture : ["body"],
        ).catch(() => null);

        debug("boundingRectBeforeScroll: %O", boundingRectsBeforeScroll);

        const physicalScrollHeight = Math.max(
            Math.min(nextNotCapturedArea.height, page.safeArea.height),
            2 * page.pixelRatio,
        );
        // Subtract 1px to avoid rounding artifacts. Without this, when top edge of scroll container is at fractional
        // position and if it gets rounded to the next integer, we'd get 1px lines of that edge. Scrolling 1px less means
        // that we'll have 1px reserve at the top and that fractional border won't be visible.
        // But this rule should not apply to the last scroll iteration, because otherwise we'd always get useless 1px scroll in the end.
        const logicalScrollHeight =
            Math.ceil(physicalScrollHeight / page.pixelRatio) -
            Number(nextNotCapturedArea.height >= page.safeArea.height);

        const browserScrollByDebug = makeDebug("testplane:screenshots:browser:scrollBy");
        const selectorsToCapture = this._selectorsToCapture.length > 0 ? this._selectorsToCapture : ["body"];
        const scrollResult = await findScrollParentAndScrollBy(this._browser.publicAPI, {
            x: 0,
            y: logicalScrollHeight,
            selectorToScroll: opts.selectorToScroll,
            selectorsToCapture,
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
            this._selectorsToCapture.length > 0 ? this._selectorsToCapture : ["body"],
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

        const currentViewport = {
            ...page.viewport,
            top: windowOffset.top,
            left: windowOffset.left,
        };
        const newImage = await this._browser.captureViewportImage(currentViewport, opts.screenshotDelay);

        await image.registerViewportImageAtOffset(newImage, containerOffset, windowOffset);

        this._lastVerticalScrollOffset = windowOffset.top + containerOffset.top;

        return { hasReachedScrollLimit: false };
    }
}
