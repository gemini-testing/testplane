import os from "node:os";
import path from "node:path";
import makeDebug from "debug";
import { Image } from "../../../image";
import {
    YBand,
    XBand,
    Rect,
    Size,
    getSize,
    prettySize,
    subtractCoords,
    Coord,
    getBottom,
    getMaxCoord,
    getMinCoord,
    getHeight,
    intersectYBands,
    getMaxLength,
    intersectXBands,
    Length,
    fromCaptureAreaToViewport,
    fromViewportToCaptureArea,
    getCoveringRect,
} from "../../isomorphic/geometry";
import type { CaptureSpec } from "../../client-scripts/screen-shooter/types";
import { saveRenderedPiecesForDebugIfNeeded, saveViewportImageForDebugIfNeeded } from "./debug-utils";

const debug = makeDebug("testplane:screenshots:composite-image");

/** Raw chunk data as registered by the caller. */
interface CompositeChunk {
    image: Image;
    imageSize: Size<"device">;
    safeArea: YBand<"viewport", "device">;
    captureSpecs: CaptureSpec<"viewport", "device">[];
    boundingRectsToIgnore: Rect<"viewport", "device">[];
}

/** Chunk enriched with render-time computed anchor top. */
interface AnchoredChunk extends CompositeChunk {
    anchorTop: Coord<"viewport", "device", "y">;
}

interface SegmentCandidate {
    chunk: AnchoredChunk;
    /** Preferred vertical crop area candidate, which fully respects safe area. */
    strict: YBand<"viewport", "device"> | null;
    /** Possible vertical crop area candidate, which respects bottom edge of safe area, but includes area beyond safe area at the top. */
    relaxTop: YBand<"viewport", "device"> | null;
    /** Possible vertical crop area candidate, which respects top edge of safe area, but includes area beyond safe area at the bottom. */
    relaxBottom: YBand<"viewport", "device"> | null;
    /** Possible vertical crop area candidate which doesn't respect safe area at all and contains the entire viewport. */
    full: YBand<"viewport", "device"> | null;
    /** Chosen vertical crop area candidate, which will be used to crop the viewport image. */
    chosen: YBand<"viewport", "device"> | null;
}

type RenderPiece =
    | { type: "chunk"; chunk: AnchoredChunk; verticalArea: YBand<"viewport", "device"> }
    | { type: "black"; height: Length<"device", "y"> };

export class CompositeImage {
    private _captureAreaSize: Size<"device"> | null;
    private _compositeChunks: CompositeChunk[];
    private _debugTmpDir: string | null = null;

    static create(...args: ConstructorParameters<typeof CompositeImage>): CompositeImage {
        return new this(...args);
    }

    constructor() {
        this._captureAreaSize = null;
        this._compositeChunks = [];
        if (process.env.TESTPLANE_DEBUG_SCREENSHOTS) {
            this._debugTmpDir = path.join(
                os.tmpdir(),
                `testplane-composite-image-${Math.random().toString(36).slice(2)}`,
            );
        }
    }

    /**
     * Registers a viewport image with corresponding safe area, capture bounding rects and ignore bounding rects, all relative to the viewport.
     * The order of registration can be arbitrary, viewport height can change between chunks, gaps will be handled gracefully.
     * Expects finite integer coords and sizes, otherwise behavior is undefined.
     * @throws {Error} if capture area size is zero or negative
     */
    async registerViewportImageAtOffset(
        viewportImage: Image,
        safeArea: YBand<"viewport", "device">,
        captureSpecs: CaptureSpec<"viewport", "device">[],
        ignoreBoundingRects: Rect<"viewport", "device">[],
    ): Promise<void> {
        const visibleCoveringRect =
            this._getVisibleCoveringRect({ captureSpecs }) ?? getCoveringRect(captureSpecs.map(s => s.visible));

        if (!this._captureAreaSize) {
            this._captureAreaSize = getSize(visibleCoveringRect);
        }

        if (this._captureAreaSize.width <= 0 || this._captureAreaSize.height <= 0) {
            throw new Error("Capture area size cannot be zero or negative. Got: " + prettySize(this._captureAreaSize));
        }

        const imageSize = (await viewportImage.getSize()) as Size<"device">;

        debug(
            "Captured the next chunk.\n  captureSpecs: %O\n  visibleCoveringRect: %O\n  ignoreBoundingRects: %O\n  viewportImageSize: %O",
            captureSpecs,
            visibleCoveringRect,
            ignoreBoundingRects,
            imageSize,
        );

        await saveViewportImageForDebugIfNeeded(
            this._compositeChunks.length,
            viewportImage,
            imageSize,
            safeArea,
            captureSpecs,
            visibleCoveringRect,
            this._debugTmpDir,
        );

        this._compositeChunks.push({
            image: viewportImage,
            imageSize,
            safeArea,
            captureSpecs,
            boundingRectsToIgnore: ignoreBoundingRects,
        });
    }

