import { Image } from "../../image";
import type { DisableHoverMode } from "../isomorphic/types";
import type { WdioBrowser } from "../../types";
import { Camera, type CropMargins } from "../camera";
import type * as browserSideScreenshooterImplementation from "../client-scripts/screen-shooter/implementation";
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
import { makeVerboseScreenshotsDebug } from "./debug";

const debug = makeVerboseScreenshotsDebug("testplane:screenshots:viewport-screen-shooter");

interface ScreenShooterBrowserProperties {
    isWebdriverProtocol: boolean;
    shouldUsePixelRatio: boolean;
    needsCompatLib: boolean;
    isHeadless: boolean;
    emulatedPixelRatio?: number;
}

interface ViewportScreenShooterInputParams {
    camera: Camera;
    browser: WdioBrowser;
    browserProperties: ScreenShooterBrowserProperties;
}

interface ViewportScreenShooterFullParams extends ViewportScreenShooterInputParams {
    browserSideScreenshooter: ClientBridge<typeof browserSideScreenshooterImplementation>;
}

interface ViewportCaptureOpts {
    ignoreElements?: string | string[];
    screenshotDelay?: number;
    disableAnimation?: boolean;
    disableHover?: DisableHoverMode;
    cropMargins?: CropMargins;
    preferredPixelRatio?: number;
}

interface ViewportCaptureResult {
    image: Image;
    meta: { canHaveCaret: boolean; pixelRatio: number };
}

export class ViewportScreenShooter {
    private _browser: WdioBrowser;
    private _camera: Camera;
    private _browserProperties: ScreenShooterBrowserProperties;
    private _browserSideScreenshooter: ClientBridge<typeof browserSideScreenshooterImplementation>;

    static async create(params: ViewportScreenShooterInputParams): Promise<ViewportScreenShooter> {
        const browserSideScreenshooter = await ClientBridge.create<typeof browserSideScreenshooterImplementation>(
            params.browser,
            "screen-shooter",
            { needsCompatLib: params.browserProperties.needsCompatLib },
        );

        return new this({ ...params, browserSideScreenshooter });
    }

    constructor({ browser, camera, browserProperties, browserSideScreenshooter }: ViewportScreenShooterFullParams) {
        this._browser = browser;
        this._camera = camera;
        this._browserProperties = browserProperties;
        this._browserSideScreenshooter = browserSideScreenshooter;
    }

    async capture(opts: ViewportCaptureOpts = {}): Promise<ViewportCaptureResult> {
        if (
            this._browserProperties.shouldUsePixelRatio &&
            !this._browserProperties.isHeadless &&
            this._browserProperties.emulatedPixelRatio !== undefined
        ) {
            opts.preferredPixelRatio = this._browserProperties.emulatedPixelRatio;
        }

        try {
            return await this._captureImpl(opts);
        } finally {
            try {
                await this._cleanup(opts);
            } catch (cleanupError) {
                const msg = cleanupError instanceof Error ? cleanupError.message : String(cleanupError);
                console.warn(`Warning: failed to cleanup after viewport screenshot.\nCleanup error: ${msg}`);
            }
        }
    }

    private async _captureImpl(opts: ViewportCaptureOpts, isRetry = false): Promise<ViewportCaptureResult> {
        const selectorsToIgnore = ([] as string[]).concat(opts.ignoreElements ?? []);
        // Keep the initial preparation side effects and their cleanup callbacks intact during the retry.
        const disableAnimation = isRetry ? false : opts.disableAnimation;
        const disableHover = isRetry ? undefined : opts.disableHover;

        const prepareResult = await runWithoutHistory({}, () =>
            this._browserSideScreenshooter.call("prepareViewportScreenshot", [
                {
                    usePixelRatio: this._browserProperties.shouldUsePixelRatio,
                    disableAnimation,
                    disableHover,
                    ignoreSelectors: selectorsToIgnore,
                    preferredPixelRatio: opts.preferredPixelRatio,
                },
            ]),
        );

        debug("prepareViewportScreenshot opts: %O", {
            usePixelRatio: this._browserProperties.shouldUsePixelRatio,
            disableAnimation,
            disableHover,
            ignoreSelectors: selectorsToIgnore,
            preferredPixelRatio: opts.preferredPixelRatio,
        });
        debug("prepareViewportScreenshot result: %O", prepareResult);

        if (isBrowserSideError(prepareResult)) {
            throw new Error(
                `Failed to prepare viewport screenshot: error '${prepareResult.errorCode}': ${prepareResult.message}`,
            );
        }

        // https://github.com/webdriverio/webdriverio/issues/11396
        if (this._browserProperties.isWebdriverProtocol && disableAnimation) {
            await disableIframeAnimations(this._browser, this._browserSideScreenshooter);
        }

        await preparePointerForScreenshot(this._browser, {
            disableHover,
            pointerEventsDisabled: prepareResult.pointerEventsDisabled,
        });

        const { viewportSize, viewportOffset } = prepareResult;

        debug("Capturing viewport screenshot.\n  viewportSize: %O\n  viewportOffset: %O", viewportSize, viewportOffset);

        const image = await this._camera.captureViewportImage({
            viewportSize,
            viewportOffset,
            screenshotDelay: opts.screenshotDelay,
            cropMargins: opts.cropMargins,
        });

        if (opts.preferredPixelRatio !== undefined) {
            const currentPixelRatio = await this._browserSideScreenshooter.call("getCurrentPixelRatio", []);

            if (currentPixelRatio !== opts.preferredPixelRatio) {
                delete opts.preferredPixelRatio;

                return this._captureImpl(opts, true);
            }
        }

        if (prepareResult.ignoreAreas.length > 0) {
            const cropOffset = {
                left: opts.cropMargins?.left ?? 0,
                top: opts.cropMargins?.top ?? 0,
            };

            for (const ignoreArea of prepareResult.ignoreAreas) {
                await image.addClear({
                    ...ignoreArea,
                    left: ignoreArea.left - cropOffset.left,
                    top: ignoreArea.top - cropOffset.top,
                });
            }
            await image.applyJoin();
        }

        return {
            image,
            meta: {
                canHaveCaret: prepareResult.canHaveCaret,
                pixelRatio: prepareResult.pixelRatio,
            },
        };
    }

    private async _cleanup(opts: ViewportCaptureOpts): Promise<void> {
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
}
