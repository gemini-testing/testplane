"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.waitDevServerReady = exports.pipeLogsWithPrefix = exports.findCwd = void 0;
const stream_1 = require("stream");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const chalk_1 = __importDefault(require("chalk"));
const logger = __importStar(require("../utils/logger"));
const findCwd = (configPath) => {
    let prev = configPath;
    // eslint-disable-next-line no-constant-condition
    while (true) {
        const dir = path_1.default.dirname(prev);
        if (dir === prev) {
            return path_1.default.dirname(configPath);
        }
        const foundPackageJson = fs_1.default.existsSync(path_1.default.join(dir, "package.json"));
        if (foundPackageJson) {
            return dir;
        }
        prev = dir;
    }
};
exports.findCwd = findCwd;
class WithPrefixTransformer extends stream_1.Transform {
    constructor(prefix) {
        super();
        this.prefix = chalk_1.default.green(prefix);
        this.includePrefix = true;
    }
    _transform(chunk, _, callback) {
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
const pipeLogsWithPrefix = (childProcess, prefix) => {
    const logOnErrorCb = (error) => {
        if (error) {
            logger.error("Got an error trying to pipeline dev server logs:", error.message);
        }
    };
    if (!childProcess.stdout || !childProcess.stderr) {
        logger.error("Couldn't pipe child process logs as it seems to not be spawned successfully");
        return;
    }
    (0, stream_1.pipeline)(childProcess.stdout, new WithPrefixTransformer(prefix), process.stdout, logOnErrorCb);
    (0, stream_1.pipeline)(childProcess.stderr, new WithPrefixTransformer(prefix), process.stderr, logOnErrorCb);
};
exports.pipeLogsWithPrefix = pipeLogsWithPrefix;
const defaultIsReadyFn = (response) => {
    return response.status >= 200 && response.status < 300;
};
const waitDevServerReady = async (devServer, readinessProbe) => {
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
    const isReadyFn = readinessProbe.isReady || defaultIsReadyFn;
    let isSuccess = false;
    let isError = false;
    const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
            if (!isError && !isSuccess) {
                isError = true;
                reject(new Error(`Dev server is still not ready after ${readinessProbe.timeouts.waitServerTimeout}ms`));
            }
        }, readinessProbe.timeouts.waitServerTimeout).unref();
    });
    const readyPromise = new Promise(resolve => {
        const tryToFetch = async () => {
            const signal = AbortSignal.timeout(readinessProbe.timeouts.probeRequestTimeout);
            try {
                const response = await fetch(readinessProbe.url, { signal });
                const isReady = await isReadyFn(response);
                if (!isReady) {
                    throw new Error("Dev server is not ready yet");
                }
                if (!isError && !isSuccess) {
                    isSuccess = true;
                    logger.log("Dev server is ready");
                    resolve();
                }
            }
            catch (error) {
                const err = error;
                if (!isError && !isSuccess) {
                    setTimeout(tryToFetch, readinessProbe.timeouts.probeRequestInterval).unref();
                    const errorMessage = err && err.cause && (err.cause.code || err.cause);
                    if (errorMessage && errorMessage !== "ECONNREFUSED") {
                        logger.warn("Dev server ready probe failed:", errorMessage);
                    }
                }
            }
        };
        tryToFetch();
    });
    return Promise.race([timeoutPromise, readyPromise]);
};
exports.waitDevServerReady = waitDevServerReady;
exports.default = { findCwd: exports.findCwd, pipeLogsWithPrefix: exports.pipeLogsWithPrefix, waitDevServerReady: exports.waitDevServerReady };
//# sourceMappingURL=utils.js.map