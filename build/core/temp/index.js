"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const temp_1 = __importDefault(require("temp"));
const path_1 = __importDefault(require("path"));
const lodash_1 = __importDefault(require("lodash"));
temp_1.default.track();
class Temp {
    constructor(dir, opts = {}) {
        this._tempDir = opts.attach
            ? dir
            : temp_1.default.mkdirSync({
                dir: dir && path_1.default.resolve(dir),
                prefix: '.screenshots.tmp.'
            });
    }
    path(opts = {}) {
        return temp_1.default.path(lodash_1.default.extend(opts, {
            dir: this._tempDir
        }));
    }
    serialize() {
        return { dir: this._tempDir };
    }
}
let tempInstance;
exports.default = {
    init: (dir) => {
        if (!tempInstance) {
            tempInstance = new Temp(dir);
        }
    },
    attach: (serializedTemp) => {
        if (!tempInstance) {
            tempInstance = new Temp(serializedTemp.dir, { attach: true });
        }
    },
    path: (opts) => tempInstance.path(opts),
    serialize: () => tempInstance.serialize()
};
