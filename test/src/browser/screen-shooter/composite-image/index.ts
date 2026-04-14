"use strict";

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { Image } from "src/image";
import { CompositeImage } from "src/browser/screen-shooter/composite-image";
import { Rect, YBand } from "src/browser/isomorphic/geometry";
import { ScenarioGenerationResult } from "./fixtures/generate";
import looksSame from "looks-same";

const FIXTURES_DIR = path.join(__dirname, "fixtures");
const fixturesData = JSON.parse(
    fs.readFileSync(path.join(FIXTURES_DIR, "data.json"), "utf-8"),
) as ScenarioGenerationResult[];

type CaptureSpecFixture = {
    full: Rect<"viewport", "device">;
    visible: Rect<"viewport", "device">;
};

type ChunkFixture = ScenarioGenerationResult["chunks"][number] & {
    captureSpecs?: CaptureSpecFixture[];
};

describe("CompositeImage", () => {
    describe("registerViewportImageAtOffset", () => {
        it("should throw if capture area width/height is zero or negative", async () => {
            const compositeImage = CompositeImage.create();
            const image = new Image({ width: 100, height: 100 });

            await assert.isRejected(
                compositeImage.registerViewportImageAtOffset(
                    image,
                    { top: 0, height: 100 } as YBand<"viewport", "device">,
                    [
                        {
                            full: { left: 0, top: 0, width: 0, height: 100 } as Rect<"viewport", "device">,
                            visible: { left: 0, top: 0, width: 0, height: 100 } as Rect<"viewport", "device">,
                        },
                    ],
                    [],
                ),
                /Capture area size cannot be zero or negative/,
            );
        });
    });

    describe("render", () => {
        let tempDir: string | null = null;
        let shouldCleanupTempDir = true;

        beforeEach(async () => {
            tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "composite-image-unit-"));
            shouldCleanupTempDir = true;
        });

        afterEach(async () => {
            if (shouldCleanupTempDir && tempDir) {
                await fs.promises.rm(tempDir, { recursive: true, force: true });
                tempDir = null;
            }
        });

        it("should throw when no chunks are registered", async () => {
            const compositeImage = CompositeImage.create();

            await assert.isRejected(
                compositeImage.render(),
                /Cannot render composite image: no chunks were registered/,
            );
        });

        it("should reject render when chunk image is not a valid png", async () => {
            const compositeImage = CompositeImage.create();
            const malformedPngBuffer = Buffer.alloc(64);
            malformedPngBuffer.writeUInt32BE(100, 16);
            malformedPngBuffer.writeUInt32BE(100, 20);
            const invalidImage = Image.create(malformedPngBuffer);

            await compositeImage.registerViewportImageAtOffset(
                invalidImage,
                { top: 0, height: 100 } as YBand<"viewport", "device">,
                [
                    {
                        full: { left: 0, top: 0, width: 100, height: 100 } as Rect<"viewport", "device">,
                        visible: { left: 0, top: 0, width: 100, height: 100 } as Rect<"viewport", "device">,
                    },
                ],
                [],
            );

            await assert.isRejected(compositeImage.render(), /Failed to decode image/);
        });

        it("should contain fixture scenarios to validate", () => {
            assert.isArray(fixturesData);
            assert.isAbove(fixturesData.length, 0);
        });

        for (const scenario of fixturesData) {
            it(`should render fixture scenario "${scenario.id}"`, async () => {
                const compositeImage = CompositeImage.create();

                for (const chunk of scenario.chunks) {
                    const fixtureChunk = chunk as ChunkFixture;
                    const imageBuffer = await fs.promises.readFile(path.join(FIXTURES_DIR, chunk.file));
                    const chunkImage = Image.create(imageBuffer);
                    const captureSpecs = fixtureChunk.captureSpecs;

                    await compositeImage.registerViewportImageAtOffset(
                        chunkImage,
                        chunk.safeArea,
                        captureSpecs,
                        chunk.ignoreBoundingRects,
                    );
                }

                const renderedImage = await compositeImage.render();

                const actualPath = path.join(tempDir!, `${scenario.id}.actual.png`);
                const expectedPath = path.join(FIXTURES_DIR, scenario.expected);

                await renderedImage.save(actualPath);

                const comparison = await looksSame(actualPath, expectedPath, { tolerance: 0 });
                if (!comparison.equal) {
                    shouldCleanupTempDir = false;
                    console.log(
                        `Images do not match for scenario "${scenario.id}".\n\nActual: ${actualPath}\nExpected: ${expectedPath}`,
                    );
                }
                assert.isTrue(comparison.equal, `Expected fixture to match for scenario "${scenario.id}"`);
            });
        }
    });
});
