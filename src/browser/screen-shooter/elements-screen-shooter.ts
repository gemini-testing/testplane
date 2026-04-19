import makeDebug from "debug";
import { CompositeImage } from "./composite-image";
import { Image } from "../../image";
import { assertCorrectCaptureAreaBounds } from "./validation";
import type { AssertViewOpts } from "../../config/types";
import { runWithoutHistory } from "../history";
import {
    disableIframeAnimations,
    cleanupPageAnimations,
    cleanupPointerEvents,
    cleanupScrolls,
    preparePointerForScreenshot,
} from "./operations";
import { NEW_ISSUE_LINK } from "../../constants/help";
import { Coord, Length, getBottom } from "../isomorphic/geometry";
import { WdioBrowser } from "../../types";
import { Camera } from "../camera";
import type * as browserSideScreenshooterImplementation from "../client-scripts/screen-shooter/implementation";
import { ClientBridge } from "../client-bridge";
import type {
    CaptureSpec,
    CaptureState,
    PrepareScreenshotOptions,
    PrepareScreenshotSuccess,
} from "../client-scripts/screen-shooter/types";
import { isBrowserSideError } from "../isomorphic/types";
import { CaptureAreaMovedError } from "./errors/capture-area-moved-error";

const debug = makeDebug("testplane:screenshots:screen-shooter");

const COMPOSITING_ITERATIONS_LIMIT = 50;

interface ScreenShooterOpts extends AssertViewOpts {
    debugId?: string;
}

interface CaptureImageResult {
    image: Image;
    meta: PrepareScreenshotSuccess;
}

interface ScreenShooterBrowserProperties {
    isWebdriverProtocol: boolean;
    shouldUsePixelRatio: boolean;
    needsCompatLib: boolean;
}

interface ScreenShooterInputParams {
    camera: Camera;
    browser: WdioBrowser;
    browserProperties: ScreenShooterBrowserProperties;
}

interface ScreenShooterFullParams extends ScreenShooterInputParams {
    browserSideScreenshooter: ClientBridge<typeof browserSideScreenshooterImplementation>;
}

function areCaptureSpecsEqual(
    left: CaptureSpec<"viewport", "device">[],
    right: CaptureSpec<"viewport", "device">[],
): boolean {
    if (left.length !== right.length) {
        return false;
    }

    return left.every((spec, index) => {
        const otherSpec = right[index];

        if (!otherSpec) {
            return false;
        }

        return (
            spec.full.left === otherSpec.full.left &&
            spec.full.top === otherSpec.full.top &&
            spec.full.width === otherSpec.full.width &&
            spec.full.height === otherSpec.full.height
        );
    });
}

export class ElementsScreenShooter {
    private _browser: WdioBrowser;
    private _camera: Camera;
    private _browserProperties: ScreenShooterBrowserProperties;
    private _browserSideScreenshooter: ClientBridge<typeof browserSideScreenshooterImplementation>;

    static async create(params: ScreenShooterInputParams): Promise<ElementsScreenShooter> {
        const browserSideScreenshooter = await ClientBridge.create<typeof browserSideScreenshooterImplementation>(
            params.browser,
            "screen-shooter",
            { needsCompatLib: params.browserProperties.needsCompatLib },
        );

        return new this({ ...params, browserSideScreenshooter });
    }

    constructor({ browser, camera, browserProperties, browserSideScreenshooter }: ScreenShooterFullParams) {
        this._browser = browser;
        this._camera = camera;
        this._browserProperties = browserProperties;
        this._browserSideScreenshooter = browserSideScreenshooter;
    }

