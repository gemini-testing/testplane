import os from "node:os";
import path from "node:path";
import pLimit from "p-limit";
import lockfile from "proper-lockfile";
import fs from "fs-extra";
import { getMD5 } from "../../../utils/crypto";
import { SELECTIVITY_CACHE_DIRECTIRY, SELECTIVITY_CACHE_READY_SUFFIX } from "./constants";

export const CacheType = {
    TestFile: "t",
    Asset: "a",
} as const;

type CacheTypeValue = (typeof CacheType)[keyof typeof CacheType];

// Cache is considered fresh if it was created after process start
const processStartTime = Number(new Date());
const tmpDir = path.join(os.tmpdir(), SELECTIVITY_CACHE_DIRECTIRY);

// https://nodejs.org/api/cli.html#uv_threadpool_sizesize
const libUVLimited = pLimit((process.env.UV_THREADPOOL_SIZE && Number(process.env.UV_THREADPOOL_SIZE)) || 16);

const ensureSelectivityCacheDirectory = async (): Promise<void> => {
    await libUVLimited(() => fs.ensureDir(tmpDir));
};

const wasModifiedAfterProcessStart = async (flagFilePath: string): Promise<boolean> => {
    try {
        const stats = await libUVLimited(() => fs.stat(flagFilePath));
        return stats.mtimeMs >= processStartTime;
    } catch {
        return false;
    }
};

export const hasCachedSelectivityFile = async (cacheType: CacheTypeValue, key: string): Promise<boolean> => {
    if (!key) {
        const lines: string[] = [];
        lines.push("What happened: Internal selectivity error: attempted to check cache existence with an empty key.");
        lines.push("\nThis is an internal bug in Testplane.");
        lines.push("\nWhat you can do:");
        lines.push("  - Please report this issue at https://github.com/gemini-testing/testplane/issues");
        throw new Error(lines.join("\n"));
    }

    const hashName = cacheType + getMD5(key);
    const cacheFilePath = path.join(tmpDir, hashName);
    const flagFilePath = cacheFilePath + SELECTIVITY_CACHE_READY_SUFFIX;

    return wasModifiedAfterProcessStart(flagFilePath);
};

export const getCachedSelectivityFile = async (cacheType: CacheTypeValue, key: string): Promise<string | null> => {
    if (!key) {
        const lines: string[] = [];
        lines.push("What happened: Internal selectivity error: attempted to read cache with an empty key.");
        lines.push("\nThis is an internal bug in Testplane.");
        lines.push("\nWhat you can do:");
        lines.push("  - Please report this issue at https://github.com/gemini-testing/testplane/issues");
        throw new Error(lines.join("\n"));
    }

    const hashName = cacheType + getMD5(key);
    const cacheFilePath = path.join(tmpDir, hashName);
    const flagFilePath = cacheFilePath + SELECTIVITY_CACHE_READY_SUFFIX;

    if (await wasModifiedAfterProcessStart(flagFilePath)) {
        const cacheContents = await libUVLimited(() => fs.readFile(cacheFilePath, "utf8")).catch(() => null);

        return cacheContents;
    }

    // Writing cache right now, should wait a little bit
    if (await wasModifiedAfterProcessStart(cacheFilePath)) {
        for (let i = 0; i < 10; i++) {
            if (await wasModifiedAfterProcessStart(flagFilePath)) {
                const cacheContents = await libUVLimited(() => fs.readFile(cacheFilePath, "utf8")).catch(() => null);

                return cacheContents;
            }

            await new Promise(resolve => setTimeout(resolve, 50));
        }
    }

    return null;
};

export const setCachedSelectivityFile = async (
    cacheType: CacheTypeValue,
    key: string,
    utf8Contents: string,
): Promise<void> => {
    if (!key) {
        const lines: string[] = [];
        lines.push("What happened: Internal selectivity error: attempted to write cache with an empty key.");
        lines.push("\nThis is an internal bug in Testplane.");
        lines.push("\nWhat you can do:");
        lines.push("  - Please report this issue at https://github.com/gemini-testing/testplane/issues");
        throw new Error(lines.join("\n"));
    }

    const hashName = cacheType + getMD5(key);
    const cacheFilePath = path.join(tmpDir, hashName);
    const flagFilePath = cacheFilePath + SELECTIVITY_CACHE_READY_SUFFIX;

    // Cache was already written
    if (await wasModifiedAfterProcessStart(flagFilePath)) {
        return;
    }

    await ensureSelectivityCacheDirectory();

    const releaseLock = await lockfile
        .lock(flagFilePath, {
            stale: 5000,
            update: 1000,
            retries: { minTimeout: 50, maxTimeout: 50, retries: 1 },
            realpath: false,
        })
        .catch(() => null);

    // Other process already aquired writing-lock
    if (!releaseLock) {
        return;
    }

    // Cache was written while trying to get lock
    if (await wasModifiedAfterProcessStart(flagFilePath)) {
        await releaseLock();
        return;
    }

    try {
        await libUVLimited(() => fs.writeFile(cacheFilePath, utf8Contents, { encoding: "utf8" })).catch(cause => {
            const lines: string[] = [];
            lines.push(`What happened: Selectivity could not write cache file to "${cacheFilePath}".`);
            lines.push("\nPossible reasons:");
            lines.push("  - The directory does not exist or is not writable");
            lines.push("  - The disk is full");
            lines.push("\nWhat you can do:");
            lines.push("  - Check disk space and permissions for the OS temp directory");
            lines.push("  - Check the cause error for specific I/O details");
            throw new Error(lines.join("\n"), { cause });
        });

        // Using "writeFile" to trigger "mtime" update even if file exists
        await libUVLimited(() => fs.writeFile(flagFilePath, "")).catch(cause => {
            const lines: string[] = [];
            lines.push(`What happened: Selectivity could not mark cache as fresh at "${cacheFilePath}".`);
            lines.push("\nPossible reasons:");
            lines.push("  - The directory does not exist or is not writable");
            lines.push("  - The disk is full");
            lines.push("\nWhat you can do:");
            lines.push("  - Check disk space and permissions for the OS temp directory");
            lines.push("  - Check the cause error for specific I/O details");
            throw new Error(lines.join("\n"), { cause });
        });
    } finally {
        await releaseLock();
    }
};
