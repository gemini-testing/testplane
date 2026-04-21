import zlib from "node:zlib";
import { WsDriverCompression, WsDriverCompressionType } from "./types";

export const getDecompressed = async (
    compressedPayload: Buffer,
    compressionType: WsDriverCompressionType,
): Promise<Buffer> => {
    if (compressionType === WsDriverCompression.None) {
        return compressedPayload;
    }

    if (compressionType === WsDriverCompression.GZIP) {
        return new Promise((resolve, reject) => {
            zlib.gunzip(compressedPayload, (err, result) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(result);
                }
            });
        });
    }

    if (compressionType === WsDriverCompression.ZSTD) {
        if (!("zstd" in process.versions) || !("zstdDecompress" in zlib)) {
            throw new Error("Can't decompress zstd compressed message");
        }

        const typedZstdDecompress = zlib.zstdDecompress as (
            buf: Buffer,
            cb: (err: null | Error, result: Buffer) => void,
        ) => void;

        return new Promise((resolve, reject) => {
            typedZstdDecompress(compressedPayload, (err, result) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(result);
                }
            });
        });
    }

    throw new Error(`Unknown compression type: "${compressionType}"`);
};

export const getCompressed = async (
    decompressedPayload: Buffer,
    compressionType: WsDriverCompressionType,
): Promise<Buffer> => {
    if (compressionType === WsDriverCompression.None) {
        return decompressedPayload;
    }

    if (compressionType === WsDriverCompression.GZIP) {
        return new Promise((resolve, reject) => {
            zlib.gzip(decompressedPayload, { level: 4 }, (err, result) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(result);
                }
            });
        });
    }

    if (compressionType === WsDriverCompression.ZSTD) {
        if (!("zstd" in process.versions) || !("zstdCompress" in zlib)) {
            throw new Error("Can't compress payload with zstd");
        }

        const typedZstdCompress = zlib.zstdCompress as (
            buf: Buffer,
            cb: (err: null | Error, result: Buffer) => void,
        ) => void;

        return new Promise((resolve, reject) => {
            typedZstdCompress(decompressedPayload, (err, result) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(result);
                }
            });
        });
    }

    throw new Error(`Unknown compression type: "${compressionType}"`);
};
