import makeDebug from "debug";
import { Image } from "../../image";
import type { DisableHoverMode } from "../isomorphic/types";
import type { WdioBrowser } from "../../types";
import { Camera } from "../camera";
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

const debug = makeDebug("testplane:screenshots:viewport-screen-shooter");

interface ScreenShooterBrowserProperties {
    isWebdriverProtocol: boolean;
    shouldUsePixelRatio: boolean;
    needsCompatLib: boolean;
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
    screenshotDelay?: number;
    disableAnimation?: boolean;
    disableHover?: DisableHoverMode;
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

    private async _captureImpl(opts: ViewportCaptureOpts): Promise<ViewportCaptureResult> {
        const prepareResult = await runWithoutHistory({}, () =>
            this._browserSideScreenshooter.call("prepareViewportScreenshot", [
                {
                    usePixelRatio: this._browserProperties.shouldUsePixelRatio,
                    disableAnimation: opts.disableAnimation,
                    disableHover: opts.disableHover,
                },
            ]),
        );

        debug("prepareViewportScreenshot opts: %O", {
            usePixelRatio: this._browserProperties.shouldUsePixelRatio,
            disableAnimation: opts.disableAnimation,
            disableHover: opts.disableHover,
        });
        debug("prepareViewportScreenshot result: %O", prepareResult);

        if (isBrowserSideError(prepareResult)) {
            throw new Error(
                `Failed to prepare viewport screenshot: error '${prepareResult.errorCode}': ${prepareResult.message}`,
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

        const { viewportSize, viewportOffset } = prepareResult;

        debug("Capturing viewport screenshot.\n  viewportSize: %O\n  viewportOffset: %O", viewportSize, viewportOffset);

        const image = await this._camera.captureViewportImage({
            viewportSize,
            viewportOffset,
            screenshotDelay: opts.screenshotDelay,
        });

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