    async capture(
        selectorOrSelectors: string | string[],
        opts: ScreenShooterOpts = {},
        retriesLimit = 3,
    ): Promise<CaptureImageResult> {
        const globalStartedAt = performance.now();
        const perfDebug = makeDebug("testplane:screenshots:perf:" + opts.debugId);
        let startedAt,
            prepareScreenshotTime = 0,
            validateCaptureAreaStabilityTime = 0,
            captureAttemptTime = 0,
            renderImageTime = 0,
            cleanupTime = 0;

        const selectorsToCapture = ([] as string[]).concat(selectorOrSelectors);
        const selectorsToIgnore = ([] as string[]).concat(opts.ignoreElements ?? []);

        if (selectorsToCapture.length === 0) {
            throw new Error("No selectors to capture passed to ElementsScreenShooter.capture");
        }

        let retriesCount = 0;
        // This error may never be thrown, but just in case.
        let originalError: unknown = new Error(
            `An unknown error happened while capturing screenshot for selectors: ${JSON.stringify(selectorsToCapture)}`,
        );

        while (retriesCount < retriesLimit) {
            retriesCount++;
            startedAt = performance.now();
            try {
                perfDebug(`Starting capture attempt.`);

                const page = await this._prepareScreenshot(selectorsToCapture, {
                    ignoreSelectors: selectorsToIgnore,
                    allowViewportOverflow: opts.allowViewportOverflow,
                    captureElementFromTop: opts.captureElementFromTop,
                    selectorToScroll: opts.selectorToScroll,
                    disableAnimation: opts.disableAnimation,
                    disableHover: opts.disableHover,
                    compositeImage: opts.compositeImage,
                });

                assertCorrectCaptureAreaBounds(
                    JSON.stringify(selectorsToCapture),
                    page.viewportSize,
                    page.viewportOffset,
                    page.captureSpecs.map(s => s.full),
                    opts,
                );

                const captureScreenshotStartTime = performance.now();

                await preparePointerForScreenshot(this._browser, {
                    disableHover: opts.disableHover,
                    pointerEventsDisabled: page.pointerEventsDisabled,
                });

                prepareScreenshotTime = performance.now() - captureScreenshotStartTime;
                perfDebug(`Prepare screenshot finished. Time spent on prepare screenshot: ${prepareScreenshotTime}ms`);

                const isLastAttempt = retriesCount === retriesLimit;

                // For the first attempt, we take optimistic approach and don't verify if the whole area is stable in size,
                // because in majority of cases, it is stable and it's better to not spend time on scrolling.
                // If it's not stable on first try, it will throw and we will pre-load the whole area & verify it here,
                // optimising the "unstable" case - it's faster to discard early during scrolling than during actual capturing.
                if (retriesCount > 1 && !isLastAttempt) {
                    const validateCaptureAreaStabilityStartTime = performance.now();
                    await this._validateCaptureAreaStability(selectorsToCapture, selectorsToIgnore, page, opts);
                    // await this._preloadCaptureArea(selectorsToCapture, selectorsToIgnore, page, opts);
                    validateCaptureAreaStabilityTime = performance.now() - validateCaptureAreaStabilityStartTime;
                    perfDebug(
                        `Capture area stab>ility validated. Time spent on validate capture area stability: ${validateCaptureAreaStabilityTime}ms`,
                    );
                }

                const shouldThrowOnCaptureAreaSizeChange = !isLastAttempt;

                const captureAttemptStartTime = performance.now();
                const compositeImage = await this._performCaptureAttempt(
                    selectorsToCapture,
                    selectorsToIgnore,
                    page,
                    opts,
                    shouldThrowOnCaptureAreaSizeChange,
                );

                captureAttemptTime = performance.now() - captureAttemptStartTime;
                perfDebug(
                    `All areas captured. Proceeding to render image. Time spent on capture attempt: ${captureAttemptTime}ms`,
                );
                const renderImageStartTime = performance.now();

                const renderedImage = await compositeImage.render();

                renderImageTime = performance.now() - renderImageStartTime;
                perfDebug(`Rendering finished. Time spent on rendering: ${renderImageTime}ms`);

                perfDebug(`Total time spent on capture (all attempts): ${performance.now() - globalStartedAt}ms`);

                return {
                    image: renderedImage,
                    meta: page,
                };
            } catch (error) {
                originalError = error;
                const isRetriable = (error as null | { retriable?: boolean })?.retriable === true;

                if (isRetriable && retriesCount < retriesLimit) {
                    perfDebug(`Capture attempt failed. Going to retry. Retry # ${retriesCount}`);
                    continue;
                }

                perfDebug(`Total time spent on capture (all attempts): ${performance.now() - globalStartedAt}ms`);

                throw error;
            } finally {
                const cleanupStartTime = performance.now();
                try {
                    await this._cleanupScreenshot(opts);

                    cleanupTime = performance.now() - cleanupStartTime;
                    perfDebug(`[${opts.debugId}]   Cleanup finished. Time spent on cleanup: ${cleanupTime}ms`);
                } catch (cleanupError) {
                    const cleanupMessage = cleanupError instanceof Error ? cleanupError.message : String(cleanupError);
                    console.warn(
                        `Warning: failed to cleanup after screenshot for selectors: ${JSON.stringify(
                            selectorsToCapture,
                        )}\n` + `Cleanup error: ${cleanupMessage}`,
                    );
                }

                const totalTimeSpent = performance.now() - startedAt;
                const timeSpentOnKnownOperations =
                    prepareScreenshotTime +
                    validateCaptureAreaStabilityTime +
                    captureAttemptTime +
                    renderImageTime +
                    cleanupTime;
                perfDebug(`Other time during capture attempt: ${totalTimeSpent - timeSpentOnKnownOperations}ms`);
                perfDebug(`Attempt finished. Starting cleanup. Time spent on this attempt: ${totalTimeSpent}ms\n\n`);
            }
        }

        perfDebug(`Total time spent on capture (all attempts): ${performance.now() - globalStartedAt}ms`);

        throw originalError;
    }

