import fs from "fs";
import path from "path";
import looksSame from "looks-same";
import { CoreError } from "./core-error";
import { ExistingBrowser } from "./existing-browser";
import type { Image, RGB } from "../image";
import { Coord, Length, Rect, Size, XBand, getHeight, getIntersection, getWidth } from "./isomorphic";
import * as logger from "../utils/logger";
import os from "node:os";
import makeDebug from "debug";
import { setTimeout as delay } from "node:timers/promises";

const debug = makeDebug("testplane:screenshots:calibrator");
const MAX_CALIBRATION_ATTEMPTS = 10;
const CALIBRATION_RETRY_DELAY = 100;
const MARKER_COLOR: RGB = { R: 148, G: 250, B: 0 };

interface BrowserFeatures {
    needsCompatLib: boolean;
    pixelRatio: number;
    innerWidth: Length<"css", "x">;
}

export interface CalibrationResult extends BrowserFeatures {
    viewportArea: Rect<"image", "device">;
    screenshotSize: Size<"device">;
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

        debug("calibrating browser %s", browser.id);

        await browser.open("about:blank");
        const features = await browser.evalScript<BrowserFeatures>(this._script);
        debug("features: %O", features);
        let image: Image | null = null;
        let imageFeatures: Rect<"image", "device"> | null = null;

        for (let attempt = 0; attempt < MAX_CALIBRATION_ATTEMPTS; attempt++) {
            image = await browser.captureViewportImage();
            const { width, height } = image.getSize();
            const centerColor = await image.getRGB(Math.floor(width / 2), Math.floor(height / 2));
            const searchColor =
                image.hasICCPChunk && !looksSame.colors(centerColor, { R: 255, G: 255, B: 255 }, { tolerance: 10 })
                    ? centerColor
                    : MARKER_COLOR;

            if (looksSame.colors(searchColor, centerColor, { tolerance: 10 })) {
                imageFeatures = await this._findMarkerAreaInImage(image, searchColor);
                if (imageFeatures) {
                    break;
                }
            }

            if (!imageFeatures && attempt !== MAX_CALIBRATION_ATTEMPTS - 1) {
                await delay(CALIBRATION_RETRY_DELAY);
            }
        }

        if (!imageFeatures || !image) {
            if (image) {
                const screenshotPath = path.join(os.tmpdir(), "testplane-calibration-page.png");
                await image.save(screenshotPath);
                logger.error(
                    "Could not calibrate, because marker area was not found. See calibration page screenshot for details: " +
                        screenshotPath,
                );
            }
            throw new CoreError(
                "Could not calibrate. This could be due to calibration page has failed to open properly",
            );
        }

        const { innerWidth, pixelRatio } = features;
        const hasPixelRatio = Boolean(pixelRatio && pixelRatio > 1.0);
        const screenshotSize = image.getSize() as Size<"device">;

        const calibratedFeatures: CalibrationResult = {
            ...features,
            viewportArea: imageFeatures,
            screenshotSize,
            usePixelRatio: hasPixelRatio && imageFeatures.width > innerWidth,
        };

        this._cache[browser.id] = calibratedFeatures;
        return calibratedFeatures;
    }

    private async _findMarkerAreaInImage(image: Image, searchColor: RGB): Promise<Rect<"image", "device"> | null> {
        const imageHeight = image.getSize().height;
        const imageWidth = image.getSize().width;

        // 80% is a safeguard against shrinking the calibration area too much, happens for irregular interferences on the edges
        const isCalibratedXBandTooSmall = (area: XBand<"image", "device">): boolean => area.width < imageWidth * 0.8;

        let topPart: Rect<"image", "device"> | null = null;

        for (let y = 0 as Coord<"image", "device", "y">; y < imageHeight; y++) {
            const result = await findMarkerXBandInRow(y, image, searchColor);
            if (result && !isCalibratedXBandTooSmall(result)) {
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
            const result = await findMarkerXBandInRow(y, image, searchColor);
            if (result && !isCalibratedXBandTooSmall(result)) {
                const bottomPart = {
                    top: 0,
                    left: result.left,
                    width: result.width,
                    height: getHeight(0 as Coord<"image", "device", "y">, (y + 1) as Coord<"image", "device", "y">),
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
    searchColor: RGB,
): Promise<XBand<"image", "device"> | null> {
    const markerStart = await findMarkerStartInRow(row, image, searchColor);

    if (markerStart === null) {
        return null;
    }

    const markerEnd = await findMarkerEndInRow(row, image, searchColor);

    if (markerEnd === null) {
        return null;
    }

    return {
        left: markerStart,
        width: getWidth(markerStart, (markerEnd + 1) as Coord<"image", "device", "x">),
    };
}

async function isMarkerColorAtPoint(
    image: Image,
    x: Coord<"image", "device", "x">,
    y: Coord<"image", "device", "y">,
    searchColor: RGB,
): Promise<boolean> {
    const color = await image.getRGB(x, y);

    return looksSame.colors(color, searchColor);
}

async function findMarkerStartInRow(
    row: Coord<"image", "device", "y">,
    image: Image,
    searchColor: RGB,
): Promise<Coord<"image", "device", "x"> | null> {
    const imageWidth = image.getSize().width;

    for (let x = 0 as Coord<"image", "device", "x">; x < imageWidth; x++) {
        if (await isMarkerColorAtPoint(image, x, row, searchColor)) {
            return x;
        }
    }

    return null;
}

async function findMarkerEndInRow(
    row: Coord<"image", "device", "y">,
    image: Image,
    searchColor: RGB,
): Promise<Coord<"image", "device", "x"> | null> {
    const imageWidth = image.getSize().width;

    for (let x = (imageWidth - 1) as Coord<"image", "device", "x">; x >= 0; x--) {
        if (await isMarkerColorAtPoint(image, x, row, searchColor)) {
            return x;
        }
    }

    return null;
}