    /**
     * Renders a composite image from the registered chunks.
     * @throws {Error} if trying to render with zero chunks registered
     * @throws {Error} if any of the chunks contain malformed PNG data
     */
    async render(): Promise<Image> {
        if (!this._compositeChunks.length) {
            throw new Error(
                "Cannot render composite image: no chunks were registered.\n" +
                    "This means that screenshot was not captured even once and we have no image to render.",
            );
        }

        if (!this._captureAreaSize) {
            throw new Error(
                "Cannot render composite image: capture area size is not set.\n" +
                    "This means registerViewportImageAtOffset was never called with a valid capture rect.",
            );
        }

        const anchoredChunks = this._computeAnchoredChunks();
        const commonHorizontalArea = this._computeCommonHorizontalAreaIfNeeded(
            anchoredChunks,
            this._captureAreaSize.width,
        );
        const captureWidth = commonHorizontalArea?.width ?? this._captureAreaSize.width;

        const sortedChunks = anchoredChunks.slice().sort((a, b) => subtractCoords(b.anchorTop, a.anchorTop));

        const candidates = sortedChunks.map(chunk => this._buildCandidate(chunk));

        debug("Candidates: %O", candidates);

        this._chooseBestCandidates(candidates);

        debug("Chosen best candidates: %O", candidates);

        const pieces = this._buildRenderPieces(candidates);

        debug("Rendering composite image. chunks: %d, pieces: %O", this._compositeChunks.length, pieces);

        const renderedPieces: Image[] = [];

        for (const piece of pieces) {
            if (piece.type === "black") {
                renderedPieces.push(await this._createBlackPiece(piece.height, captureWidth));
                continue;
            }

            if (piece.verticalArea.height <= 0) {
                continue;
            }

            renderedPieces.push(
                await this._createChunkPiece(piece.chunk, piece.verticalArea, captureWidth, commonHorizontalArea),
            );
        }

        await saveRenderedPiecesForDebugIfNeeded(renderedPieces, this._debugTmpDir);

        if (!renderedPieces.length) {
            return this._createBlackPiece(this._captureAreaSize.height, captureWidth);
        }

        const result = renderedPieces[0];

        if (renderedPieces.length > 1) {
            result.addJoin(renderedPieces.slice(1));
        }

        await result.applyJoin();

        return result;
    }

    /**
     * Computes anchor tops for all chunks by comparing element rects against a reference chunk
     * (the one with the highest covering rect top). Reference chunk gets anchorTop = its covering rect top.
     * Other chunks get anchorTop = referenceCoveringRectTop - maxDelta, where maxDelta is the max
     * downward movement of any element rect compared to the reference.
     */
    private _computeAnchoredChunks(): AnchoredChunk[] {
        let referenceIndex = 0;
        let referenceCoveringRectTop = getCoveringRect(this._compositeChunks[0].captureSpecs.map(s => s.full)).top;

        for (let i = 1; i < this._compositeChunks.length; i++) {
            const coveringRectTop = getCoveringRect(this._compositeChunks[i].captureSpecs.map(s => s.full)).top;
            if (coveringRectTop > referenceCoveringRectTop) {
                referenceIndex = i;
                referenceCoveringRectTop = coveringRectTop;
            }
        }

        const referenceCaptureSpecs = this._compositeChunks[referenceIndex].captureSpecs;

        const anchoredChunks = this._compositeChunks.map((chunk, index) => {
            if (index === referenceIndex) {
                return { ...chunk, anchorTop: referenceCoveringRectTop };
            }

            let maxDelta = 0;
            const minLength = Math.min(chunk.captureSpecs.length, referenceCaptureSpecs.length);
            for (let i = 0; i < minLength; i++) {
                const referenceSpec = referenceCaptureSpecs[i];
                const chunkSpec = chunk.captureSpecs[i];

                if (!this._isRenderableCaptureSpec(referenceSpec) || !this._isRenderableCaptureSpec(chunkSpec)) {
                    continue;
                }

                const delta = subtractCoords(referenceSpec.full.top, chunkSpec.full.top);
                if (delta > maxDelta) {
                    maxDelta = delta;
                }
            }

            return {
                ...chunk,
                anchorTop: ((referenceCoveringRectTop as number) - maxDelta) as Coord<"viewport", "device", "y">,
            };
        });

        debug("Anchored chunks: %O", anchoredChunks);

        this._applyHeightChangeAnchorFixups(anchoredChunks);

        return anchoredChunks;
    }