    private async _prepareScreenshot(
        selectorsToCapture: string[],
        opts: PrepareScreenshotOptions = {},
    ): Promise<PrepareScreenshotSuccess> {
        return runWithoutHistory({}, async () => {
            const enabledDebugTopics: string[] = [];
            const browserPrepareScreenshotDebug = makeDebug("testplane:screenshots:browser:prepareScreenshot");
            if (browserPrepareScreenshotDebug.enabled) {
                enabledDebugTopics.push("prepareElementsScreenshot");
            }

            const extendedOpts = {
                ...opts,
                debug: enabledDebugTopics,
                usePixelRatio: this._browserProperties.shouldUsePixelRatio,
            };

            const result = await this._browserSideScreenshooter.call("prepareElementsScreenshot", [
                selectorsToCapture,
                extendedOpts,
            ]);

            const { debugLog, ...resultRest } = result;
            makeDebug("testplane:screenshots:browser:prepareScreenshot")(debugLog);
            debug("prepareElementsScreenshot result: %O", resultRest);

            if (isBrowserSideError(result)) {
                throw new Error(
                    `Failed to perform the visual check, because we couldn't compute screenshot area to capture.\n\n` +
                        `What happened:\n` +
                        `- You called assertView command with the following selectors: ${JSON.stringify(
                            selectorsToCapture,
                        )}\n` +
                        `- You passed the following options: ${JSON.stringify(extendedOpts)}\n` +
                        `- We tried to determine positions of these elements, but failed with the '${result.errorCode}' error: ${result.message}\n\n` +
                        `What you can do:\n` +
                        `- Check that passed selectors are valid and exist on the page\n` +
                        `- If you believe this is a bug on our side, re-run this test with DEBUG=testplane:screenshots* and file an issue with this log at ${NEW_ISSUE_LINK}\n`,
                );
            }

            // https://github.com/webdriverio/webdriverio/issues/11396
            if (this._browserProperties.isWebdriverProtocol && opts.disableAnimation) {
                await disableIframeAnimations(this._browser, this._browserSideScreenshooter);
            }

            return result;
        });
    }

    private async _cleanupScreenshot(opts: ScreenShooterOpts = {}): Promise<void> {
        return runWithoutHistory({}, async () => {
            await cleanupScrolls(this._browserSideScreenshooter);

            if (opts.disableAnimation) {
                await cleanupPageAnimations(
                    this._browser,
                    this._browserSideScreenshooter,
                    this._browserProperties.isWebdriverProtocol,
                );
            }
            if (opts.disableHover && opts.disableHover !== "never") {
                await cleanupPointerEvents(this._browserSideScreenshooter);
            }
        });
    }

