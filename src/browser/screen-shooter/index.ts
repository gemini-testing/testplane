import { Viewport } from "./viewport";
import { Image } from "../../image";
import { PrepareScreenshotResult } from "./types";
import { ExistingBrowser } from "../existing-browser";

interface ScreenShooterOpts {
    allowViewportOverflow?: boolean;
    compositeImage?: boolean;
    screenshotDelay?: number;
    selectorToScroll?: string;
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
        const { allowViewportOverflow, compositeImage, screenshotDelay, selectorToScroll } = opts;
        const viewportOpts = { allowViewportOverflow, compositeImage };
        const cropImageOpts: CropImageOpts = { screenshotDelay, compositeImage, selectorToScroll };

        const capturedImage = await this._browser.captureViewportImage(page, screenshotDelay);
        const viewport = Viewport.create(page, capturedImage, viewportOpts);
        await viewport.handleImage(capturedImage);

        return this._extendScreenshot(viewport, page, cropImageOpts);
    }

    private async _extendScreenshot(
        viewport: Viewport,
        page: PrepareScreenshotResult,
        opts: CropImageOpts,
    ): Promise<Image> {
        let shouldExtend: boolean;

        try {
            viewport.validate(this._browser);
            shouldExtend = false;
        } catch (error) {
            // Check if this is a HeightViewportError with compositeImage enabled
            shouldExtend =
                error instanceof Error && error.name === "HeightViewportError" && opts.compositeImage === true;
            if (!shouldExtend) {
                console.log("rethrowing error");
                throw error; // Re-throw if not a handleable validation error
            }
        }

        while (shouldExtend) {
            await this._extendImage(viewport, page, opts);

            try {
                viewport.validate(this._browser);
                shouldExtend = false;
            } catch (error) {
                shouldExtend =
                    error instanceof Error && error.name === "HeightViewportError" && opts.compositeImage === true;
                if (!shouldExtend) {
                    console.log("rethrowing error");
                    throw error; // Re-throw if not a handleable validation error
                }
            }
        }

        return viewport.composite();
    }

    private async _extendImage(viewport: Viewport, page: PrepareScreenshotResult, opts: CropImageOpts): Promise<void> {
        const physicalScrollHeight = Math.min(viewport.getVerticalOverflow(), page.viewport.height);
        const logicalScrollHeight = Math.ceil(physicalScrollHeight / page.pixelRatio);

        await this._browser.scrollBy({ x: 0, y: logicalScrollHeight, selector: opts.selectorToScroll });

        page.viewport.top += physicalScrollHeight;

        const newImage = await this._browser.captureViewportImage(page, opts.screenshotDelay);

        await viewport.extendBy(physicalScrollHeight, newImage);
    }
}
