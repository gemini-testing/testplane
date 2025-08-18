export const RGBA_CHANNELS = 4;
export const BITS_IN_BYTE = 8;

// https://en.wikipedia.org/wiki/PNG#Critical_chunks
export const PNG_WIDTH_OFFSET = 16;
export const PNG_HEIGHT_OFFSET = 20;

export const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
export const PNG_BIT_DEPTH_EIGHT_BIT = 8;
export const PNG_COLOR_TYPE_RGBA = 6;
export const PNG_COMPRESSION_DEFLATE = 0;
export const PNG_FILTER_NO_FILTER = 0;
export const PNG_INTERLACE_NO_INTERLACE = 0;
export const PNG_IHDR_LENGTH = 13;
export const PNG_MIN_ASSIST_BYTES = 57;