    private async _waitForCaptureAreaToSettle(selectorsToCapture: string[]): Promise<void> {
        await this._browser.execute(async selectorsToCapture => {
            const PAGE_SETTLE_MAX_WAIT_MS = 50;
            const PAGE_SETTLE_MAX_ITERATIONS = 50000;
            const PAGE_SETTLE_MATCHES_THRESHOLD = 3;
            const startedAt = performance.now();
            let iterations = 0;

            let matches = 0;

            let lastBoundingClientRects = selectorsToCapture.map(selector =>
                document.querySelector(selector)?.getBoundingClientRect(),
            );
            while (
                performance.now() - startedAt < PAGE_SETTLE_MAX_WAIT_MS &&
                iterations < PAGE_SETTLE_MAX_ITERATIONS &&
                matches < PAGE_SETTLE_MATCHES_THRESHOLD
            ) {
                const currentBoundingClientRects = selectorsToCapture.map(selector =>
                    document.querySelector(selector)?.getBoundingClientRect(),
                );
                if (
                    currentBoundingClientRects.every(
                        (rect, index) =>
                            rect?.top === lastBoundingClientRects[index]?.top &&
                            rect?.height === lastBoundingClientRects[index]?.height,
                    )
                ) {
                    matches++;
                } else {
                    matches = 0;
                }
                lastBoundingClientRects = currentBoundingClientRects;
                iterations++;
                await new Promise(resolve => setTimeout(resolve, 5));
            }
        }, selectorsToCapture);
    }

