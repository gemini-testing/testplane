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
    waitForSelectorsToSettle,
} from "./operations";
import { NEW_ISSUE_LINK } from "../../constants/help";
import { Coord, Length, getBottom } from "../isomorphic/geometry";
import { WdioBrowser } from "../../types";
import { Camera } from "../camera";
import type * as browserSideScreenshooterImplementation from "../client-scripts/screen-shooter/implementation";
import { ClientBridge } from "../client-bridge";
import type {
    CaptureState,
    PrepareScreenshotOptions,
    PrepareScreenshotSuccess,
} from "../client-scripts/screen-shooter/types";
import { isBrowserSideError } from "../isomorphic/types";
import { COMPOSITING_ITERATIONS_LIMIT } from "./constants";
import { makeVerboseScreenshotsDebug } from "./debug";

class CaptureAreaSizeChangeError extends Error {
    constructor() {
        super("Capture area size changed unexpectedly during capture");
        this.name = "CaptureAreaSizeChangeError";
    }
}

const debug = makeVerboseScreenshotsDebug("testplane:screenshots:elements-screen-shooter");
const SCROLL_OVERLAP_PX = 1;
const formatDuration = (duration: number): string => `${duration.toFixed(1)}ms`;

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

function getMedian(values: number[]): number | null {
    if (values.length === 0) {
        return null;
    }

    const sorted = values.slice().sort((a, b) => a - b);
    const middleIndex = Math.floor(sorted.length / 2);

    if (sorted.length % 2 === 1) {
        return sorted[middleIndex];
    }

    return (sorted[middleIndex - 1] + sorted[middleIndex]) / 2;
}

function getExpectedTotalMoveFromBaseline(
    baselineCaptureSpecs: CaptureState["captureSpecs"],
    currentCaptureSpecs: CaptureState["captureSpecs"],
): number {
    const sharedSpecsCount = Math.min(baselineCaptureSpecs.length, currentCaptureSpecs.length);
    const shifts: number[] = [];

    for (let index = 0; index < sharedSpecsCount; index++) {
        const baselineSpec = baselineCaptureSpecs[index];
        const currentSpec = currentCaptureSpecs[index];

        if (!baselineSpec || !currentSpec) {
            continue;
        }

        const shift = (currentSpec.full.top as number) - (baselineSpec.full.top as number);
        if (shift !== 0) {
            shifts.push(shift);
        }
    }

    return getMedian(shifts) ?? 0;
}

function getMovingCaptureSpecs(currentState: CaptureState, lastState: CaptureState): CaptureState["captureSpecs"] {
    if (currentState.scrollOffset === lastState.scrollOffset) {
        return currentState.captureSpecs;
    }

    return currentState.captureSpecs.filter((spec, index) => {
        const lastSpec = lastState.captureSpecs[index];

        return lastSpec && spec.full.top !== lastSpec.full.top;
    });
}

function getRemainingCaptureAreaHeight(
    captureSpecs: CaptureState["captureSpecs"],
    safeArea: CaptureState["safeArea"],
): Length<"device", "y"> {
    if (captureSpecs.length === 0) {
        return 0 as Length<"device", "y">;
    }

    const safeAreaBottom = getBottom(safeArea);
    const captureAreaBottom = Math.max(...captureSpecs.map(spec => getBottom(spec.full)));

    return Math.max(0, captureAreaBottom - safeAreaBottom) as Length<"device", "y">;
}

function getScrollDelta(
    safeAreaHeight: Length<"device", "y">,
    remainingCaptureAreaHeight: Length<"device", "y">,
): Length<"device", "y"> {
    if (remainingCaptureAreaHeight <= safeAreaHeight) {
        return remainingCaptureAreaHeight;
    }

    return (safeAreaHeight > SCROLL_OVERLAP_PX ? safeAreaHeight - SCROLL_OVERLAP_PX : safeAreaHeight) as Length<
        "device",
        "y"
    >;
}

