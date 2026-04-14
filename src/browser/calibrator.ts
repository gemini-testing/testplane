import fs from "fs";
import path from "path";
import looksSame from "looks-same";
import { CoreError } from "./core-error";
import { ExistingBrowser } from "./existing-browser";
import type { Image } from "../image";
import { Coord, Length, Rect, XBand, getHeight, getIntersection, getWidth } from "./isomorphic";
import * as logger from "../utils/logger";
import os from "node:os";

interface BrowserFeatures {
    needsCompatLib: boolean;
    pixelRatio: number;
    innerWidth: Length<"css", "x">;
}

export interface CalibrationResult extends BrowserFeatures {
    viewportArea: Rect<"image", "device">;
    usePixelRatio: boolean;
}

export class Calibrator {
    private _cache: Record<string, CalibrationResult>;
    private _script: string;

    constructor() {
        this._cache = {};
        this._script = fs.readFileSync(path.join(__dirname, "client-scripts", "calibrate.js"), "utf8");
    }

    async calibrate(browser: ExistingBrowser): Promise<CalibrationResult> {
        if (this._cache[browser.id]) {
            return this._cache[browser.id];
        }

        await browser.open("about:blank");
        const features = await browser.evalScript<BrowserFeatures>(this._script);
        const image = await browser.captureViewportImage();

        const { innerWidth, pixelRatio } = features;
        const hasPixelRatio = Boolean(pixelRatio && pixelRatio > 1.0);
        const imageFeatures = await this._findMarkerAreaInImage(image);

        if (!imageFeatures) {
            const screenshotPath = path.join(os.tmpdir(), "testplane-calibration-page.png");
            await image.save(screenshotPath);
            logger.error(
                "Could not calibrate, because marker area was not found. See calibration page screenshot for details: " +
                    screenshotPath,
            );
            await image.save(screenshotPath);
            throw new CoreError(
                "Could not calibrate. This could be due to calibration page has failed to open properly",
            );
        }

        const calibratedFeatures: CalibrationResult = {
            ...features,
            viewportArea: imageFeatures,
            usePixelRatio: hasPixelRatio && imageFeatures.width > innerWidth,
        };

        this._cache[browser.id] = calibratedFeatures;
        return calibratedFeatures;
    }

    private async _findMarkerAreaInImage(image: Image): Promise<Rect<"image", "device"> | null> {
        const imageHeight = (await image.getSize()).height;

        let topPart: Rect<"image", "device"> | null = null;

        for (let y = 0 as Coord<"image", "device", "y">; y < imageHeight; y++) {
            const result = await findMarkerXBandInRow(y, image);
            if (result) {
                topPart = {
                    top: y,
                    left: result.left,
                    width: result.width,
                    height: getHeight(y, imageHeight as Coord<"image", "device", "y">),
                };
                break;
            }
        }

        if (topPart === null) {
            return null;
        }

        for (let y = (imageHeight - 1) as Coord<"image", "device", "y">; y >= 0; y--) {
            const result = await findMarkerXBandInRow(y, image);
            if (result) {
                const bottomPart = {
                    top: 0,
                    left: result.left,
                    width: result.width,
                    height: getHeight(0 as Coord<"image", "device", "y">, y),
                };

                return getIntersection(topPart, bottomPart);
            }
        }

        return null;
    }
}

async function findMarkerXBandInRow(
    row: Coord<"image", "device", "y">,
    image: Image,
): Promise<XBand<"image", "device"> | null> {
    const markerStart = await findMarkerStartInRow(row, image);

    if (markerStart === null) {
        return null;
    }

    const markerEnd = await findMarkerEndInRow(row, image);

    if (markerEnd === null) {
        return null;
    }

    return {
        left: markerStart,
        width: getWidth(markerStart, markerEnd),
    };
}

async function isMarkerColorAtPoint(
    image: Image,
    x: Coord<"image", "device", "x">,
    y: Coord<"image", "device", "y">,
): Promise<boolean> {
    const searchColor = { R: 148, G: 250, B: 0 };
    const color = await image.getRGB(x, y);

    return looksSame.colors(color, searchColor);
}

async function findMarkerStartInRow(
    row: Coord<"image", "device", "y">,
    image: Image,
): Promise<Coord<"image", "device", "x"> | null> {
    const imageWidth = (await image.getSize()).width;

    for (let x = 0 as Coord<"image", "device", "x">; x < imageWidth; x++) {
        if (await isMarkerColorAtPoint(image, x, row)) {
            return x;
        }
    }

    return null;
}

async function findMarkerEndInRow(
    row: Coord<"image", "device", "y">,
    image: Image,
): Promise<Coord<"image", "device", "x"> | null> {
    const imageWidth = (await image.getSize()).width;

    for (let x = (imageWidth - 1) as Coord<"image", "device", "x">; x >= 0; x--) {
        if (await isMarkerColorAtPoint(image, x, row)) {
            return x;
        }
    }

    return null;
}