    private async _scrollThroughCaptureArea(
        selectorsToCapture: string[],
        selectorsToIgnore: string[],
        page: PrepareScreenshotSuccess,
        opts: ScreenShooterOpts,
        onNextScroll: (currentState: CaptureState) => Promise<void>,
    ): Promise<void> {
        const perfDebug = makeDebug("testplane:screenshots:perf:" + opts.debugId);
        let iterations = 0;
        let lastState: CaptureState = {
            captureSpecs: page.captureSpecs,
            viewportOffset: page.viewportOffset,
            scrollOffset: page.scrollOffset,
            safeArea: page.safeArea,
            ignoreAreas: page.ignoreAreas,
        };
        let hasReachedScrollLimit = false;
        let hasCapturedTheWholeArea = false;

        const startTime = performance.now();
        let waitForSettleTime = 0,
            recomputeTime = 0,
            scrollTime = 0,
            callbackTime = 0;

        try {
            while (iterations < COMPOSITING_ITERATIONS_LIMIT && !hasCapturedTheWholeArea && !hasReachedScrollLimit) {
                debug(`========== Starting compositing iteration #${iterations} ==========`);

                const waitForSettleStartTime = performance.now();
                await this._waitForCaptureAreaToSettle(selectorsToCapture);
                waitForSettleTime += performance.now() - waitForSettleStartTime;

                const recomputeStartTime = performance.now();

                const enabledScrollDebugTopics: string[] = [];
                const browserScrollDebug = makeDebug("testplane:screenshots:browser:getCaptureState");
                if (browserScrollDebug.enabled) {
                    enabledScrollDebugTopics.push("getCaptureState");
                }

                const currentStateOrError = await this._browserSideScreenshooter.call("getCaptureState", [
                    selectorsToCapture,
                    selectorsToIgnore,
                    opts.selectorToScroll,
                    enabledScrollDebugTopics,
                ]);
                recomputeTime += performance.now() - recomputeStartTime;
                const recomputeDebugLog = currentStateOrError.debugLog;
                delete currentStateOrError.debugLog;
                browserScrollDebug(recomputeDebugLog);

                debug("currentState: %O", currentStateOrError);

                if (isBrowserSideError(currentStateOrError)) {
                    throw new Error(
                        `Failed to recompute areas while compositing image of selectors: ${selectorsToCapture.join(
                            ", ",
                        )}, error type '${currentStateOrError.errorCode}' and error message: ${
                            currentStateOrError.message
                        }`,
                    );
                }

                let currentState = currentStateOrError;

                const safeAreaShrink = (lastState.safeArea.height - currentState.safeArea.height) as Length<
                    "device",
                    "y"
                >;

                if (safeAreaShrink > 0) {
                    debug("safe area shrank after scroll, rolling back", {
                        previousSafeArea: lastState.safeArea,
                        newSafeArea: currentState.safeArea,
                        safeAreaShrink,
                        previousOffset: lastState.scrollOffset,
                        scrolledOffset: currentState.scrollOffset,
                    });

                    await this._browserSideScreenshooter.call("scrollBy", [
                        selectorsToCapture,
                        -safeAreaShrink as Coord<"page", "device", "y">,
                        opts.selectorToScroll,
                    ]);
                    const afterRollbackState = await this._browserSideScreenshooter.call("getCaptureState", [
                        selectorsToCapture,
                        selectorsToIgnore,
                        opts.selectorToScroll,
                    ]);

                    if (isBrowserSideError(afterRollbackState)) {
                        throw new Error(
                            `Failed to rollback and recompute areas while compositing image of selectors: ${selectorsToCapture.join(
                                ", ",
                            )}, error type '${afterRollbackState.errorCode}' and error message: ${
                                afterRollbackState.message
                            }`,
                        );
                    }

                    if (!afterRollbackState.safeArea || !afterRollbackState.ignoreAreas) {
                        throw new Error(
                            `Failed to rollback and recompute full areas while compositing image of selectors: ${selectorsToCapture.join(
                                ", ",
                            )}`,
                        );
                    }

                    currentState = afterRollbackState;
                }

                const callbackStartTime = performance.now();
                await onNextScroll(currentState);
                callbackTime += performance.now() - callbackStartTime;

                hasCapturedTheWholeArea = currentState.captureSpecs.every(
                    s => getBottom(s.full) <= getBottom(currentState.safeArea),
                );

                if (hasCapturedTheWholeArea) {
                    break;
                }

                if (!opts.compositeImage) {
                    debug("compositeImage is false, exiting after the first iteration");
                    break;
                }

                hasReachedScrollLimit = iterations > 0 && currentState.scrollOffset <= lastState.scrollOffset;
                if (hasReachedScrollLimit) {
                    break;
                }

                debug("asking to scroll by %dpx", currentState.safeArea.height);

                const scrollStartTime = performance.now();
                const scrollResult = await this._browserSideScreenshooter.call("scrollBy", [
                    selectorsToCapture,
                    currentState.safeArea.height,
                    opts.selectorToScroll,
                    enabledScrollDebugTopics,
                ]);
                scrollTime += performance.now() - scrollStartTime;
                const scrollDebugLog = scrollResult.debugLog;
                delete scrollResult.debugLog;
                browserScrollDebug(scrollDebugLog);

                debug("scrollResult: %O", scrollResult);

                if (isBrowserSideError(scrollResult)) {
                    throw new Error(
                        `Failed to scroll once while compositing image of selectors: ${selectorsToCapture.join(
                            ", ",
                        )}, error type '${scrollResult.errorCode}' and error message: ${scrollResult.message}`,
                    );
                }

                lastState = currentState;
                iterations++;
            }
        } finally {
            perfDebug(`Time spent on waiting for capture area to settle: ${waitForSettleTime}ms`);
            perfDebug(`Time spent on recomputing areas: ${recomputeTime}ms`);
            perfDebug(`Time spent on scrolling: ${scrollTime}ms`);
            perfDebug(`Time spent on callback: ${callbackTime}ms`);
            perfDebug(
                `Time spent on other operations: ${
                    performance.now() - startTime - (waitForSettleTime + recomputeTime + scrollTime + callbackTime)
                }ms`,
            );
            perfDebug(`Total time spent: ${performance.now() - startTime}ms`);

            debug(
                `Scrolling finished after ${iterations} iterations, hasCapturedTheWholeArea: ${hasCapturedTheWholeArea}, hasReachedScrollLimit: ${hasReachedScrollLimit}`,
            );
        }
    }

