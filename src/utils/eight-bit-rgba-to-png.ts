import { unsigned as crc32 } from "buffer-crc32";
import zlib from "node:zlib";
import {
    RGBA_CHANNELS,
    PNG_MIN_ASSIST_BYTES,
    PNG_SIGNATURE,
    PNG_IHDR_LENGTH,
    PNG_BIT_DEPTH_EIGHT_BIT,
    PNG_COLOR_TYPE_RGBA,
    PNG_COMPRESSION_DEFLATE,
    PNG_FILTER_NO_FILTER,
    PNG_INTERLACE_NO_INTERLACE,
} from "../constants/png";

const convertRgbaToScanlines = (rgba: Buffer, width: number, height: number): Buffer => {
    const stride = width * RGBA_CHANNELS;
    const scanlines = Buffer.allocUnsafe(height * (1 + stride)); // extra byte for filter

    let scanlineOffset = 0;
    let pixelDataOffset = 0;

    for (let y = 0; y < height; y++) {
        scanlineOffset = scanlines.writeUInt8(PNG_FILTER_NO_FILTER, scanlineOffset);
        scanlineOffset += rgba.copy(scanlines, scanlineOffset, pixelDataOffset, pixelDataOffset + stride);

        pixelDataOffset += stride;
    }

    if (scanlineOffset !== scanlines.byteLength) {
        const lines: string[] = [];
        lines.push(
            `What happened: Malformed RGBA input detected while building PNG scanlines. Expected ${scanlines.byteLength} bytes written, but got ${scanlineOffset}.`,
        );
        lines.push("\nPossible reasons:");
        lines.push("  - The 'rgba' buffer size does not match the expected width × height × 4 bytes");
        lines.push("  - 'width' or 'height' parameters are incorrect for the given buffer");
        lines.push("\nWhat you can do:");
        lines.push("  - Verify that rgba.length === width * height * 4 before calling convertRgbaToPng()");
        lines.push("  - Check that the width and height values correctly describe the image dimensions");
        throw new Error(lines.join("\n"));
    }

    return scanlines;
};

export const convertRgbaToPng = (rgba: Buffer, width: number, height: number, compressionLevel = 4): Buffer => {
    const scanlines = convertRgbaToScanlines(rgba, width, height);
    const compressedData = zlib.deflateSync(scanlines, { level: compressionLevel });
    const resultBuffer = Buffer.allocUnsafe(PNG_MIN_ASSIST_BYTES + compressedData.length);

    let pointer = 0;

    // signature
    pointer += PNG_SIGNATURE.copy(resultBuffer);

    // IHDR
    const ihdrPointer = (pointer = resultBuffer.writeUInt32BE(PNG_IHDR_LENGTH, pointer));
    pointer += resultBuffer.write("IHDR", pointer, "ascii");
    pointer = resultBuffer.writeUInt32BE(width, pointer);
    pointer = resultBuffer.writeUInt32BE(height, pointer);
    pointer = resultBuffer.writeUInt8(PNG_BIT_DEPTH_EIGHT_BIT, pointer);
    pointer = resultBuffer.writeUInt8(PNG_COLOR_TYPE_RGBA, pointer);
    pointer = resultBuffer.writeUInt8(PNG_COMPRESSION_DEFLATE, pointer);
    pointer = resultBuffer.writeUInt8(PNG_FILTER_NO_FILTER, pointer);
    pointer = resultBuffer.writeUInt8(PNG_INTERLACE_NO_INTERLACE, pointer);
    const ihdrCrc = crc32(resultBuffer.subarray(ihdrPointer, pointer));
    pointer = resultBuffer.writeUInt32BE(ihdrCrc, pointer);

    // IDAT
    const idatPointer = (pointer = resultBuffer.writeUInt32BE(compressedData.length, pointer));
    pointer += resultBuffer.write("IDAT", idatPointer, "ascii");
    pointer += compressedData.copy(resultBuffer, pointer);
    const idatCrc = crc32(resultBuffer.subarray(idatPointer, pointer));
    pointer = resultBuffer.writeUInt32BE(idatCrc, pointer);

    // IEND (empty)
    const iendPointer = (pointer = resultBuffer.writeUInt32BE(0, pointer));
    pointer += resultBuffer.write("IEND", pointer, "ascii");
    const iendCrc = crc32(resultBuffer.subarray(iendPointer, pointer));
    pointer = resultBuffer.writeUInt32BE(iendCrc, pointer);

    if (pointer !== resultBuffer.byteLength) {
        const lines: string[] = [];
        lines.push(
            `What happened: Malformed RGBA input detected while writing PNG chunks. Expected to write ${resultBuffer.byteLength} bytes, but wrote ${pointer}.`,
        );
        lines.push("\nPossible reasons:");
        lines.push("  - The 'rgba' buffer size does not match the expected width × height × 4 bytes");
        lines.push("  - Compressed data size calculation was incorrect");
        lines.push("\nWhat you can do:");
        lines.push("  - Verify that rgba.length === width * height * 4 before calling convertRgbaToPng()");
        lines.push("  - Check that the width and height values correctly describe the image dimensions");
        throw new Error(lines.join("\n"));
    }

    return resultBuffer;
};