    private _applyHeightChangeAnchorFixups(chunks: AnchoredChunk[]): void {
        if (chunks.length < 2) {
            return;
        }

        debug("Applying height change anchor fixups");

        const sortedChunks = chunks.slice().sort((a, b) => subtractCoords(b.anchorTop, a.anchorTop));

        for (let i = 1; i < sortedChunks.length; i++) {
            const previousChunk = sortedChunks[i - 1];
            const currentChunk = sortedChunks[i];
            const heightDelta = this._getHeightDeltaFromDifferingCaptureSpec(previousChunk, currentChunk);

            if (!this._shouldTreatHeightChangeAsStartShift(heightDelta)) {
                continue;
            }

            debug(
                "Shifting anchor top for chunk %d by %d. Old anchor top: %d, new anchor top: %d",
                i,
                heightDelta,
                currentChunk.anchorTop,
                currentChunk.anchorTop - heightDelta,
            );
            currentChunk.anchorTop = ((currentChunk.anchorTop as number) - heightDelta) as Coord<
                "viewport",
                "device",
                "y"
            >;
        }
    }

    private _getHeightDeltaFromDifferingCaptureSpec(
        previousChunk: AnchoredChunk,
        currentChunk: AnchoredChunk,
    ): number | null {
        const minLength = Math.min(previousChunk.captureSpecs.length, currentChunk.captureSpecs.length);

        for (let i = 0; i < minLength; i++) {
            const previousSpecHeight = previousChunk.captureSpecs[i].full.height as number;
            const currentSpecHeight = currentChunk.captureSpecs[i].full.height as number;

            if (previousSpecHeight !== currentSpecHeight) {
                return previousSpecHeight - currentSpecHeight;
            }
        }

        return null;
    }

    private _shouldTreatHeightChangeAsStartShift(heightDelta: number | null): heightDelta is number {
        return typeof heightDelta === "number" && heightDelta > 0;
    }

    private _isRenderableCaptureSpec(spec: CaptureSpec<"viewport", "device">): boolean {
        return spec.visible.width > 0 && spec.visible.height > 0;
    }

    private _getVisibleCoveringRect(chunk: Pick<CompositeChunk, "captureSpecs">): Rect<"viewport", "device"> | null {
        const visibleRects = chunk.captureSpecs
            .filter(spec => this._isRenderableCaptureSpec(spec))
            .map(spec => spec.visible);

        if (!visibleRects.length) {
            return null;
        }

        return getCoveringRect(visibleRects);
    }

    private _buildCandidate(chunk: AnchoredChunk): SegmentCandidate {
        const strict = this._getYBandForMode(chunk, "strict");
        const relaxTop = this._getYBandForMode(chunk, "relaxTop");
        const relaxBottom = this._getYBandForMode(chunk, "relaxBottom");
        const full = this._getYBandForMode(chunk, "full");

        return {
            chunk,
            strict,
            relaxTop,
            relaxBottom,
            full,
            chosen: strict,
        };
    }

    private _getYBandForMode(
        chunk: AnchoredChunk,
        mode: "strict" | "relaxTop" | "relaxBottom" | "full",
    ): YBand<"viewport", "device"> | null {
        const viewportTop = 0 as Coord<"viewport", "device", "y">;
        const viewportBottom = chunk.imageSize.height as number as Coord<"viewport", "device", "y">;

        const safeTop = chunk.safeArea.top;
        const safeBottom = getBottom(chunk.safeArea);

        let resultingBand: YBand<"viewport", "device"> | null = {
            top: safeTop,
            height: getHeight(safeTop, safeBottom),
        };

        if (mode === "relaxTop") {
            resultingBand.top = viewportTop;
            resultingBand.height = getHeight(resultingBand.top, safeBottom);
        } else if (mode === "relaxBottom") {
            resultingBand.height = getHeight(resultingBand.top, viewportBottom);
        } else if (mode === "full") {
            resultingBand.top = viewportTop;
            resultingBand.height = getHeight(resultingBand.top, viewportBottom);
        }

        const visibleCoveringRect = this._getVisibleCoveringRect(chunk);
        if (!visibleCoveringRect) {
            return null;
        }

        resultingBand = intersectYBands(resultingBand, { top: viewportTop, height: chunk.imageSize.height });
        resultingBand = intersectYBands(resultingBand, visibleCoveringRect);

        if (!resultingBand || resultingBand.height <= 0) {
            return null;
        }

        return resultingBand;
    }