function getCaptureAreaTop(captureSpecs: CaptureState["captureSpecs"]): Coord<"viewport", "device", "y"> | null {
    if (captureSpecs.length === 0) {
        return null;
    }

    return Math.min(...captureSpecs.map(spec => spec.full.top as number)) as Coord<"viewport", "device", "y">;
}

function getSafeAreaRollbackDistance(
    lastState: CaptureState | null,
    currentState: CaptureState,
): Length<"device", "y"> {
    const currentCaptureAreaTop = getCaptureAreaTop(currentState.captureSpecs);

    if (currentCaptureAreaTop === null) {
        return 0 as Length<"device", "y">;
    }

    let previousCoveredBottom = 0;
    const previousCaptureAreaTop = lastState ? getCaptureAreaTop(lastState.captureSpecs) : null;
    if (lastState && previousCaptureAreaTop !== null) {
        const previousVisibleBottom = Math.max(...lastState.captureSpecs.map(spec => getBottom(spec.visible)));
        const previousSafeBottom = getBottom(lastState.safeArea);
        previousCoveredBottom =
            Math.min(previousVisibleBottom, previousSafeBottom) - (previousCaptureAreaTop as number);
    }

    const currentSafeAreaTop = (currentState.safeArea.top as number) - (currentCaptureAreaTop as number);

    return Math.max(0, currentSafeAreaTop - previousCoveredBottom) as Length<"device", "y">;
}

