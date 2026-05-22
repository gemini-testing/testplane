import makeDebug from "debug";
import { CompositeImage } from "./composite-image";
import { Image } from "../../image";
import { Coord, Rect, Size, Point } from "../isomorphic/geometry";
import type { DisableHoverMode } from "../isomorphic/types";
import type { WdioBrowser } from "../../types";
import { Camera } from "../camera";
import type * as browserSideScreenshooterImplementation from "../client-scripts/screen-shooter/implementation";
import type { ElementPositionsProbe } from "../client-scripts/screen-shooter/types";
import { ClientBridge } from "../client-bridge";
import { isBrowserSideError } from "../isomorphic/types";
import {
    disableIframeAnimations,
    cleanupPageAnimations,
    cleanupPointerEvents,
    cleanupScrolls,
    preparePointerForScreenshot,
} from "./operations";
import { runWithoutHistory } from "../history";
import { COMPOSITING_ITERATIONS_LIMIT } from "./constants";

const debug = makeDebug("testplane:screenshots:full-page-screen-shooter");

interface ScreenShooterBrowserProperties {
    isWebdriverProtocol: boolean;
    shouldUsePixelRatio: boolean;
    needsCompatLib: boolean;
}

interface FullPageScreenShooterInputParams {
    camera: Camera;
    browser: WdioBrowser;
    browserProperties: ScreenShooterBrowserProperties;
}

interface FullPageScreenShooterFullParams extends FullPageScreenShooterInputParams {
    browserSideScreenshooter: ClientBridge<typeof browserSideScreenshooterImplementation>;
}

interface FullPageCaptureOpts {
    screenshotDelay?: number;
    disableAnimation?: boolean;
    disableHover?: DisableHoverMode;
}

export class FullPageScreenShooter {
    private _browser: WdioBrowser;
    private _camera: Camera;
    private _browserProperties: ScreenShooterBrowserProperties;
    private _browserSideScreenshooter: ClientBridge<typeof browserSideScreenshooterImplementation>;

    static async create(params: FullPageScreenShooterInputParams): Promise<FullPageScreenShooter> {
        const browserSideScreenshooter = await ClientBridge.create<typeof browserSideScreenshooterImplementation>(
            params.browser,
            "screen-shooter",
            { needsCompatLib: params.browserProperties.needsCompatLib },
        );

        return new this({ ...params, browserSideScreenshooter });
    }

    constructor({ browser, camera, browserProperties, browserSideScreenshooter }: FullPageScreenShooterFullParams) {
        this._browser = browser;
        this._camera = camera;
        this._browserProperties = browserProperties;
        this._browserSideScreenshooter = browserSideScreenshooter;
    }

    async capture(opts: FullPageCaptureOpts = {}): Promise<Image> {
        try {
            return await this._captureImpl(opts);
        } finally {
            try {
                await this._cleanup(opts);
            } catch (cleanupError) {
                const cleanupMessage = cleanupError instanceof Error ? cleanupError.message : String(cleanupError);
                console.warn(
                    `Warning: failed to cleanup after full page screenshot.\nCleanup error: ${cleanupMessage}`,
                );
            }
        }
    }

