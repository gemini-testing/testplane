import fs from "node:fs";
import path from "node:path";
import { CompositeImage } from "src/browser/screen-shooter/composite-image";
import { Rect, Size, Length, Coord, YBand } from "@isomorphic";
import { Image } from "src/image";
import { convertRgbaToPng } from "src/utils/eight-bit-rgba-to-png";

interface UnsafeTopAreaSpec {
    top: number;
    height: number;
}

interface UnsafeBottomAreaSpec {
    bottom: number;
    height: number;
}

type UnsafeAreaSpec = UnsafeTopAreaSpec | UnsafeBottomAreaSpec;

interface ScenarioChunkDefinition {
    height: Length<"device", "y">;
    offsetTop: Coord<"page", "device", "y">;
    offsetLeft?: Coord<"page", "device", "x">;
    width?: Length<"device", "x">;
    ignoreAreas?: Rect<"page", "device">[];
}

export interface ScenarioInput {
    id: string;
    pageSize: Size<"device">;
    captureArea: Rect<"page", "device">;
    ignoreAreas: Rect<"page", "device">[];
    unsafeAreas: UnsafeAreaSpec[];
    chunks: ScenarioChunkDefinition[];
}

interface GeneratedChunk {
    file: string;
    safeArea: YBand<"viewport", "device">;
    captureSpecs: Array<{
        full: Rect<"viewport", "device">;
        visible: Rect<"viewport", "device">;
    }>;
    ignoreBoundingRects: Rect<"viewport", "device">[];
}

export interface ScenarioGenerationResult {
    id: string;
    fullPage: string;
    expected: string;
    chunks: GeneratedChunk[];
}

type RGBA = [number, number, number, number];

const WHITE: RGBA = [255, 255, 255, 255];
const GRAY: RGBA = [128, 128, 128, 255];
const RED: RGBA = [220, 20, 60, 255];
const ORANGE: RGBA = [255, 165, 0, 255];
const BLUE: RGBA = [0, 0, 255, 255];

const toPageX = (value: number): Coord<"page", "device", "x"> => value as Coord<"page", "device", "x">;
const toPageY = (value: number): Coord<"page", "device", "y"> => value as Coord<"page", "device", "y">;
const toDeviceYLength = (value: number): Length<"device", "y"> => value as Length<"device", "y">;

const toViewportRect = (rect: {
    left: number;
    top: number;
    width: number;
    height: number;
}): Rect<"viewport", "device"> => {
    return {
        left: rect.left as Coord<"viewport", "device", "x">,
        top: rect.top as Coord<"viewport", "device", "y">,
        width: rect.width as Length<"device", "x">,
        height: rect.height as Length<"device", "y">,
    };
};

const toViewportYBand = (top: number, height: number): YBand<"viewport", "device"> => {
    return {
        top: top as Coord<"viewport", "device", "y">,
        height: height as Length<"device", "y">,
    };
};

const isUnsafeTopArea = (area: UnsafeAreaSpec): area is UnsafeTopAreaSpec => {
    return "top" in area;
};

const getChunkOffsetTop = (chunkDefinition: ScenarioChunkDefinition): Coord<"page", "device", "y"> => {
    return chunkDefinition.offsetTop;
};

const getChunkOffsetLeft = (chunkDefinition: ScenarioChunkDefinition): Coord<"page", "device", "x"> => {
    return chunkDefinition.offsetLeft ?? toPageX(0);
};

const setPixel = (
    data: Buffer,
    width: Length<"device", "x">,
    height: Length<"device", "y">,
    x: Coord<"page", "device", "x">,
    y: Coord<"page", "device", "y">,
    color: RGBA,
): void => {
    if (x < 0 || x >= width || y < 0 || y >= height) {
        return;
    }

    const offset = (y * width + x) * 4;
    data[offset] = color[0];
    data[offset + 1] = color[1];
    data[offset + 2] = color[2];
    data[offset + 3] = color[3];
};