    private _chooseBestCandidates(candidates: SegmentCandidate[]): void {
        if (!candidates.length) {
            return;
        }

        // Always choose relaxed values for the first and last candidates
        const first = candidates[0];
        first.chosen = first.chosen ?? first.relaxTop ?? first.full;
        if (first.chosen) {
            const originalBottom = getBottom(first.chosen);
            const relaxedTop = first.relaxTop?.top ?? first.full?.top ?? first.chosen.top;
            first.chosen.top = getMinCoord(first.chosen.top, relaxedTop);
            first.chosen.height = getHeight(first.chosen.top, originalBottom);
        }

        const last = candidates[candidates.length - 1];
        last.chosen = last.chosen ?? last.relaxBottom ?? last.full;
        if (last.chosen) {
            const relaxedBottom = getBottom(last.relaxBottom ?? last.full ?? last.chosen);
            const currentBottom = getBottom(last.chosen);
            const maxBottom = getMaxCoord(currentBottom, relaxedBottom);
            const maxHeight = getHeight(last.chosen.top, maxBottom);
            last.chosen.height = getMaxLength(last.chosen.height, maxHeight);
        }

        for (let i = 0; i < candidates.length - 1; i++) {
            const upper = candidates[i];
            const lower = candidates[i + 1];

            upper.chosen = upper.chosen ?? upper.relaxBottom ?? upper.full;
            lower.chosen = lower.chosen ?? lower.relaxTop ?? lower.full;

            if (!upper.chosen || !lower.chosen) {
                continue;
            }

            let upperRelativeToCaptureArea = {
                top: fromViewportToCaptureArea(upper.chosen.top, upper.chunk.anchorTop),
                height: upper.chosen.height,
            };
            let upperBottomRelativeToCaptureArea = getBottom(upperRelativeToCaptureArea);
            let lowerTopRelativeToCaptureArea = fromViewportToCaptureArea(lower.chosen.top, lower.chunk.anchorTop);

            if (upperBottomRelativeToCaptureArea >= lowerTopRelativeToCaptureArea) {
                continue;
            }

            const relaxedUpperBottom = getBottom(upper.relaxBottom ?? upper.full ?? upper.chosen);
            if (relaxedUpperBottom > getBottom(upper.chosen)) {
                upper.chosen.height = getHeight(upper.chosen.top, relaxedUpperBottom);
            }

            upperRelativeToCaptureArea = {
                top: fromViewportToCaptureArea(upper.chosen.top, upper.chunk.anchorTop),
                height: upper.chosen.height,
            };
            upperBottomRelativeToCaptureArea = getBottom(upperRelativeToCaptureArea);
            lowerTopRelativeToCaptureArea = fromViewportToCaptureArea(lower.chosen.top, lower.chunk.anchorTop);

            if (upperBottomRelativeToCaptureArea >= lowerTopRelativeToCaptureArea) {
                continue;
            }

            const relaxedLowerStart = lower.relaxTop?.top ?? lower.full?.top ?? lower.chosen.top;
            if (relaxedLowerStart < lower.chosen.top) {
                const originalBottom = getBottom(lower.chosen);
                lower.chosen.top = relaxedLowerStart;
                lower.chosen.height = getHeight(lower.chosen.top, originalBottom);
            }
        }
    }

