import path from "node:path";
import zlib from "node:zlib";
import fs from "fs-extra";
import { Compression, type SelectivityCompressionType } from "./types";
import type { Readable, Transform, Writable } from "node:stream";

const getCompressionPrefix = (type: SelectivityCompressionType): string => (type === "none" ? "" : "." + type);

const compressionPriorities: SelectivityCompressionType[] = process.versions.zstd
    ? [Compression.ZSTD, Compression.GZIP, Compression.BROTLI, Compression.NONE]
    : [Compression.GZIP, Compression.BROTLI, Compression.NONE];

const getExistingJsonPathWithCompression = (
    jsonBasePath: string,
    preferredCompressionType: SelectivityCompressionType,
): { jsonPath: string | null; compressionType: SelectivityCompressionType } => {
    const jsonPathWithPrefix = jsonBasePath + getCompressionPrefix(preferredCompressionType);

    if (fs.existsSync(jsonPathWithPrefix)) {
        return { jsonPath: jsonPathWithPrefix, compressionType: preferredCompressionType };
    }

    for (const compressionType of compressionPriorities) {
        if (compressionType === preferredCompressionType) {
            continue;
        }

        const jsonPathWithCurrentPrefix = jsonBasePath + getCompressionPrefix(compressionType);
        if (fs.existsSync(jsonPathWithCurrentPrefix)) {
            return { jsonPath: jsonPathWithCurrentPrefix, compressionType: compressionType };
        }
    }

    return { jsonPath: null, compressionType: preferredCompressionType };
};

const readCompressedTextFile = (filePath: string, compression: SelectivityCompressionType): Promise<string> => {
    return new Promise<string>((resolve, reject) => {
        let fileData = "";
        const readStream = fs.createReadStream(filePath);
        let stream: Readable = readStream;

        if (compression === Compression.ZSTD && !("createZstdDecompress" in zlib)) {
            reject(
                new Error(
                    "zstd decompression is not supported in your version of node.js. Please, upgrade the node version to 22",
                ),
            );
        }

        switch (compression) {
            case Compression.ZSTD:
                stream = readStream.pipe(
                    (zlib as unknown as { createZstdDecompress: () => Transform }).createZstdDecompress(),
                );
                break;
            case Compression.GZIP:
                stream = readStream.pipe(zlib.createGunzip());
                break;
            case Compression.BROTLI:
                stream = readStream.pipe(zlib.createBrotliDecompress());
                break;
        }

        stream.setEncoding("utf8");

        stream.on("data", chunk => {
            fileData += chunk;
        });

        stream.on("end", () => {
            resolve(fileData);
        });

        stream.on("error", err => {
            reject(new Error(`Couldn't read ${filePath} with ${compression} compression`, { cause: err }));
        });
    });
};

const writeCompressedTextFile = (
    filePath: string,
    data: string,
    compression: SelectivityCompressionType,
): Promise<void> => {
    return new Promise<void>((resolve, reject) => {
        const writeStream = fs.createWriteStream(filePath);
        let stream: Writable = writeStream;

        if (compression === Compression.ZSTD && !("createZstdCompress" in zlib)) {
            reject(
                new Error(
                    "zstd compression is not supported in your version of node.js. Please, upgrade the node version to 22",
                ),
            );
        }

        switch (compression) {
            case Compression.ZSTD:
                stream = (zlib as unknown as { createZstdCompress: () => Transform }).createZstdCompress();
                stream.pipe(writeStream);
                break;
            case Compression.GZIP:
                stream = zlib.createGzip();
                stream.pipe(writeStream);
                break;
            case Compression.BROTLI:
                stream = zlib.createBrotliCompress();
                stream.pipe(writeStream);
                break;
        }

        stream.write(data, "utf8", err => {
            if (err) {
                reject(new Error(`Couldn't write to ${filePath} with ${compression} compression`, { cause: err }));
            } else {
                stream.end();
            }
        });

        writeStream.on("finish", () => {
            resolve();
        });

        writeStream.on("error", err => {
            reject(new Error(`Couldn't save to ${filePath} with ${compression} compression`, { cause: err }));
        });
    });
};

/**
 * @param jsonBasePath json path without compression suffix
 * @param preferredCompressionType
 * @returns decompressed and parsed JSON
 */
export const readJsonWithCompression = async <T>(
    jsonBasePath: string,
    preferredCompressionType: SelectivityCompressionType,
    opts?: { defaultValue?: T },
): Promise<T> => {
    const { jsonPath, compressionType } = getExistingJsonPathWithCompression(jsonBasePath, preferredCompressionType);

    if (!jsonPath) {
        if (opts?.defaultValue) {
            return Promise.resolve(opts.defaultValue);
        } else {
            throw new Error(
                `Couldn't read ${jsonBasePath} with following compression: ${compressionPriorities}: file does not exist`,
            );
        }
    }

    const fileData = await readCompressedTextFile(jsonPath, compressionType);

    return JSON.parse(fileData);
};

export const writeJsonWithCompression = async (
    jsonBasePath: string,
    data: unknown,
    preferredCompressionType: SelectivityCompressionType,
): Promise<void> => {
    const filePath = jsonBasePath + getCompressionPrefix(preferredCompressionType);
    const fileData = JSON.stringify(data, null, preferredCompressionType === "none" ? 2 : 0);

    await fs.ensureDir(path.dirname(filePath));

    return writeCompressedTextFile(filePath, fileData, preferredCompressionType);
};
