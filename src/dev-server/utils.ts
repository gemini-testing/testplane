import { pipeline, Transform, TransformCallback } from "stream";
import path from "path";
import fs from "fs";
import chalk from "chalk";
import type { ChildProcess, ChildProcessWithoutNullStreams } from "child_process";
import * as logger from "../utils/logger";
import type { Config } from "../config";

export const findCwd = (configPath: string): string => {
    let prev = configPath;

    // eslint-disable-next-line no-constant-condition
    while (true) {
        const dir = path.dirname(prev);

        if (dir === prev) {
            return path.dirname(configPath);
        }

        const foundPackageJson = fs.existsSync(path.join(dir, "package.json"));

        if (foundPackageJson) {
            return dir;
        }

        prev = dir;
    }
};

class WithPrefixTransformer extends Transform {
    prefix: string;
    includePrefix: boolean;

    constructor(prefix: string) {
        super();

        this.prefix = chalk.green(prefix);
        this.includePrefix = true;
    }

    _transform(chunk: string, _: string, callback: TransformCallback): void {
        const chunkString = chunk.toString();
        const chunkRows = chunkString.split("\n");

        const includeSuffix = chunkString.endsWith("\n") && chunkRows.pop() === "";

        const resultPrefix = this.includePrefix ? this.prefix : "";
        const resultSuffix = includeSuffix ? "\n" : "";
        const resultData = resultPrefix + chunkRows.join("\n" + this.prefix) + resultSuffix;

        this.push(resultData);
        this.includePrefix = includeSuffix;

        callback();
    }
}

export const pipeLogsWithPrefix = (
    childProcess: ChildProcess | ChildProcessWithoutNullStreams,
    prefix: string,
): void => {
    const logOnErrorCb = (error: Error | null): void => {
        if (error) {
            logger.error("Got an error trying to pipeline dev server logs:", error.message);
        }
    };

    if (!childProcess.stdout || !childProcess.stderr) {
        logger.error("Couldn't pipe child process logs as it seems to not be spawned successfully");

        return;
    }

    pipeline(childProcess.stdout, new WithPrefixTransformer(prefix), process.stdout, logOnErrorCb);
    pipeline(childProcess.stderr, new WithPrefixTransformer(prefix), process.stderr, logOnErrorCb);
};

const defaultIsReadyFn = (response: Awaited<ReturnType<typeof globalThis.fetch>>): boolean => {
    return response.status >= 200 && response.status < 300;
};

export const probeServer = async (
    // eslint-disable-next-line @typescript-eslint/ban-types
    readinessProbe: Exclude<Config["devServer"]["readinessProbe"], Function>,
): Promise<boolean> => {
    if (typeof readinessProbe.url !== "string") {
        throw new Error("devServer.readinessProbe.url should be set to url");
    }

    const isReadyFn = readinessProbe.isReady || defaultIsReadyFn;

    try {
        const signal = AbortSignal.timeout(readinessProbe.timeouts.probeRequestTimeout);
        const response = await fetch(readinessProbe.url!, { signal });
        const isReady = await isReadyFn(response);

        if (!isReady) {
            return false;
        }

        return true;
    } catch (error) {
        const err = error as { cause?: { code?: string } };
        const errorMessage = err && err.cause && (err.cause.code || err.cause);

        if (errorMessage && errorMessage !== "ECONNREFUSED") {
            logger.warn("Dev server ready probe failed:", errorMessage);
        }

        return false;
    }
};

export const waitDevServerReady = async (
    devServer: ChildProcessWithoutNullStreams,
    readinessProbe: Config["devServer"]["readinessProbe"],
): Promise<void> => {
    if (typeof readinessProbe !== "function" && !readinessProbe.url) {
        return;
    }

    logger.log("Waiting for dev server to be ready");

    if (typeof readinessProbe === "function") {
        return Promise.resolve()
            .then(() => readinessProbe(devServer))
            .then(res => {
                logger.log("Dev server is ready");

                return res;
            });
    }

    let isSuccess = false;
    let isError = false;

    const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
            if (!isError && !isSuccess) {
                isError = true;
                reject(new Error(`Dev server is still not ready after ${readinessProbe.timeouts.waitServerTimeout}ms`));
            }
        }, readinessProbe.timeouts.waitServerTimeout).unref();
    });

    const readyPromise = new Promise<void>(resolve => {
        const tryToFetch = async (): Promise<void> => {
            const isReady = await probeServer(readinessProbe);

            if (isError || isSuccess) {
                return;
            }

            if (isReady) {
                isSuccess = true;
                logger.log("Dev server is ready");
                resolve();
            } else {
                setTimeout(tryToFetch, readinessProbe.timeouts.probeRequestInterval).unref();
            }
        };

        tryToFetch();
    });

    return Promise.race([timeoutPromise, readyPromise]);
};

export default { findCwd, pipeLogsWithPrefix, waitDevServerReady };