    private async _captureImpl(opts: FullPageCaptureOpts): Promise<Image> {
        const prepareResult = await this._browserSideScreenshooter.call("prepareFullPageScreenshot", [
            {
                usePixelRatio: this._browserProperties.shouldUsePixelRatio,
                disableAnimation: opts.disableAnimation,
                disableHover: opts.disableHover,
            },
        ]);

        if (isBrowserSideError(prepareResult)) {
            throw new Error(
                `Failed to prepare full page screenshot: error '${prepareResult.errorCode}': ${prepareResult.message}`,
            );
        }

        // https://github.com/webdriverio/webdriverio/issues/11396
        if (this._browserProperties.isWebdriverProtocol && opts.disableAnimation) {
            await disableIframeAnimations(this._browser, this._browserSideScreenshooter);
        }

        await preparePointerForScreenshot(this._browser, {
            disableHover: opts.disableHover,
            pointerEventsDisabled: prepareResult.pointerEventsDisabled,
        });

        const { documentSize, viewportSize, safeArea } = prepareResult;
        let lastElementPositionsProbe = prepareResult.elementPositionsProbe;
        let { viewportOffset } = prepareResult;

        debug(
            "Prepared full page screenshot.\n  documentSize: %O\n  viewportSize: %O\n  viewportOffset: %O\n  safeArea: %O",
            documentSize,
            viewportSize,
            viewportOffset,
            safeArea,
        );

        const fullPageRect = this._buildFullPageRect(documentSize, viewportOffset);

        const viewportImage = await this._camera.captureViewportImage({
            viewportSize,
            viewportOffset,
            screenshotDelay: opts.screenshotDelay,
        });

        const compositeImage = CompositeImage.create();
        await compositeImage.registerViewportImageAtOffset(
            viewportImage,
            safeArea,
            [{ full: fullPageRect, visible: fullPageRect }],
            [],
        );

        let hasCapturedWholePage =
            (viewportOffset.top as number) + (viewportSize.height as number) >= (documentSize.height as number);
        let iterations = 0;

        while (!hasCapturedWholePage && iterations < COMPOSITING_ITERATIONS_LIMIT) {
            const scrollResult = await this._browserSideScreenshooter.call("scrollFullPage", [
                safeArea.height,
                { usePixelRatio: this._browserProperties.shouldUsePixelRatio },
            ]);

            if (isBrowserSideError(scrollResult)) {
                throw new Error(
                    `Failed to scroll during full page capture: error '${scrollResult.errorCode}': ${scrollResult.message}`,
                );
            }

            const hasReachedScrollLimit =
                scrollResult.viewportOffset.top === viewportOffset.top &&
                scrollResult.viewportOffset.left === viewportOffset.left;

            if (hasReachedScrollLimit) {
                debug("Reached scroll limit at viewportOffset: %O", viewportOffset);
                break;
            }

            const hasElementPositionsChanged = !this._isElementPositionsProbeEqual(
                lastElementPositionsProbe,
                scrollResult.elementPositionsProbe,
            );
            if (!hasElementPositionsChanged) {
                debug(
                    "Element positions probe did not change after scroll; falling back to initial viewport screenshot",
                );
                return viewportImage;
            }

            lastElementPositionsProbe = scrollResult.elementPositionsProbe;

            viewportOffset = scrollResult.viewportOffset;

            const updatedFullPageRect = this._buildFullPageRect(documentSize, viewportOffset);
            const chunkImage = await this._camera.captureViewportImage({
                viewportSize,
                viewportOffset,
                screenshotDelay: opts.screenshotDelay,
            });

            await compositeImage.registerViewportImageAtOffset(
                chunkImage,
                safeArea,
                [{ full: updatedFullPageRect, visible: updatedFullPageRect }],
                [],
            );

            hasCapturedWholePage =
                (viewportOffset.top as number) + (viewportSize.height as number) >= (documentSize.height as number);
            iterations++;
        }

        debug("Full page capture complete. Iterations: %d, captured whole page: %s", iterations, hasCapturedWholePage);

        return compositeImage.render();
    }

    private _isElementPositionsProbeEqual(
        leftProbe: ElementPositionsProbe<"device">,
        rightProbe: ElementPositionsProbe<"device">,
    ): boolean {
        if (leftProbe.length !== rightProbe.length) {
            return false;
        }

        for (let i = 0; i < leftProbe.length; i++) {
            const left = leftProbe[i];
            const right = rightProbe[i];

            if (left === null || right === null) {
                if (left !== right) {
                    return false;
                }
                continue;
            }

            if (
                left.left !== right.left ||
                left.top !== right.top ||
                left.width !== right.width ||
                left.height !== right.height
            ) {
                return false;
            }
        }

        return true;
    }

    private async _cleanup(opts: FullPageCaptureOpts): Promise<void> {
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

    /**
     * Builds the full-page rect in viewport coordinates.
     * The rect always has the full document dimensions, but its top shifts
     * upward as we scroll (the document "moves up" relative to the viewport).
     */
    private _buildFullPageRect(
        documentSize: Size<"device">,
        viewportOffset: Point<"page", "device">,
    ): Rect<"viewport", "device"> {
        return {
            left: -(viewportOffset.left as number) as Coord<"viewport", "device", "x">,
            top: -(viewportOffset.top as number) as Coord<"viewport", "device", "y">,
            width: documentSize.width,
            height: documentSize.height,
        };
    }
}
