"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.tryToRegisterTsNode = void 0;
const lodash_1 = __importDefault(require("lodash"));
const debug_1 = __importDefault(require("debug"));
const logger_1 = __importDefault(require("./logger"));
const swcDebugNamespace = "testplane:swc";
const swcDebugLog = (0, debug_1.default)(swcDebugNamespace);
const tryToRegisterTsNode = (isSilent = false) => {
    if (process.env.TS_ENABLE === "false") {
        return;
    }
    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { REGISTER_INSTANCE } = require("ts-node");
        if (lodash_1.default.get(process, REGISTER_INSTANCE)) {
            return;
        }
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { register } = require("ts-node");
        const skipProjectRaw = process.env.TS_NODE_SKIP_PROJECT ?? "true";
        const transpileOnlyRaw = process.env.TS_NODE_TRANSPILE_ONLY ?? "true";
        const swcRaw = process.env.TS_NODE_SWC ?? "true";
        if (JSON.parse(swcRaw)) {
            try {
                require("@swc/core");
                register({
                    skipProject: JSON.parse(skipProjectRaw),
                    transpileOnly: JSON.parse(transpileOnlyRaw),
                    swc: true,
                });
                return;
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            }
            catch (err) {
                if (!isSilent) {
                    if (err.code === "MODULE_NOT_FOUND") {
                        logger_1.default.warn(`testplane: you may install @swc/core for significantly faster reading of typescript tests.`);
                    }
                    else {
                        const isSwcDebugLogEnabled = debug_1.default.enabled(swcDebugNamespace);
                        if (isSwcDebugLogEnabled) {
                            swcDebugLog(err);
                        }
                        else {
                            logger_1.default.warn(`testplane: could not load @swc/core. Run Testplane with "DEBUG=testplane:swc" to see details.`);
                        }
                    }
                }
            }
        }
        try {
            register({
                skipProject: JSON.parse(skipProjectRaw),
                transpileOnly: JSON.parse(transpileOnlyRaw),
                swc: false,
                compilerOptions: {
                    module: "nodenext",
                    moduleResolution: "nodenext",
                },
            });
            return;
            // eslint-disable-next-line no-empty
        }
        catch (err) { }
        try {
            register({
                skipProject: JSON.parse(skipProjectRaw),
                transpileOnly: JSON.parse(transpileOnlyRaw),
                swc: false,
            });
            return;
            // eslint-disable-next-line no-empty
        }
        catch (err) {
            if (!isSilent) {
                const params = `swc: "false", transpileOnly: "${transpileOnlyRaw}", skipProject: "${skipProjectRaw}"`;
                logger_1.default.warn(`testplane: an error occured while trying to register ts-node (${params}). TypeScript tests won't be read:`, err);
            }
        }
    }
    catch { } // eslint-disable-line no-empty
};
exports.tryToRegisterTsNode = tryToRegisterTsNode;
//# sourceMappingURL=typescript.js.map