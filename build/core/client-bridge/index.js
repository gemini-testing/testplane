"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.build = exports.ClientBridge = void 0;
const path_1 = __importDefault(require("path"));
const bluebird_1 = __importDefault(require("bluebird"));
const browserify_1 = __importDefault(require("browserify"));
const client_bridge_1 = __importDefault(require("./client-bridge"));
var client_bridge_2 = require("./client-bridge");
Object.defineProperty(exports, "ClientBridge", { enumerable: true, get: function () { return __importDefault(client_bridge_2).default; } });
const build = async (browser, opts = {}) => {
    const script = (0, browserify_1.default)({
        entries: './index',
        basedir: path_1.default.join(__dirname, '..', 'browser', 'client-scripts')
    });
    if (!opts.coverage) {
        script.exclude('./index.coverage');
    }
    script.transform('uglifyify', {
        sourceMap: false,
        global: true,
        ie8: true
    });
    const lib = opts.calibration && opts.calibration.needsCompatLib ? './lib.compat.js' : './lib.native.js';
    const ignoreAreas = opts.supportDeprecated ? './ignore-areas.deprecated.js' : './ignore-areas.js';
    script.transform('aliasify', {
        aliases: {
            './lib': { relative: lib },
            './ignore-areas': { relative: ignoreAreas }
        },
        verbose: false
    });
    const buf = await bluebird_1.default.fromCallback((cb) => script.bundle(cb));
    const scripts = buf.toString();
    return client_bridge_1.default.create(browser, scripts);
};
exports.build = build;
