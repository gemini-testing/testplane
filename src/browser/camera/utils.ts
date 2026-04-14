import path from "path";
import fs from "fs";
import { ScreenshotMode } from ".";
import { Image } from "../../image";
import { Rect, Size, getBottom } from "../isomorphic/geometry";
import { saveViewportImageWithDebugRects } from "../screen-shooter/composite-image/debug-utils";

export const isFullPage = (
    imageSize: Rect<"image", "device">,
    viewportSize: Size<"device">,
    calibratedArea: Rect<"image", "device">,
    screenshotMode: ScreenshotMode,
): boolean => {
    // "system ui" is something like status bar on safari mobile, or address bar at the bottom
    const systemUiHeight = calibratedArea.top + (imageSize.height - getBottom(calibratedArea));

    switch (screenshotMode) {
        case "fullpage":
            return true;
        case "viewport":
            return false;
        case "auto":
            return imageSize.height > viewportSize.height + systemUiHeight;
    }
};

export async function saveViewportImageForDebugIfNeeded(
    viewportImage: Image,
    viewportCroppedArea: Rect<"image", "device">,
    debugDir: string | null,
): Promise<void> {
    if (!process.env.TESTPLANE_DEBUG_SCREENSHOTS || !debugDir) {
        return;
    }

    try {
        fs.mkdirSync(debugDir, { recursive: true });

        const timestamp = String(Date.now()).padStart(13, "0");
        const randomId = Math.random().toString(36).substring(2, 8);
        const outputPath = path.join(debugDir, `viewport-${timestamp}-${randomId}.png`);

        await saveViewportImageWithDebugRects(
            viewportImage,
            [
                {
                    rect: viewportCroppedArea as unknown as Rect<"viewport", "device">,
                    color: { r: 0, g: 255, b: 0, a: 255 },
                },
            ],
            outputPath,
        );
    } catch (error) {
        console.warn("Failed to save camera viewport debug image: %O", error);
    }
}
