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
exports.Config = void 0;
const path = __importStar(require("path"));
const _ = __importStar(require("lodash"));
const defaults_1 = __importDefault(require("./defaults"));
const browser_config_1 = require("./browser-config");
const options_1 = __importDefault(require("./options"));
const logger_1 = __importDefault(require("../utils/logger"));
class Config {
    static create(config) {
        return new Config(config);
    }
    static read(configPath) {
        try {
            return require(path.resolve(process.cwd(), configPath));
        }
        catch (e) {
            logger_1.default.error(`Unable to read config from path ${configPath}`);
            throw e;
        }
    }
    constructor(config) {
        let options;
        if (_.isObjectLike(config)) {
            options = config;
        }
        else if (typeof config === "string") {
            this.configPath = config;
            options = Config.read(config);
        }
        else {
            for (const configPath of defaults_1.default.configPaths) {
                try {
                    const resolvedConfigPath = path.resolve(configPath);
                    require(resolvedConfigPath);
                    this.configPath = resolvedConfigPath;
                    break;
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                }
                catch (err) {
                    if (err.code !== "MODULE_NOT_FOUND") {
                        throw err;
                    }
                }
            }
            if (!this.configPath) {
                throw new Error(`Unable to read config from paths: ${defaults_1.default.configPaths.join(", ")}`);
            }
            options = Config.read(this.configPath);
        }
        if (_.isFunction(options.prepareEnvironment)) {
            options.prepareEnvironment();
        }
        _.extend(this, (0, options_1.default)({
            options,
            env: process.env,
            argv: process.argv,
        }));
        this.browsers = _.mapValues(this.browsers, (browser, id) => {
            const browserOptions = _.extend({}, browser, {
                id: id,
                system: this.system,
            });
            return new browser_config_1.BrowserConfig(browserOptions);
        });
    }
    forBrowser(id) {
        return this.browsers[id];
    }
    getBrowserIds() {
        return _.keys(this.browsers);
    }
    serialize() {
        return _.extend({}, this, {
            browsers: _.mapValues(this.browsers, broConf => broConf.serialize()),
        });
    }
    /**
     * This method is used in subrocesses to merge a created config
     * in a subrocess with a config from the main process
     */
    mergeWith(config) {
        _.mergeWith(this, config, (l, r) => {
            if (_.isObjectLike(l)) {
                return;
            }
            // When passing stringified config from the master to workers
            // all functions are transformed to strings and all regular expressions to empty objects
            return typeof l === typeof r ? r : l;
        });
    }
}
exports.Config = Config;
//# sourceMappingURL=index.js.map