const fillRect = (
    data: Buffer,
    width: Length<"device", "x">,
    height: Length<"device", "y">,
    rect: Rect<"page", "device">,
    color: RGBA,
): void => {
    const left = Math.max(0, rect.left);
    const top = Math.max(0, rect.top);
    const right = Math.min(width, rect.left + rect.width);
    const bottom = Math.min(height, rect.top + rect.height);

    for (let y = top; y < bottom; y++) {
        for (let x = left; x < right; x++) {
            setPixel(data, width, height, x as Coord<"page", "device", "x">, y as Coord<"page", "device", "y">, color);
        }
    }
};

const drawLine = (
    data: Buffer,
    width: Length<"device", "x">,
    height: Length<"device", "y">,
    x0: Coord<"page", "device", "x">,
    y0: Coord<"page", "device", "y">,
    x1: Coord<"page", "device", "x">,
    y1: Coord<"page", "device", "y">,
    color: RGBA,
): void => {
    let currentX = x0;
    let currentY = y0;
    const deltaX = Math.abs(x1 - x0);
    const deltaY = Math.abs(y1 - y0);
    const stepX = x0 < x1 ? 1 : -1;
    const stepY = y0 < y1 ? 1 : -1;
    let error = deltaX - deltaY;

    // eslint-disable-next-line no-constant-condition
    while (true) {
        setPixel(data, width, height, currentX, currentY, color);
        if (currentX === x1 && currentY === y1) {
            break;
        }

        const doubleError = 2 * error;
        if (doubleError > -deltaY) {
            error -= deltaY;
            currentX = (currentX + stepX) as Coord<"page", "device", "x">;
        }
        if (doubleError < deltaX) {
            error += deltaX;
            currentY = (currentY + stepY) as Coord<"page", "device", "y">;
        }
    }
};

const drawRectangle = (
    data: Buffer,
    width: Length<"device", "x">,
    height: Length<"device", "y">,
    rect: Rect<"page", "device">,
    color: RGBA,
): void => {
    const left = rect.left as number;
    const top = rect.top as number;
    const right = left + (rect.width as number) - 1;
    const bottom = top + (rect.height as number) - 1;

    drawLine(data, width, height, toPageX(left), toPageY(top), toPageX(right), toPageY(top), color);
    drawLine(data, width, height, toPageX(right), toPageY(top), toPageX(right), toPageY(bottom), color);
    drawLine(data, width, height, toPageX(right), toPageY(bottom), toPageX(left), toPageY(bottom), color);
    drawLine(data, width, height, toPageX(left), toPageY(bottom), toPageX(left), toPageY(top), color);
};

const drawCaptureArea = (page: Buffer, pageSize: Size<"device">, captureArea: Rect<"page", "device">): void => {
    fillRect(
        page,
        pageSize.width as Length<"device", "x">,
        pageSize.height as Length<"device", "y">,
        captureArea,
        GRAY,
    );
    drawRectangle(
        page,
        pageSize.width as Length<"device", "x">,
        pageSize.height as Length<"device", "y">,
        captureArea,
        BLUE,
    );
    drawLine(
        page,
        pageSize.width as Length<"device", "x">,
        pageSize.height as Length<"device", "y">,
        captureArea.left,
        captureArea.top,
        toPageX((captureArea.left as number) + (captureArea.width as number) - 1),
        toPageY((captureArea.top as number) + (captureArea.height as number) - 1),
        BLUE,
    );
    drawLine(
        page,
        pageSize.width as Length<"device", "x">,
        pageSize.height as Length<"device", "y">,
        toPageX((captureArea.left as number) + (captureArea.width as number) - 1),
        captureArea.top,
        captureArea.left,
        toPageY((captureArea.top as number) + (captureArea.height as number) - 1),
        BLUE,
    );
};

