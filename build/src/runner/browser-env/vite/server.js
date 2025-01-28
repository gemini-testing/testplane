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
exports.ViteServer = void 0;
// remove after migrate to esm
process.env.VITE_CJS_IGNORE_WARNING = "1";
const node_path_1 = __importDefault(require("node:path"));
const vite_1 = require("vite");
const lodash_1 = __importDefault(require("lodash"));
const get_port_1 = __importDefault(require("get-port"));
const chalk_1 = __importDefault(require("chalk"));
const logger_1 = __importDefault(require("../../../utils/logger"));
const socket_1 = require("./socket");
const generate_index_html_1 = require("./plugins/generate-index-html");
const mock_1 = require("./plugins/mock");
const manual_mock_1 = require("./manual-mock");
const constants_1 = require("./constants");
class ViteServer {
    static create(testplaneConfig) {
        return new this(testplaneConfig);
    }
    constructor(testplaneConfig) {
        this._testplaneConfig = testplaneConfig;
        this._viteConfig = {
            server: { host: "localhost" },
            configFile: false,
            logLevel: "silent",
            build: {
                sourcemap: "inline",
            },
            optimizeDeps: {
                // listed deps are CJS packages and need to be compiled to ESM by Vite
                include: [
                    "expect",
                    // webdriverio deps
                    "aria-query",
                    "css-shorthand-properties",
                    "css-value",
                    "grapheme-splitter",
                    "lodash.clonedeep",
                    "lodash.zip",
                    "minimatch",
                    "rgb2hex",
                    "ws",
                ],
                esbuildOptions: {
                    logLevel: "silent",
                },
            },
        };
        this._options = lodash_1.default.isArray(this._testplaneConfig.system.testRunEnv)
            ? this._testplaneConfig.system.testRunEnv[1]
            : undefined;
    }
    async start() {
        await this._applyUserViteConfig();
        await this._addRequiredVitePlugins();
        if (!this._viteConfig.server.port) {
            this._viteConfig.server.port = await (0, get_port_1.default)();
        }
        this._server = await (0, vite_1.createServer)(this._viteConfig);
        (0, socket_1.createSocketServer)(this._server.httpServer);
        await this._server.listen();
        logger_1.default.log(chalk_1.default.green(`Vite server started on ${this.baseUrl}`));
    }
    async close() {
        await this._server?.close();
    }
    async _applyUserViteConfig() {
        if (!this._options?.viteConfig) {
            return;
        }
        const config = this._options.viteConfig;
        let preparedConfig;
        if (lodash_1.default.isString(config)) {
            preparedConfig = (await Promise.resolve(`${node_path_1.default.resolve(process.cwd(), config)}`).then(s => __importStar(require(s)))).default;
        }
        else if (lodash_1.default.isFunction(config)) {
            preparedConfig = await config(constants_1.VITE_DEFAULT_CONFIG_ENV);
        }
        else {
            preparedConfig = config;
        }
        this._viteConfig = lodash_1.default.merge(this._viteConfig, preparedConfig);
    }
    async _addRequiredVitePlugins() {
        const manualMock = await manual_mock_1.ManualMock.create(this._viteConfig, this._options);
        this._viteConfig.plugins = [
            ...(this._viteConfig.plugins || []),
            await (0, generate_index_html_1.plugin)(),
            (0, mock_1.plugin)(manualMock),
        ];
    }
    get baseUrl() {
        return this._server?.resolvedUrls.local[0];
    }
}
exports.ViteServer = ViteServer;
//# sourceMappingURL=server.js.map