    /** Scrolls through the capture area twice and validates if these two passes resulted in the same capture areas, thus checking if the area is stable. */
    private async _validateCaptureAreaStability(
        selectorsToCapture: string[],
        selectorsToIgnore: string[],
        page: PrepareScreenshotSuccess,
        opts: ScreenShooterOpts,
    ): Promise<void> {
        const perfDebug = makeDebug("testplane:screenshots:perf:" + opts.debugId);
        perfDebug(`Starting capture area stability validation.`);
        const startedAt = performance.now();

        const enabledScrollDebugTopics: string[] = [];
        const browserScrollDebug = makeDebug("testplane:screenshots:browser:getCaptureState");
        if (browserScrollDebug.enabled) {
            enabledScrollDebugTopics.push("getCaptureState");
        }

        const beforeCheckpointsValidationState = await this._browserSideScreenshooter.call("getCaptureState", [
            selectorsToCapture,
            selectorsToIgnore,
            opts.selectorToScroll,
            enabledScrollDebugTopics,
        ]);
        const beforeValidationDebugLog = beforeCheckpointsValidationState.debugLog;
        delete beforeCheckpointsValidationState.debugLog;
        browserScrollDebug(beforeValidationDebugLog);

        if (isBrowserSideError(beforeCheckpointsValidationState)) {
            throw new Error(
                `Failed to recompute areas before checkpoints validation while compositing image of selectors: ${selectorsToCapture.join(
                    ", ",
                )}, error type '${beforeCheckpointsValidationState.errorCode}' and error message: ${
                    beforeCheckpointsValidationState.message
                }`,
            );
        }

        const baselineCheckpoints: CaptureState[] = [];
        const currentCheckpoints: CaptureState[] = [];
        let shouldRestoreScrollPosition = false;
        let restoreScrollPositionError: Error | null = null;

        try {
            await this._scrollThroughCaptureArea(
                selectorsToCapture,
                selectorsToIgnore,
                page,
                opts,
                async currentState => {
                    baselineCheckpoints.push(currentState);
                },
            );

            // If the whole area fits viewport there is no scrolling and no point in a second pass.
            if (baselineCheckpoints.length <= 1) {
                return;
            }

            shouldRestoreScrollPosition = true;

            const restoreToInitialScrollOffsetResult = await this._browserSideScreenshooter.call("scrollTo", [
                selectorsToCapture,
                page.scrollOffset,
                opts.selectorToScroll,
            ]);

            if (isBrowserSideError(restoreToInitialScrollOffsetResult)) {
                throw new Error(
                    `Failed to restore the initial state before checkpoints validation while compositing image of selectors: ${selectorsToCapture.join(
                        ", ",
                    )}, error type '${restoreToInitialScrollOffsetResult.errorCode}' and error message: ${
                        restoreToInitialScrollOffsetResult.message
                    }`,
                );
            }

            const collectCurrentCheckpointsStartTime = performance.now();

            for (const checkpoint of baselineCheckpoints) {
                const scrollToCheckpointResult = await this._browserSideScreenshooter.call("scrollTo", [
                    selectorsToCapture,
                    checkpoint.scrollOffset,
                    opts.selectorToScroll,
                    enabledScrollDebugTopics,
                ]);
                const scrollToCheckpointDebugLog = scrollToCheckpointResult.debugLog;
                delete scrollToCheckpointResult.debugLog;
                browserScrollDebug(scrollToCheckpointDebugLog);

                if (isBrowserSideError(scrollToCheckpointResult)) {
                    throw new Error(
                        `Failed to scroll to checkpoint offset while compositing image of selectors: ${selectorsToCapture.join(
                            ", ",
                        )}, error type '${scrollToCheckpointResult.errorCode}' and error message: ${
                            scrollToCheckpointResult.message
                        }`,
                    );
                }

                await this._waitForCaptureAreaToSettle(selectorsToCapture);

                const currentCheckpoint = await this._browserSideScreenshooter.call("getCaptureState", [
                    selectorsToCapture,
                    selectorsToIgnore,
                    opts.selectorToScroll,
                    enabledScrollDebugTopics,
                ]);
                const currentCheckpointDebugLog = currentCheckpoint.debugLog;
                delete currentCheckpoint.debugLog;
                browserScrollDebug(currentCheckpointDebugLog);

                if (isBrowserSideError(currentCheckpoint)) {
                    throw new Error(
                        `Failed to recompute checkpoint capture specs for selectors: ${selectorsToCapture.join(
                            ", ",
                        )}, error type '${currentCheckpoint.errorCode}' and error message: ${
                            currentCheckpoint.message
                        }`,
                    );
                }

                currentCheckpoints.push(currentCheckpoint);
            }

            perfDebug(
                `[${opts.debugId}]   Collected current checkpoints. Time spent: ${
                    performance.now() - collectCurrentCheckpointsStartTime
                }ms`,
            );

            debug("captureCheckpoints: %O", baselineCheckpoints);
            debug("currentCheckpoints: %O", currentCheckpoints);

            const mismatchIndex = baselineCheckpoints.findIndex((checkpoint, index) => {
                const currentCheckpoint = currentCheckpoints[index];

                if (!currentCheckpoint || checkpoint.scrollOffset !== currentCheckpoint.scrollOffset) {
                    return true;
                }

                return !areCaptureSpecsEqual(checkpoint.captureSpecs, currentCheckpoint.captureSpecs);
            });

            if (mismatchIndex !== -1 || baselineCheckpoints.length !== currentCheckpoints.length) {
                const safeIndex = mismatchIndex === -1 ? baselineCheckpoints.length - 1 : mismatchIndex;
                const expectedCheckpoint = baselineCheckpoints[safeIndex];
                const currentCheckpoint = currentCheckpoints[safeIndex];

                const lastFullRects = expectedCheckpoint.captureSpecs.map(s => s.full);
                const newFullRects = currentCheckpoint ? currentCheckpoint.captureSpecs.map(s => s.full) : [];

                debug(
                    `Checkpoints mismatch, mismatchIndex: ${mismatchIndex}, expected checkpoint: %O, current checkpoint: %O, interrupting and starting over.`,
                    expectedCheckpoint,
                    currentCheckpoint,
                );

                throw new CaptureAreaMovedError(selectorsToCapture, lastFullRects, newFullRects);
            }
        } finally {
            if (shouldRestoreScrollPosition) {
                const restoreScrollResult = await this._browserSideScreenshooter.call("scrollTo", [
                    selectorsToCapture,
                    beforeCheckpointsValidationState.scrollOffset,
                    opts.selectorToScroll,
                    enabledScrollDebugTopics,
                ]);
                const restoreScrollDebugLog = restoreScrollResult.debugLog;
                delete restoreScrollResult.debugLog;
                browserScrollDebug(restoreScrollDebugLog);

                if (isBrowserSideError(restoreScrollResult)) {
                    restoreScrollPositionError = new Error(
                        `Failed to restore scroll position after checkpoints validation while compositing image of selectors: ${selectorsToCapture.join(
                            ", ",
                        )}, error type '${restoreScrollResult.errorCode}' and error message: ${
                            restoreScrollResult.message
                        }`,
                    );
                }
            }

            perfDebug(
                `[${opts.debugId}] Capture area stability validation finished. Time taken: ${
                    performance.now() - startedAt
                }ms`,
            );
        }

        if (restoreScrollPositionError) {
            throw restoreScrollPositionError;
        }
    }