const crop = (
    source: Buffer,
    sourceWidth: Length<"device", "x">,
    sourceHeight: Length<"device", "y">,
    left: Coord<"page", "device", "x">,
    top: Coord<"page", "device", "y">,
    width: Length<"device", "x">,
    height: Length<"device", "y">,
): Buffer => {
    const sourceWidthNumber = sourceWidth as number;
    const sourceHeightNumber = sourceHeight as number;
    const leftNumber = left as number;
    const topNumber = top as number;
    const widthNumber = width as number;
    const heightNumber = height as number;
    const target = Buffer.alloc(widthNumber * heightNumber * 4);

    for (let y = 0; y < heightNumber; y++) {
        const sourceY = topNumber + y;
        if (sourceY < 0 || sourceY >= sourceHeightNumber) {
            continue;
        }

        for (let x = 0; x < widthNumber; x++) {
            const sourceX = leftNumber + x;
            if (sourceX < 0 || sourceX >= sourceWidthNumber) {
                continue;
            }

            const sourceOffset = (sourceY * sourceWidthNumber + sourceX) * 4;
            const targetOffset = (y * widthNumber + x) * 4;
            target[targetOffset] = source[sourceOffset];
            target[targetOffset + 1] = source[sourceOffset + 1];
            target[targetOffset + 2] = source[sourceOffset + 2];
            target[targetOffset + 3] = source[sourceOffset + 3];
        }
    }

    return target;
};

const applyUnsafeAreasToChunk = (
    chunkBuffer: Buffer,
    chunkWidth: Length<"device", "x">,
    chunkHeight: Length<"device", "y">,
    unsafeAreas: UnsafeAreaSpec[],
): void => {
    const chunkHeightNumber = chunkHeight as number;

    for (const unsafeArea of unsafeAreas) {
        if (isUnsafeTopArea(unsafeArea)) {
            fillRect(
                chunkBuffer,
                chunkWidth,
                chunkHeight,
                {
                    left: toPageX(0),
                    top: toPageY(unsafeArea.top),
                    width: chunkWidth,
                    height: toDeviceYLength(unsafeArea.height),
                },
                RED,
            );
            continue;
        }

        fillRect(
            chunkBuffer,
            chunkWidth,
            chunkHeight,
            {
                left: toPageX(0),
                top: toPageY(chunkHeightNumber - unsafeArea.bottom - unsafeArea.height),
                width: chunkWidth,
                height: toDeviceYLength(unsafeArea.height),
            },
            RED,
        );
    }
};

const computeSafeArea = (
    chunkHeight: Length<"device", "y">,
    unsafeAreas: UnsafeAreaSpec[],
): YBand<"viewport", "device"> => {
    const chunkHeightNumber = chunkHeight as number;
    let safeTop = 0;
    let safeBottom = chunkHeightNumber;

    for (const unsafeArea of unsafeAreas) {
        if (isUnsafeTopArea(unsafeArea)) {
            safeTop = Math.max(safeTop, unsafeArea.top + unsafeArea.height);
            continue;
        }

        safeBottom = Math.min(safeBottom, chunkHeightNumber - unsafeArea.bottom - unsafeArea.height);
    }

    const clampedSafeTop = Math.max(0, Math.min(chunkHeightNumber, safeTop));
    const clampedSafeBottom = Math.max(clampedSafeTop, Math.min(chunkHeightNumber, safeBottom));

    return toViewportYBand(clampedSafeTop, clampedSafeBottom - clampedSafeTop);
};

const saveRgbaAsPng = async (
    filePath: string,
    rgba: Buffer,
    width: Length<"device", "x">,
    height: Length<"device", "y">,
): Promise<void> => {
    const png = convertRgbaToPng(rgba, width as number, height as number);
    await fs.promises.writeFile(filePath, png);
};

