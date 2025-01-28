"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MainRunner = void 0;
const server_1 = require("./vite/server");
const __1 = require("..");
const runtime_config_1 = __importDefault(require("../../config/runtime-config"));
class MainRunner extends __1.MainRunner {
    constructor(config, interceptors) {
        super(config, interceptors);
        this._viteServer = server_1.ViteServer.create(config);
    }
    async run(testCollection, stats) {
        try {
            await this._viteServer.start();
            runtime_config_1.default.getInstance().extend({ viteBaseUrl: this._viteServer.baseUrl });
        }
        catch (err) {
            throw new Error(`Vite server failed to start: ${err.message}`);
        }
        this._useBaseUrlFromVite();
        await super.run(testCollection, stats);
    }
    _useBaseUrlFromVite() {
        const viteBaseUrl = this._viteServer.baseUrl;
        this.config.baseUrl = viteBaseUrl;
        for (const broConfig of Object.values(this.config.browsers)) {
            broConfig.baseUrl = viteBaseUrl;
        }
    }
    cancel() {
        super.cancel();
        this._viteServer.close();
    }
}
exports.MainRunner = MainRunner;
//# sourceMappingURL=index.js.map