    private async _performCaptureAttempt(
        selectorsToCapture: string[],
        selectorsToIgnore: string[],
        page: PrepareScreenshotSuccess,
        opts: ScreenShooterOpts,
        shouldThrowOnCaptureAreaSizeChange: boolean,
    ): Promise<CompositeImage> {
        const perfDebug = makeDebug("testplane:screenshots:perf:" + opts.debugId);
        const image = CompositeImage.create();

        let timeSpentOnCapture = 0;

        let iterations = 0;
        let isOverflowingViewport = false;
        let hasReachedScrollLimit = false;
        let hasCapturedTheWholeArea = false;
        let restoreScrollPositionError: Error | null = null;

        let lastState: CaptureState = {
            viewportOffset: page.viewportOffset,
            captureSpecs: page.captureSpecs,
            scrollOffset: page.scrollOffset,
            safeArea: page.safeArea,
            ignoreAreas: page.ignoreAreas,
        };

        let shouldRestoreScrollPosition = false;

        try {
            await this._scrollThroughCaptureArea(
                selectorsToCapture,
                selectorsToIgnore,
                page,
                opts,
                async currentState => {
                    const hasCaptureAreaSizeChanged =
                        lastState.captureSpecs.length !== currentState.captureSpecs.length ||
                        lastState.captureSpecs.some(
                            (spec, index) =>
                                spec.full.width !== currentState.captureSpecs[index]?.full.width ||
                                spec.full.height !== currentState.captureSpecs[index]?.full.height,
                        );

                    if (hasCaptureAreaSizeChanged && shouldThrowOnCaptureAreaSizeChange) {
                        const lastFullRects = lastState.captureSpecs.map(s => s.full);
                        const newFullRects = currentState.captureSpecs.map(s => s.full);
                        throw new CaptureAreaMovedError(selectorsToCapture, lastFullRects, newFullRects);
                    }

                    const {
                        captureSpecs: newCaptureSpecs,
                        ignoreAreas: newIgnoreAreas,
                        safeArea: newSafeArea,
                    } = currentState;

                    const captureStartTime = performance.now();

                    // const viewport = { ...page.viewportSize, ...page.viewportOffset };
                    const viewportImage = await this._camera.captureViewportImage({
                        viewportSize: page.viewportSize,
                        viewportOffset: currentState.viewportOffset,
                        screenshotDelay: opts.screenshotDelay,
                    });

                    timeSpentOnCapture += performance.now() - captureStartTime;

                    await image.registerViewportImageAtOffset(
                        viewportImage,
                        newSafeArea,
                        newCaptureSpecs,
                        newIgnoreAreas,
                    );

                    hasReachedScrollLimit = iterations > 0 && currentState.scrollOffset <= lastState.scrollOffset;
                    hasCapturedTheWholeArea = newCaptureSpecs.every(s => getBottom(s.full) <= getBottom(newSafeArea));
                    isOverflowingViewport = newCaptureSpecs.some(s => getBottom(s.full) > page.viewportSize.height);

                    if (currentState.scrollOffset !== page.scrollOffset) {
                        shouldRestoreScrollPosition = true;
                    }

                    debug("newCaptureSpecs: %O", newCaptureSpecs);
                    debug("newSafeArea: %O", newSafeArea);
                    debug("lastState.captureSpecs: %O", lastState.captureSpecs);

                    lastState = currentState;
                    iterations++;
                },
            );
        } finally {
            perfDebug(`Done capturing composite image. Time spent on raw viewport captures: ${timeSpentOnCapture}ms`);
            if (shouldRestoreScrollPosition) {
                const enabledScrollDebugTopics: string[] = [];
                const browserScrollDebug = makeDebug("testplane:screenshots:browser:scrollTo");
                if (browserScrollDebug.enabled) {
                    enabledScrollDebugTopics.push("scrollTo");
                }

                const restoreScrollResult = await this._browserSideScreenshooter.call("scrollTo", [
                    selectorsToCapture,
                    page.scrollOffset,
                    opts.selectorToScroll,
                    enabledScrollDebugTopics,
                ]);
                const restoreScrollDebugLog = restoreScrollResult.debugLog;
                delete restoreScrollResult.debugLog;
                browserScrollDebug(restoreScrollDebugLog);

                if (isBrowserSideError(restoreScrollResult)) {
                    restoreScrollPositionError = new Error(
                        `Failed to restore scroll position after compositing image of selectors: ${selectorsToCapture.join(
                            ", ",
                        )}, error type '${restoreScrollResult.errorCode}' and error message: ${
                            restoreScrollResult.message
                        }`,
                    );
                }
            }
        }

        if (restoreScrollPositionError) {
            throw restoreScrollPositionError;
        }

        debug(
            `Compositing finished after ${iterations} iterations, hasCapturedTheWholeArea: ${hasCapturedTheWholeArea}, hasReachedScrollLimit: ${hasReachedScrollLimit}`,
        );

        if (isOverflowingViewport && !opts.allowViewportOverflow) {
            console.warn(
                `Warning: when capturing the ${
                    opts.debugId ?? selectorsToCapture.join(", ")
                } screenshot, we failed to capture the whole area.\n` +
                    `Here's what happened:\n` +
                    `- you requested to capture the following selectors: ${selectorsToCapture.join("; ")}\n` +
                    (opts.selectorToScroll
                        ? `- you requested to scroll the following selector: ${opts.selectorToScroll}`
                        : `- we auto-detected element to scroll ${page.readableSelectorToScrollDescr} and tried scrolling it\n`) +
                    `- we reached the scroll limit, but weren't able to capture the whole area\n\n` +
                    `Here's what you can do:\n` +
                    `- set allowViewportOverflow to true in assertView options to silence this warning\n` +
                    `- check and adjust selectors that you want to capture or selectorToScroll`,
            );
        }

        return image;
    }
}