export const createScenario = async (
    input: ScenarioInput,
    rootDir: string = __dirname,
): Promise<ScenarioGenerationResult> => {
    const scenarioDir = path.join(rootDir, input.id);
    await fs.promises.mkdir(scenarioDir, { recursive: true });
    const chunksDir = path.join(scenarioDir, "chunks");
    await fs.promises.mkdir(chunksDir, { recursive: true });

    const page = Buffer.alloc((input.pageSize.width as number) * (input.pageSize.height as number) * 4);
    fillRect(
        page,
        input.pageSize.width as Length<"device", "x">,
        input.pageSize.height as Length<"device", "y">,
        {
            left: toPageX(0),
            top: toPageY(0),
            width: input.pageSize.width as Length<"device", "x">,
            height: input.pageSize.height as Length<"device", "y">,
        },
        WHITE,
    );

    drawCaptureArea(page, input.pageSize, input.captureArea);

    for (const ignoreArea of input.ignoreAreas) {
        fillRect(
            page,
            input.pageSize.width as Length<"device", "x">,
            input.pageSize.height as Length<"device", "y">,
            ignoreArea,
            ORANGE,
        );
    }

    const fullPagePath = path.posix.join(scenarioDir, "full-page.png");
    await saveRgbaAsPng(
        fullPagePath,
        page,
        input.pageSize.width as Length<"device", "x">,
        input.pageSize.height as Length<"device", "y">,
    );

    const compositeImage = CompositeImage.create();
    const chunkResults: GeneratedChunk[] = [];

    for (let chunkIndex = 0; chunkIndex < input.chunks.length; chunkIndex++) {
        const chunkDefinition = input.chunks[chunkIndex];
        const chunkWidth = chunkDefinition.width ?? (input.pageSize.width as Length<"device", "x">);
        const chunkHeight = chunkDefinition.height;
        const chunkOffsetTop = getChunkOffsetTop(chunkDefinition);
        const chunkOffsetLeft = getChunkOffsetLeft(chunkDefinition);
        const chunkRgba = crop(
            page,
            input.pageSize.width as Length<"device", "x">,
            input.pageSize.height as Length<"device", "y">,
            chunkOffsetLeft,
            chunkOffsetTop,
            chunkWidth,
            chunkHeight,
        );

        applyUnsafeAreasToChunk(chunkRgba, chunkWidth, chunkHeight, input.unsafeAreas);

        const chunkPath = path.posix.join(chunksDir, `${chunkIndex}.png`);
        await saveRgbaAsPng(chunkPath, chunkRgba, chunkWidth, chunkHeight);

        const chunkPng = convertRgbaToPng(chunkRgba, chunkWidth as number, chunkHeight as number);
        const chunkImage = Image.create(chunkPng);
        const safeArea = computeSafeArea(chunkHeight, input.unsafeAreas);
        const captureBoundingRect = toViewportRect({
            left: (input.captureArea.left as number) - (chunkOffsetLeft as number),
            top: (input.captureArea.top as number) - (chunkOffsetTop as number),
            width: Math.min(
                input.captureArea.width as number,
                (chunkWidth as number) - ((input.captureArea.left as number) - (chunkOffsetLeft as number)),
            ),
            height: input.captureArea.height as number,
        });
        const ignoreBoundingRects = [...input.ignoreAreas, ...(chunkDefinition.ignoreAreas ?? [])].map(area => {
            return toViewportRect({
                left: (area.left as number) - (chunkOffsetLeft as number),
                top: (area.top as number) - (chunkOffsetTop as number),
                width: area.width as number,
                height: area.height as number,
            });
        });

        await compositeImage.registerViewportImageAtOffset(
            chunkImage,
            safeArea,
            [{ full: captureBoundingRect, visible: captureBoundingRect }],
            ignoreBoundingRects,
        );

        chunkResults.push({
            file: path.relative(rootDir, chunkPath),
            safeArea,
            captureSpecs: [{ full: captureBoundingRect, visible: captureBoundingRect }],
            ignoreBoundingRects,
        });
    }

    const expectedImage = await compositeImage.render();
    const expectedPath = path.posix.join(scenarioDir, "expected.png");
    await expectedImage.save(expectedPath);

    const result = {
        id: input.id,
        fullPage: path.relative(rootDir, fullPagePath),
        expected: path.relative(rootDir, expectedPath),
        chunks: chunkResults,
    };

    return result;
};

