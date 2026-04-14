import { FullPageScreenShooter } from "../../../browser/screen-shooter/full-page-screen-shooter";
import { Image } from "../../../image";
import * as logger from "../../../utils/logger";
import { promiseTimeout } from "../../../utils/promise";
import type { ExistingBrowser } from "../../../browser/existing-browser";

interface FailScreenshot {
    base64: string;
    size: { width: number; height: number };
}

export async function captureFailScreenshot(browser: ExistingBrowser): Promise<FailScreenshot | null> {
    const config = browser.config;
    const timeout = config.takeScreenshotOnFailsTimeout || config.httpTimeout;

    browser.setHttpTimeout(timeout);

    try {
        const result = await promiseTimeout(
            captureScreenshot(browser, config),
            timeout,
            `timed out after ${timeout} ms`,
        );

        return result;
    } catch (e) {
        logger.warn(`WARN: Failed to take screenshot on test fail: ${e}`);

        return null;
    } finally {
        browser.restoreHttpTimeout();
    }
}

async function captureScreenshot(browser: ExistingBrowser, config: ExistingBrowser["config"]): Promise<FailScreenshot> {
    if (config.takeScreenshotOnFailsMode === "fullpage") {
        const screenshooter = await FullPageScreenShooter.create({
            camera: browser.camera,
            browser: browser.publicAPI,
            browserProperties: {
                isWebdriverProtocol: browser.isWebdriverProtocol,
                shouldUsePixelRatio: browser.shouldUsePixelRatio,
                needsCompatLib: browser.needsCompatLib,
            },
        });
        const image = await screenshooter.capture();
        const size = await image.getSize();
        const buffer = await image.toPngBuffer({ resolveWithObject: false });

        return { base64: buffer.toString("base64"), size };
    }

    const base64 = await browser.publicAPI.takeScreenshot();
    const image = Image.fromBase64(base64);
    const size = await image.getSize();

    return { base64, size };
}