    private _buildRenderPieces(candidates: SegmentCandidate[]): RenderPiece[] {
        const pieces: RenderPiece[] = [];

        const sortedCandidates = candidates
            .filter(candidate => Boolean(candidate.chosen))
            .sort((a, b) =>
                subtractCoords(
                    fromViewportToCaptureArea(a.chosen!.top, a.chunk.anchorTop),
                    fromViewportToCaptureArea(b.chosen!.top, b.chunk.anchorTop),
                ),
            );

        let cursor = 0 as Coord<"capture", "device", "y">;
        let hasStartedRendering = false;

        for (const candidate of sortedCandidates) {
            const chosen = candidate.chosen!;
            const chosenRelativeToCaptureArea: YBand<"capture", "device"> = {
                top: fromViewportToCaptureArea(chosen.top, candidate.chunk.anchorTop),
                height: chosen.height,
            };
            const bottomRelativeToCaptureArea = getBottom(chosenRelativeToCaptureArea);

            if (bottomRelativeToCaptureArea <= cursor) {
                continue;
            }

            if (!hasStartedRendering) {
                cursor = chosenRelativeToCaptureArea.top;
                hasStartedRendering = true;
            }

            const topRelativeToCaptureArea = getMaxCoord(chosenRelativeToCaptureArea.top, cursor);

            if (topRelativeToCaptureArea > cursor) {
                pieces.push({ type: "black", height: getHeight(cursor, topRelativeToCaptureArea) });
            }

            const cursorRelativeToViewport = fromCaptureAreaToViewport(cursor, candidate.chunk.anchorTop);
            const topRelativeToViewport = getMaxCoord(chosen.top, cursorRelativeToViewport);
            const bottomRelativeToViewport = getBottom(chosen);
            pieces.push({
                type: "chunk",
                chunk: candidate.chunk,
                verticalArea: {
                    top: topRelativeToViewport,
                    height: getHeight(topRelativeToViewport, bottomRelativeToViewport),
                },
            });

            cursor = bottomRelativeToCaptureArea;
        }

        return pieces;
    }

    private _getChunkHorizontalArea(
        chunk: Pick<AnchoredChunk, "captureSpecs" | "imageSize">,
    ): XBand<"viewport", "device"> | null {
        const viewportHorizontalArea = {
            left: 0 as Coord<"viewport", "device", "x">,
            width: chunk.imageSize.width as number as Length<"device", "x">,
        };
        const visibleCoveringRect = this._getVisibleCoveringRect(chunk);
        if (!visibleCoveringRect) {
            return null;
        }

        return intersectXBands(viewportHorizontalArea, visibleCoveringRect);
    }

    private _computeCommonHorizontalAreaIfNeeded(
        chunks: AnchoredChunk[],
        captureWidth: Length<"device", "x">,
    ): XBand<"viewport", "device"> | null {
        const chunkHorizontalAreas = chunks
            .map(chunk => this._getChunkHorizontalArea(chunk))
            .filter((area): area is XBand<"viewport", "device"> => Boolean(area));

        if (chunkHorizontalAreas.length === 0) {
            return null;
        }

        const hasWidthMismatch = chunkHorizontalAreas.some(area => area.width !== captureWidth);

        if (!hasWidthMismatch) {
            return null;
        }

        const left = Math.min(...chunkHorizontalAreas.map(area => area.left));
        const right = Math.max(...chunkHorizontalAreas.map(area => (area.left as number) + (area.width as number)));

        return {
            left: left as Coord<"viewport", "device", "x">,
            width: (right - left) as Length<"device", "x">,
        };
    }

    private async _createChunkPiece(
        chunk: AnchoredChunk,
        verticalArea: YBand<"viewport", "device">,
        captureWidth: Length<"device", "x">,
        commonHorizontalArea: XBand<"viewport", "device"> | null,
    ): Promise<Image> {
        const viewportHorizontalArea = {
            left: 0 as Coord<"viewport", "device", "x">,
            width: chunk.imageSize.width as number as Length<"device", "x">,
        };
        const horizonalArea = commonHorizontalArea
            ? intersectXBands(viewportHorizontalArea, commonHorizontalArea)
            : this._getChunkHorizontalArea(chunk);

        if (
            !horizonalArea ||
            horizonalArea.width <= 0 ||
            verticalArea.height <= 0 ||
            horizonalArea.width !== captureWidth
        ) {
            debug(
                "Chunk crop area is invalid or doesn't match capture width, using black fallback.\n  verticalArea: %O\n  horizonalArea: %O \n  captureWidth: %d",
                verticalArea,
                horizonalArea,
                captureWidth,
            );
            return this._createBlackPiece(verticalArea.height, captureWidth);
        }

        const cropArea: Rect<"image", "device"> = {
            top: verticalArea.top as number as Coord<"image", "device", "y">,
            height: verticalArea.height,
            left: horizonalArea.left as number as Coord<"image", "device", "x">,
            width: horizonalArea.width,
        };

        for (const ignoreRect of chunk.boundingRectsToIgnore) {
            await chunk.image.addClear(ignoreRect);
        }
        await chunk.image.applyJoin();
        await chunk.image.crop(cropArea);

        return chunk.image;
    }

    private async _createBlackPiece(height: Length<"device", "y">, width: Length<"device", "x">): Promise<Image> {
        return new Image({ width, height });
    }
}
