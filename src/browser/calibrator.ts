import fs from "fs";
import path from "path";
import looksSame from "looks-same";
import { CoreError } from "./core-error";
import {ExistingBrowser} from "./existing-browser";
import {RGBA} from "../image";

const DIRECTION = { FORWARD: "forward", REVERSE: "reverse" } as const;

interface BrowserFeatures {
    needsCompatLib: boolean;
    pixelRatio: number;
    innerWidth: number;
}

export interface CalibrationResult extends BrowserFeatures {
    top: number;
    left: number;
    usePixelRatio: boolean;
}

interface ViewportStart {
    x: number;
    y: number;
}

interface ImageAnalysisResult {
    viewportStart: ViewportStart;
    colorLength?: number;
}

interface Image {
    getSize(): Promise<{ width: number; height: number }>;
    getRGBA(x: number, y: number): Promise<{ r: number; g: number; b: number; a: number }>;
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
        const imageFeatures = await this._analyzeImage(image, { calculateColorLength: hasPixelRatio });

        if (!imageFeatures) {
            throw new CoreError(
                "Could not calibrate. This could be due to calibration page has failed to open properly"
            );
        }

        const calibratedFeatures: CalibrationResult = {
            ...features,
            top: imageFeatures.viewportStart.y,
            left: imageFeatures.viewportStart.x,
            usePixelRatio: hasPixelRatio && imageFeatures.colorLength! > innerWidth,
        };

        this._cache[browser.id] = calibratedFeatures;
        return calibratedFeatures;
    }

    private async _analyzeImage(image: Image, params: { calculateColorLength?: boolean }): Promise<ImageAnalysisResult | null> {
        const imageHeight = (await image.getSize()).height;

        for (let y = 0; y < imageHeight; y++) {
            const result = await analyzeRow(y, image, params);
            if (result) {
                return result;
            }
        }

        return null;
    }
}

async function analyzeRow(row: number, image: Image, params: { calculateColorLength?: boolean } = {}): Promise<ImageAnalysisResult | null> {
    const markerStart = await findMarkerInRow(row, image, DIRECTION.FORWARD);

    if (markerStart === -1) {
        return null;
    }

    const result: ImageAnalysisResult = { viewportStart: { x: markerStart, y: row } };

    if (!params.calculateColorLength) {
        return result;
    }

    const markerEnd = await findMarkerInRow(row, image, DIRECTION.REVERSE);
    const colorLength = markerEnd - markerStart + 1;

    return { ...result, colorLength };
}

async function findMarkerInRow(row: number, image: Image, searchDirection: "forward" | "reverse"): Promise<number> {
    const imageWidth = (await image.getSize()).width;
    const searchColor = { R: 148, G: 250, B: 0 };

    if (searchDirection === DIRECTION.REVERSE) {
        return searchReverse_();
    } else {
        return searchForward_();
    }

    async function searchForward_(): Promise<number> {
        for (let x = 0; x < imageWidth; x++) {
            if (await compare_(x)) {
                return x;
            }
        }
        return -1;
    }

    async function searchReverse_(): Promise<number> {
        for (let x = imageWidth - 1; x >= 0; x--) {
            if (await compare_(x)) {
                return x;
            }
        }
        return -1;
    }

    async function compare_(x: number): Promise<boolean> {
        const pixel = await image.getRGBA(x, row);
        const color = pickRGB(pixel);
        return looksSame.colors(color, searchColor);
    }
}

function pickRGB(rgba: RGBA): { R: number; G: number; B: number } {
    return { R: rgba.r, G: rgba.g, B: rgba.b };
}
