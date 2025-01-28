"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ManualMock = void 0;
const node_path_1 = __importDefault(require("node:path"));
const promises_1 = __importDefault(require("node:fs/promises"));
const lodash_1 = __importDefault(require("lodash"));
const constants_1 = require("./constants");
class ManualMock {
    static async create(config, options) {
        const automock = typeof options?.automock === "boolean" ? options?.automock : constants_1.DEFAULT_AUTOMOCK;
        const automockDir = node_path_1.default.resolve(config?.root || "", options?.automockDir || constants_1.DEFAULT_AUTOMOCK_DIRECTORY);
        const mocksOnFs = await getMocksOnFs(automockDir);
        return new this({ automock, mocksOnFs });
    }
    constructor(options) {
        this._automock = options.automock;
        this._mocksOnFs = options.mocksOnFs;
        this._mocks = [];
        this._unmocks = [];
    }
    async resolveId(id) {
        const foundMockOnFs = this._mocksOnFs.find(mock => id === mock.moduleName);
        if ((this._mocks.includes(id) || this._automock) && foundMockOnFs && !this._unmocks.includes(id)) {
            return foundMockOnFs.fullPath;
        }
    }
    mock(moduleName) {
        this._mocks.push(moduleName);
    }
    unmock(moduleName) {
        this._unmocks.push(moduleName);
    }
    resetMocks() {
        this._mocks = [];
        this._unmocks = [];
    }
}
exports.ManualMock = ManualMock;
async function getMocksOnFs(automockDir) {
    const mockedModules = await getFilesFromDirectory(automockDir);
    return mockedModules.map(filePath => {
        const extName = node_path_1.default.extname(filePath);
        return {
            fullPath: filePath,
            moduleName: filePath.slice(automockDir.length + 1, -extName.length),
        };
    });
}
async function getFilesFromDirectory(dir) {
    const isDirExists = await promises_1.default.access(dir).then(() => true, () => false);
    if (!isDirExists) {
        return [];
    }
    const files = await promises_1.default.readdir(dir);
    const allFiles = await Promise.all(files.map(async (file) => {
        const filePath = node_path_1.default.join(dir, file);
        const stats = await promises_1.default.stat(filePath);
        return stats.isDirectory() ? getFilesFromDirectory(filePath) : filePath;
    }));
    return lodash_1.default.flatten(allFiles).filter(Boolean);
}
//# sourceMappingURL=manual-mock.js.map