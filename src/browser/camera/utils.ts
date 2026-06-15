import path from "path";
import fs from "fs";
import type { ScreenshotMode } from ".";
import { Image } from "../../image";
import { Coord, Rect, Size, getBottom } from "../isomorphic/geometry";
import { saveViewportImageWithDebugRects } from "../screen-shooter/composite-image/debug-utils";

export interface CropMargins {
    top?: number;
    right?: number;
    bottom?: number;
    left?: number;
}

type NormalizedCropMargins = Required<CropMargins>;

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

export const normalizeCropMargins = (cropMargins: CropMargins | undefined): NormalizedCropMargins => {
    const result = {
        top: cropMargins?.top ?? 0,
        right: cropMargins?.right ?? 0,
        bottom: cropMargins?.bottom ?? 0,
        left: cropMargins?.left ?? 0,
    };

    for (const side of ["top", "right", "bottom", "left"] as const) {
        const value = result[side];
        if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || Math.floor(value) !== value) {
            throw new Error(
                `Invalid cropMargins.${side} option: expected a non-negative integer, got ${String(value)}`,
            );
        }
    }

    return result;
};

export const cropMarginsToRect = (
    imageArea: Rect<"image", "device">,
    cropMargins: CropMargins | undefined,
): Rect<"image", "device"> => {
    const margins = normalizeCropMargins(cropMargins);

    return {
        top: margins.top as Coord<"image", "device", "y">,
        left: margins.left as Coord<"image", "device", "x">,
        width: ((imageArea.width as number) - margins.left - margins.right) as typeof imageArea.width,
        height: ((imageArea.height as number) - margins.top - margins.bottom) as typeof imageArea.height,
    };
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