const scenarios = [
    createScenario({
        id: "single-chunk-in-view",
        pageSize: { width: 1024 as Length<"device", "x">, height: 1024 as Length<"device", "y"> },
        captureArea: {
            left: 200 as Coord<"page", "device", "x">,
            top: 200 as Coord<"page", "device", "y">,
            width: 500 as Length<"device", "x">,
            height: 500 as Length<"device", "y">,
        },
        ignoreAreas: [],
        unsafeAreas: [],
        chunks: [
            {
                height: 1024 as Length<"device", "y">,
                offsetTop: 0 as Coord<"page", "device", "y">,
            },
        ],
    }),
    createScenario({
        id: "single-chunk-slightly-out-of-view",
        pageSize: { width: 1024 as Length<"device", "x">, height: 1800 as Length<"device", "y"> },
        captureArea: {
            left: 200 as Coord<"page", "device", "x">,
            top: 800 as Coord<"page", "device", "y">,
            width: 500 as Length<"device", "x">,
            height: 500 as Length<"device", "y">,
        },
        ignoreAreas: [],
        unsafeAreas: [],
        chunks: [
            {
                height: 1024 as Length<"device", "y">,
                offsetTop: 0 as Coord<"page", "device", "y">,
            },
        ],
    }),
    createScenario({
        id: "single-chunk-completely-out-of-view",
        pageSize: { width: 1024 as Length<"device", "x">, height: 1800 as Length<"device", "y"> },
        captureArea: {
            left: 200 as Coord<"page", "device", "x">,
            top: 1100 as Coord<"page", "device", "y">,
            width: 500 as Length<"device", "x">,
            height: 500 as Length<"device", "y">,
        },
        ignoreAreas: [],
        unsafeAreas: [],
        chunks: [
            {
                height: 1024 as Length<"device", "y">,
                offsetTop: 0 as Coord<"page", "device", "y">,
            },
        ],
    }),
    createScenario({
        id: "single-chunk-safe-area-expansion-top",
        pageSize: { width: 1024 as Length<"device", "x">, height: 1024 as Length<"device", "y"> },
        captureArea: {
            left: 200 as Coord<"page", "device", "x">,
            top: 200 as Coord<"page", "device", "y">,
            width: 500 as Length<"device", "x">,
            height: 500 as Length<"device", "y">,
        },
        ignoreAreas: [],
        unsafeAreas: [
            {
                top: 0,
                height: 300,
            },
        ],
        chunks: [
            {
                height: 1024 as Length<"device", "y">,
                offsetTop: 0 as Coord<"page", "device", "y">,
            },
        ],
    }),
    createScenario({
        id: "single-chunk-safe-area-expansion-bottom",
        pageSize: { width: 1024 as Length<"device", "x">, height: 1024 as Length<"device", "y"> },
        captureArea: {
            left: 200 as Coord<"page", "device", "x">,
            top: 200 as Coord<"page", "device", "y">,
            width: 500 as Length<"device", "x">,
            height: 500 as Length<"device", "y">,
        },
        ignoreAreas: [],
        unsafeAreas: [
            {
                bottom: 0,
                height: 600,
            },
        ],
        chunks: [
            {
                height: 1024 as Length<"device", "y">,
                offsetTop: 0 as Coord<"page", "device", "y">,
            },
        ],
    }),
    createScenario({
        id: "single-chunk-safe-area-expansion-top-and-bottom",
        pageSize: { width: 1024 as Length<"device", "x">, height: 1024 as Length<"device", "y"> },
        captureArea: {
            left: 200 as Coord<"page", "device", "x">,
            top: 200 as Coord<"page", "device", "y">,
            width: 500 as Length<"device", "x">,
            height: 500 as Length<"device", "y">,
        },
        ignoreAreas: [],
        unsafeAreas: [
            {
                top: 0,
                height: 300,
            },
            {
                bottom: 0,
                height: 400,
            },
        ],
        chunks: [
            {
                height: 1024 as Length<"device", "y">,
                offsetTop: 0 as Coord<"page", "device", "y">,
            },
        ],
    }),
    createScenario({
        id: "two-chunks-with-gap",
        pageSize: { width: 1024 as Length<"device", "x">, height: 1800 as Length<"device", "y"> },
        captureArea: {
            left: 200 as Coord<"page", "device", "x">,
            top: 200 as Coord<"page", "device", "y">,
            width: 500 as Length<"device", "x">,
            height: 500 as Length<"device", "y">,
        },
        ignoreAreas: [],
        unsafeAreas: [],
        chunks: [
            {
                height: 400 as Length<"device", "y">,
                offsetTop: 0 as Coord<"page", "device", "y">,
            },
            {
                height: 800 as Length<"device", "y">,
                offsetTop: 500 as Coord<"page", "device", "y">,
            },
        ],
    }),
    createScenario({
        id: "two-chunks-relax-upper-bottom",
        pageSize: { width: 1024 as Length<"device", "x">, height: 1800 as Length<"device", "y"> },
        captureArea: {
            left: 200 as Coord<"page", "device", "x">,
            top: 200 as Coord<"page", "device", "y">,
            width: 500 as Length<"device", "x">,
            height: 500 as Length<"device", "y">,
        },
        ignoreAreas: [],
        unsafeAreas: [
            {
                bottom: 0,
                height: 100,
            },
        ],
        chunks: [
            {
                height: 500 as Length<"device", "y">,
                offsetTop: 0 as Coord<"page", "device", "y">,
            },
            {
                height: 500 as Length<"device", "y">,
                offsetTop: 500 as Coord<"page", "device", "y">,
            },
        ],
    }),
    createScenario({
        id: "two-chunks-relax-lower-top",
        pageSize: { width: 1024 as Length<"device", "x">, height: 1800 as Length<"device", "y"> },
        captureArea: {
            left: 200 as Coord<"page", "device", "x">,
            top: 200 as Coord<"page", "device", "y">,
            width: 500 as Length<"device", "x">,
            height: 500 as Length<"device", "y">,
        },
        ignoreAreas: [],
        unsafeAreas: [
            {
                top: 0,
                height: 100,
            },
        ],
        chunks: [
            {
                height: 500 as Length<"device", "y">,
                offsetTop: 0 as Coord<"page", "device", "y">,
            },
            {
                height: 500 as Length<"device", "y">,
                offsetTop: 500 as Coord<"page", "device", "y">,
            },
        ],
    }),
    createScenario({
        id: "two-equal-chunks",
        pageSize: { width: 1024 as Length<"device", "x">, height: 1024 as Length<"device", "y"> },
        captureArea: {
            left: 200 as Coord<"page", "device", "x">,
            top: 200 as Coord<"page", "device", "y">,
            width: 500 as Length<"device", "x">,
            height: 500 as Length<"device", "y">,
        },
        ignoreAreas: [],
        unsafeAreas: [],
        chunks: [
            {
                height: 1024 as Length<"device", "y">,
                offsetTop: 0 as Coord<"page", "device", "y">,
            },
            {
                height: 1024 as Length<"device", "y">,
                offsetTop: 0 as Coord<"page", "device", "y">,
            },
        ],
    }),
    createScenario({
        id: "multiple-overlapping-chunks-with-safe-areas",
        pageSize: { width: 1024 as Length<"device", "x">, height: 1800 as Length<"device", "y"> },
        captureArea: {
            left: 200 as Coord<"page", "device", "x">,
            top: 200 as Coord<"page", "device", "y">,
            width: 500 as Length<"device", "x">,
            height: 500 as Length<"device", "y">,
        },
        ignoreAreas: [],
        unsafeAreas: [
            {
                bottom: 0,
                height: 100,
            },
        ],
        chunks: [
            {
                height: 400 as Length<"device", "y">,
                offsetTop: 0 as Coord<"page", "device", "y">,
            },
            {
                height: 400 as Length<"device", "y">,
                offsetTop: 100 as Coord<"page", "device", "y">,
            },
            {
                height: 400 as Length<"device", "y">,
                offsetTop: 200 as Coord<"page", "device", "y">,
            },
            {
                height: 400 as Length<"device", "y">,
                offsetTop: 300 as Coord<"page", "device", "y">,
            },
            {
                height: 400 as Length<"device", "y">,
                offsetTop: 400 as Coord<"page", "device", "y">,
            },
        ],
    }),
    createScenario({
        id: "multiple-chunks-with-horizontal-shifts",
        pageSize: { width: 1024 as Length<"device", "x">, height: 1800 as Length<"device", "y"> },
        captureArea: {
            left: 200 as Coord<"page", "device", "x">,
            top: 200 as Coord<"page", "device", "y">,
            width: 500 as Length<"device", "x">,
            height: 500 as Length<"device", "y">,
        },
        ignoreAreas: [],
        unsafeAreas: [
            {
                bottom: 0,
                height: 100,
            },
        ],
        chunks: [
            {
                height: 400 as Length<"device", "y">,
                offsetTop: 0 as Coord<"page", "device", "y">,
                width: 1000 as Length<"device", "x">,
            },
            {
                height: 400 as Length<"device", "y">,
                offsetTop: 100 as Coord<"page", "device", "y">,
                width: 800 as Length<"device", "x">,
                offsetLeft: 100 as Coord<"page", "device", "x">,
            },
            {
                height: 400 as Length<"device", "y">,
                offsetTop: 200 as Coord<"page", "device", "y">,
                width: 600 as Length<"device", "x">,
                offsetLeft: 150 as Coord<"page", "device", "x">,
            },
            {
                height: 400 as Length<"device", "y">,
                offsetTop: 300 as Coord<"page", "device", "y">,
                offsetLeft: 10 as Coord<"page", "device", "x">,
            },
            {
                height: 400 as Length<"device", "y">,
                offsetTop: 400 as Coord<"page", "device", "y">,
            },
        ],
    }),
    createScenario({
        id: "multiple-chunks-with-safe-areas-and-ignore-areas",
        pageSize: { width: 1024 as Length<"device", "x">, height: 1800 as Length<"device", "y"> },
        captureArea: {
            left: 200 as Coord<"page", "device", "x">,
            top: 200 as Coord<"page", "device", "y">,
            width: 500 as Length<"device", "x">,
            height: 500 as Length<"device", "y">,
        },
        ignoreAreas: [
            {
                left: 300 as Coord<"page", "device", "x">,
                top: 100 as Coord<"page", "device", "y">,
                width: 100 as Length<"device", "x">,
                height: 400 as Length<"device", "y">,
            },
        ],
        unsafeAreas: [
            {
                top: 0,
                height: 100,
            },
            {
                bottom: 0,
                height: 700,
            },
        ],
        chunks: [
            {
                height: 1024 as Length<"device", "y">,
                offsetTop: 100 as Coord<"page", "device", "y">,
            },
            {
                height: 1024 as Length<"device", "y">,
                offsetTop: 200 as Coord<"page", "device", "y">,
            },
            {
                height: 1024 as Length<"device", "y">,
                offsetTop: 300 as Coord<"page", "device", "y">,
            },
            {
                height: 1024 as Length<"device", "y">,
                offsetTop: 400 as Coord<"page", "device", "y">,
            },
        ],
    }),
    (async (): Promise<ScenarioGenerationResult> => {
        const id = "duplicate-chunks-with-offscreen-zero-visible-spec";
        const scenarioDir = path.join(__dirname, id);
        const chunksDir = path.join(scenarioDir, "chunks");
        await fs.promises.mkdir(chunksDir, { recursive: true });

        const viewportWidth = 1024 as Length<"device", "x">;
        const viewportHeight = 1024 as Length<"device", "y">;
        const safeArea = toViewportYBand(0, viewportHeight as number);
        const fixedRect = toViewportRect({ left: 200, top: 620, width: 500, height: 260 });
        const ignoreBoundingRects: Rect<"viewport", "device">[] = [];
        const weirdChunkDefs = [120, -500, -800, -800];
        const chunkResults: ScenarioGenerationResult["chunks"] = [];
        let firstChunkRgba: Buffer | null = null;

        const drawVisibleSpec = (rgba: Buffer, visibleRect: Rect<"viewport", "device">): void => {
            if ((visibleRect.width as number) <= 0 || (visibleRect.height as number) <= 0) {
                return;
            }

            drawCaptureArea(
                rgba,
                { width: viewportWidth, height: viewportHeight },
                {
                    left: toPageX(visibleRect.left as number),
                    top: toPageY(visibleRect.top as number),
                    width: visibleRect.width as Length<"device", "x">,
                    height: visibleRect.height as Length<"device", "y">,
                },
            );
        };

        for (let chunkIndex = 0; chunkIndex < weirdChunkDefs.length; chunkIndex++) {
            const chunkRgba = Buffer.alloc((viewportWidth as number) * (viewportHeight as number) * 4);
            fillRect(
                chunkRgba,
                viewportWidth,
                viewportHeight,
                {
                    left: toPageX(0),
                    top: toPageY(0),
                    width: viewportWidth,
                    height: viewportHeight,
                },
                WHITE,
            );

            const movingTop = weirdChunkDefs[chunkIndex];
            const movingVisibleHeight = movingTop >= 0 ? 420 : 0;
            const chunkPath = path.posix.join(chunksDir, `${chunkIndex}.png`);
            const movingSpec = {
                full: toViewportRect({ left: 200, top: movingTop, width: 500, height: 420 }),
                visible: toViewportRect({
                    left: 200,
                    top: movingTop,
                    width: 500,
                    height: movingVisibleHeight,
                }),
            };
            const captureSpecs = [movingSpec, { full: fixedRect, visible: fixedRect }];

            for (const spec of captureSpecs) {
                drawVisibleSpec(chunkRgba, spec.visible);
            }

            await saveRgbaAsPng(chunkPath, chunkRgba, viewportWidth, viewportHeight);

            if (chunkIndex === 0) {
                firstChunkRgba = chunkRgba;
            }

            chunkResults.push({
                file: path.relative(__dirname, chunkPath),
                safeArea,
                captureSpecs,
                ignoreBoundingRects,
            });
        }

        if (!firstChunkRgba) {
            throw new Error(
                "Failed to build first chunk for duplicate-chunks-with-offscreen-zero-visible-spec scenario",
            );
        }

        const expectedRgba = crop(
            firstChunkRgba,
            viewportWidth,
            viewportHeight,
            toPageX(200),
            toPageY(120),
            500 as Length<"device", "x">,
            760 as Length<"device", "y">,
        );
        const expectedPath = path.posix.join(scenarioDir, "expected.png");
        await saveRgbaAsPng(expectedPath, expectedRgba, 500 as Length<"device", "x">, 760 as Length<"device", "y">);

        const fullPagePath = path.posix.join(scenarioDir, "full-page.png");
        await saveRgbaAsPng(fullPagePath, expectedRgba, 500 as Length<"device", "x">, 760 as Length<"device", "y">);

        return {
            id,
            fullPage: path.relative(__dirname, fullPagePath),
            expected: path.relative(__dirname, expectedPath),
            chunks: chunkResults,
        };
    })(),
] satisfies Promise<ScenarioGenerationResult>[];

Promise.all(scenarios).then(async results => {
    await fs.promises.writeFile(path.join(__dirname, "data.json"), JSON.stringify(results, null, 4) + "\n");
    console.log("Generation completed.");
});
