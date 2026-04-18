import fs from "node:fs";
import { Image } from "../../../image";
import { convertRgbaToPng } from "../../../utils/eight-bit-rgba-to-png";
import { loadEsm } from "../../../utils/preload-utils";
import type { Coord, Rect, Size, YBand } from "../../isomorphic/geometry";
import path from "node:path";
import { CaptureSpec } from "../../client-scripts/screen-shooter/types";

type DebugRectColor = { r: number; g: number; b: number; a: number };

export type ViewportDebugRect = {
    rect: Rect<"viewport", "device">;
    color: DebugRectColor;
};

/* This file is used for debugging purposes only, to produce images with capture areas, safe areas, etc. visible when TESTPLANE_DEBUG_SCREENSHOTS is set */

export const COMPOSITE_IMAGE_DEBUG_COLORS = {
    safeArea: { r: 0, g: 255, b: 0, a: 255 },
    captureSpecVisible: { r: 255, g: 0, b: 0, a: 255 },
    visibleCoveringRect: { r: 255, g: 105, b: 180, a: 255 },
} as const;

const initJsquashPromise = new Promise<unknown>(resolve => {
    const wasmLocation = require.resolve("@jsquash/png/codec/pkg/squoosh_png_bg.wasm");

    Promise.all([
        loadEsm<typeof import("@jsquash/png/decode.js")>("@jsquash/png/decode.js"),
        fs.promises.readFile(wasmLocation),
    ])
        .then(([mod, wasmBytes]) => mod.init(wasmBytes))
        .then(resolve);
});

const decodePngToRgba = async (buffer: Buffer): Promise<{ data: Buffer; width: number; height: number }> => {
    const [mod] = await Promise.all([
        loadEsm<typeof import("@jsquash/png/decode.js")>("@jsquash/png/decode.js"),
        initJsquashPromise,
    ]);
    const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
    const imageData = await mod.decode(arrayBuffer, { bitDepth: 8 });

    return {
        data: Buffer.from(imageData.data.buffer, imageData.data.byteOffset, imageData.data.byteLength),
        width: imageData.width,
        height: imageData.height,
    };
};

function setPixel(
    rgbaData: Buffer,
    imageWidth: number,
    imageHeight: number,
    x: number,
    y: number,
    color: DebugRectColor,
): void {
    if (x < 0 || y < 0 || x >= imageWidth || y >= imageHeight) {
        return;
    }

    const offset = (y * imageWidth + x) * 4;
    rgbaData[offset] = color.r;
    rgbaData[offset + 1] = color.g;
    rgbaData[offset + 2] = color.b;
    rgbaData[offset + 3] = color.a;
}

function drawRectOutline(
    rgbaData: Buffer,
    imageWidth: number,
    imageHeight: number,
    rect: Rect<"viewport", "device">,
    color: DebugRectColor,
): void {
    const left = Math.max(0, Math.floor(rect.left as number));
    const top = Math.max(0, Math.floor(rect.top as number));
    const right = Math.min(imageWidth - 1, Math.ceil((rect.left as number) + (rect.width as number)) - 1);
    const bottom = Math.min(imageHeight - 1, Math.ceil((rect.top as number) + (rect.height as number)) - 1);

    if (right < left || bottom < top) {
        return;
    }

    for (let x = left; x <= right; x++) {
        setPixel(rgbaData, imageWidth, imageHeight, x, top, color);
        setPixel(rgbaData, imageWidth, imageHeight, x, bottom, color);
    }

    for (let y = top; y <= bottom; y++) {
        setPixel(rgbaData, imageWidth, imageHeight, left, y, color);
        setPixel(rgbaData, imageWidth, imageHeight, right, y, color);
    }
}

export async function saveViewportImageWithDebugRects(
    image: Image,
    rects: ViewportDebugRect[],
    outputPath: string,
): Promise<void> {
    const pngBuffer = await image.toPngBuffer({ resolveWithObject: false });
    const { data, width, height } = await decodePngToRgba(pngBuffer);

    for (const { rect, color } of rects) {
        drawRectOutline(data, width, height, rect, color);
    }

    const annotatedPngBuffer = convertRgbaToPng(data, width, height);
    await fs.promises.writeFile(outputPath, annotatedPngBuffer);
}

export async function saveRenderedPiecesForDebugIfNeeded(
    renderedPieces: Image[],
    destinationDirPath: string | null,
): Promise<void> {
    if (process.env.TESTPLANE_DEBUG_SCREENSHOTS && destinationDirPath) {
        const tmpDir = path.join(destinationDirPath, "rendered-pieces");
        fs.mkdirSync(tmpDir, { recursive: true });
        for (let index = 0; index < renderedPieces.length; index++) {
            const renderedPiece = renderedPieces[index];
            const piecePath = path.join(tmpDir, `rendered-piece-${index}.png`);

            await renderedPiece.save(piecePath);
        }

        console.log(`Testplane Composite image pieces saved to ${destinationDirPath}`);
    }
}

export async function saveViewportImageForDebugIfNeeded(
    chunkIndex: number,
    viewportImage: Image,
    imageSize: Size<"device">,
    safeArea: YBand<"viewport", "device">,
    captureSpecs: CaptureSpec<"viewport", "device">[],
    visibleCoveringRect: Rect<"viewport", "device">,
    destinationDirPath: string | null,
): Promise<void> {
    if (!process.env.TESTPLANE_DEBUG_SCREENSHOTS || !destinationDirPath) {
        return;
    }

    try {
        const viewportDebugDir = path.join(destinationDirPath, `viewports`);
        fs.mkdirSync(viewportDebugDir, { recursive: true });

        const debugRects: Array<{
            rect: Rect<"viewport", "device">;
            color: { r: number; g: number; b: number; a: number };
        }> = [
            {
                rect: {
                    left: 0 as Coord<"viewport", "device", "x">,
                    top: safeArea.top,
                    width: imageSize.width,
                    height: safeArea.height,
                },
                color: COMPOSITE_IMAGE_DEBUG_COLORS.safeArea,
            },
            ...captureSpecs
                .filter(spec => spec.visible.width > 0 && spec.visible.height > 0)
                .map(spec => ({
                    rect: spec.visible,
                    color: COMPOSITE_IMAGE_DEBUG_COLORS.captureSpecVisible,
                })),
            {
                rect: visibleCoveringRect,
                color: COMPOSITE_IMAGE_DEBUG_COLORS.visibleCoveringRect,
            },
        ];

        await saveViewportImageWithDebugRects(
            viewportImage,
            debugRects,
            path.join(viewportDebugDir, `viewport-${chunkIndex}.png`),
        );
    } catch (error) {
        console.warn("Failed to save viewport debug image: %O", error);
    }
}
