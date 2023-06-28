"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.tryToRegisterTsNode = void 0;
const lodash_1 = __importDefault(require("lodash"));
const tryToRegisterTsNode = () => {
    var _a, _b, _c;
    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { REGISTER_INSTANCE } = require("ts-node");
        if (lodash_1.default.get(process, REGISTER_INSTANCE)) {
            return;
        }
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { register } = require("ts-node");
        let swc = false;
        try {
            require("@swc/core");
            swc = true;
        }
        catch (_d) { } // eslint-disable-line no-empty
        register({
            skipProject: JSON.parse((_a = process.env.TS_NODE_SKIP_PROJECT) !== null && _a !== void 0 ? _a : "true"),
            transpileOnly: JSON.parse((_b = process.env.TS_NODE_TRANSPILE_ONLY) !== null && _b !== void 0 ? _b : "true"),
            swc: JSON.parse((_c = process.env.TS_NODE_SWC) !== null && _c !== void 0 ? _c : swc.toString()),
        });
    }
    catch (_e) { } // eslint-disable-line no-empty
};
exports.tryToRegisterTsNode = tryToRegisterTsNode;
//# sourceMappingURL=typescript.js.map