function getEmptyCaptureSpecsErrorMessage(selectorsToCapture: string[]): string {
    return (
        `Failed to capture element screenshot for selectors: ${selectorsToCapture.join("; ")}.\n` +
        `Could not determine coordinates of the matched elements.\n` +
        `Most likely the matched element became hidden, zero-sized, detached, moved offscreen, ` +
        `or was clipped after scrolling/waiting for layout to settle.\n` +
        `If you are capturing element sensitive to scrolling, like a tooltip, it could be hidden due to auto-scrolling on our side.\n` +
        `Make sure the selector stays visible during the screenshot or disable scrolling via compositeImage/captureElementFromTop options.`
    );
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

    async capture(selectorOrSelectors: string | string[], opts: ScreenShooterOpts = {}): Promise<CaptureImageResult> {
        const globalStartedAt = performance.now();
        const perfDebug = makeDebug("testplane:screenshots:perf:" + opts.debugId);

        const selectorsToCapture = ([] as string[]).concat(selectorOrSelectors);
        const selectorsToIgnore = ([] as string[]).concat(opts.ignoreElements ?? []);

        if (selectorsToCapture.length === 0) {
            throw new Error("No selectors to capture passed to ElementsScreenShooter.capture");
        }

        try {
            perfDebug("capture: begin");

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

            await preparePointerForScreenshot(this._browser, {
                disableHover: opts.disableHover,
                pointerEventsDisabled: page.pointerEventsDisabled,
            });

            let compositeImage: CompositeImage;
            try {
                compositeImage = await this._performCaptureAttempt(
                    selectorsToCapture,
                    selectorsToIgnore,
                    page,
                    opts,
                    true,
                );
            } catch (error) {
                if (!(error instanceof CaptureAreaSizeChangeError)) {
                    throw error;
                }

                perfDebug("capture: retrying in best-effort mode");
                await this._preloadCaptureArea(selectorsToCapture, selectorsToIgnore, page, opts);
                compositeImage = await this._performCaptureAttempt(
                    selectorsToCapture,
                    selectorsToIgnore,
                    page,
                    opts,
                    false,
                );
            }

            const renderedImage = await compositeImage.render();

            perfDebug(`capture: end in ${formatDuration(performance.now() - globalStartedAt)}`);

            return {
                image: renderedImage,
                meta: page,
            };
        } finally {
            try {
                await this._cleanupScreenshot(opts);
            } catch (cleanupError) {
                const cleanupMessage = cleanupError instanceof Error ? cleanupError.message : String(cleanupError);
                console.warn(
                    `Warning: failed to cleanup after screenshot for selectors: ${JSON.stringify(
                        selectorsToCapture,
                    )}\n` + `Cleanup error: ${cleanupMessage}`,
                );
            }
        }
    }

    private async _prepareScreenshot(
        selectorsToCapture: string[],
        opts: PrepareScreenshotOptions = {},
    ): Promise<PrepareScreenshotSuccess> {
        return runWithoutHistory({}, async () => {
            const enabledDebugTopics: string[] = [];
            const browserPrepareScreenshotDebug = makeVerboseScreenshotsDebug(
                "testplane:screenshots:browser:prepareScreenshot",
            );
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
            browserPrepareScreenshotDebug(debugLog);
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

    /** Scrolls through the entire capture area to trigger lazy loading, then restores scroll and records anchor baselines. */
    private async _preloadCaptureArea(
        selectorsToCapture: string[],
        selectorsToIgnore: string[],
        page: PrepareScreenshotSuccess,
        opts: ScreenShooterOpts,
    ): Promise<void> {
        const perfDebug = makeDebug("testplane:screenshots:perf:" + opts.debugId);

        perfDebug("preload capture area: begin");
        try {
            await this._scrollThroughCaptureArea(selectorsToCapture, selectorsToIgnore, page, opts, async () => {});

            await this._browserSideScreenshooter.call("scrollTo", [
                selectorsToCapture,
                page.scrollOffset,
                opts.selectorToScroll ?? null,
            ]);

            await this._browserSideScreenshooter.call("captureAnchorBaseline", [selectorsToCapture]);
        } finally {
            perfDebug("preload capture area: end");
        }
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
            anchorShift: null,
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
                await waitForSelectorsToSettle(this._browser, selectorsToCapture, {
                    needsCompatLib: this._browserProperties.needsCompatLib,
                });
                waitForSettleTime += performance.now() - waitForSettleStartTime;

                const recomputeStartTime = performance.now();

                const enabledScrollDebugTopics: string[] = [];
                const browserScrollDebug = makeVerboseScreenshotsDebug("testplane:screenshots:browser:getCaptureState");
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
                const safeAreaTopShift = (currentState.safeArea.top as number) - (lastState.safeArea.top as number);
                const rollbackDistance =
                    safeAreaShrink > 0 || safeAreaTopShift > 0
                        ? getSafeAreaRollbackDistance(iterations > 0 ? lastState : null, currentState)
                        : 0;

                if (rollbackDistance > 0) {
                    debug("safe area shrank or shifted after scroll", {
                        previousSafeArea: lastState.safeArea,
                        newSafeArea: currentState.safeArea,
                        safeAreaShrink,
                        safeAreaTopShift,
                        rollbackDistance,
                        previousOffset: lastState.scrollOffset,
                        scrolledOffset: currentState.scrollOffset,
                    });

                    await this._browserSideScreenshooter.call("scrollBy", [
                        selectorsToCapture,
                        -rollbackDistance as Coord<"page", "device", "y">,
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

                const movingCaptureSpecs = getMovingCaptureSpecs(currentState, lastState);
                hasCapturedTheWholeArea = movingCaptureSpecs.every(
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

                const remainingCaptureAreaHeight = getRemainingCaptureAreaHeight(
                    movingCaptureSpecs,
                    currentState.safeArea,
                );
                const scrollDelta = getScrollDelta(currentState.safeArea.height, remainingCaptureAreaHeight);

                if (scrollDelta <= 0) {
                    hasCapturedTheWholeArea = true;
                    break;
                }

                debug(
                    "asking to scroll by %dpx (safeArea.height: %d, remaining moving capture area: %d)",
                    scrollDelta,
                    currentState.safeArea.height,
                    remainingCaptureAreaHeight,
                );

                const scrollStartTime = performance.now();
                const scrollResult = await this._browserSideScreenshooter.call("scrollBy", [
                    selectorsToCapture,
                    scrollDelta,
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
            perfDebug(`  wait for stable capture area: ${formatDuration(waitForSettleTime)}`);
            perfDebug(`  recompute capture areas: ${formatDuration(recomputeTime)}`);
            perfDebug(`  scroll between chunks: ${formatDuration(scrollTime)}`);
            perfDebug(`  process current chunk: ${formatDuration(callbackTime)}`);
            perfDebug(
                `  loop overhead: ${formatDuration(
                    performance.now() - startTime - (waitForSettleTime + recomputeTime + scrollTime + callbackTime),
                )}`,
            );
            perfDebug(`  scroll loop total: ${formatDuration(performance.now() - startTime)}`);

            debug(
                `Scrolling finished after ${iterations} iterations, hasCapturedTheWholeArea: ${hasCapturedTheWholeArea}, hasReachedScrollLimit: ${hasReachedScrollLimit}`,
            );
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
        const attemptMode = shouldThrowOnCaptureAreaSizeChange ? "strict" : "best-effort";
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
            anchorShift: null,
        };

        let shouldRestoreScrollPosition = false;

        perfDebug(`capture attempt (${attemptMode}): begin`);
        try {
            await this._scrollThroughCaptureArea(
                selectorsToCapture,
                selectorsToIgnore,
                page,
                opts,
                async currentState => {
                    if (currentState.captureSpecs.length === 0) {
                        if (iterations > 0) {
                            debug(
                                "Capture area disappeared after %d chunk(s), rendering already captured data for selectors: %s",
                                iterations,
                                selectorsToCapture.join("; "),
                            );

                            return;
                        }

                        throw new Error(getEmptyCaptureSpecsErrorMessage(selectorsToCapture));
                    }

                    const hasCaptureAreaSizeChanged =
                        lastState.captureSpecs.length !== currentState.captureSpecs.length ||
                        lastState.captureSpecs.some(
                            (spec, index) =>
                                spec.full.width !== currentState.captureSpecs[index]?.full.width ||
                                spec.full.height !== currentState.captureSpecs[index]?.full.height,
                        );

                    if (hasCaptureAreaSizeChanged && shouldThrowOnCaptureAreaSizeChange) {
                        throw new CaptureAreaSizeChangeError();
                    }

                    const {
                        captureSpecs: newCaptureSpecs,
                        ignoreAreas: newIgnoreAreas,
                        safeArea: newSafeArea,
                    } = currentState;

                    const captureStartTime = performance.now();

                    const viewportImage = await this._camera.captureViewportImage({
                        viewportSize: page.viewportSize,
                        viewportOffset: currentState.viewportOffset,
                        screenshotDelay: opts.screenshotDelay,
                        cropMargins: opts.cropMargins,
                    });

                    timeSpentOnCapture += performance.now() - captureStartTime;

                    const expectedTotalMove = getExpectedTotalMoveFromBaseline(page.captureSpecs, newCaptureSpecs);
                    const observedTotalMove = currentState.anchorShift;

                    let correctionDelta = 0;
                    if (!shouldThrowOnCaptureAreaSizeChange && observedTotalMove !== null) {
                        correctionDelta = expectedTotalMove - observedTotalMove;
                    }

                    if (correctionDelta !== 0) {
                        debug("correctionDelta: %d (raw)", correctionDelta);
                    }

                    const correctionDeltaForComposite = Math.round(correctionDelta);
                    const correctionDeltaToApply = correctionDeltaForComposite === 0 ? 0 : -correctionDeltaForComposite;

                    await image.registerViewportImageAtOffset(
                        viewportImage,
                        newSafeArea,
                        newCaptureSpecs,
                        newIgnoreAreas,
                        correctionDeltaToApply,
                    );

                    hasReachedScrollLimit = iterations > 0 && currentState.scrollOffset <= lastState.scrollOffset;
                    const movingCaptureSpecs = getMovingCaptureSpecs(currentState, lastState);
                    hasCapturedTheWholeArea = movingCaptureSpecs.every(
                        s => getBottom(s.full) <= getBottom(newSafeArea),
                    );
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
            perfDebug(`  raw viewport screenshots: ${formatDuration(timeSpentOnCapture)}`);
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
            perfDebug(`capture attempt (${attemptMode}): end`);
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
