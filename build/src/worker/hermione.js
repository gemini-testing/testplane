"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Hermione = void 0;
const utils_1 = require("../events/utils");
const events_1 = require("../events");
const runner_1 = __importDefault(require("./runner"));
const base_hermione_1 = require("../base-hermione");
class Hermione extends base_hermione_1.BaseHermione {
    constructor(configPath) {
        super(configPath);
        this.runner = runner_1.default.create(this._config);
        (0, utils_1.passthroughEvent)(this.runner, this, [
            events_1.WorkerEvents.BEFORE_FILE_READ,
            events_1.WorkerEvents.AFTER_FILE_READ,
            events_1.WorkerEvents.AFTER_TESTS_READ,
            events_1.WorkerEvents.NEW_BROWSER,
            events_1.WorkerEvents.UPDATE_REFERENCE,
        ]);
    }
    async init() {
        await this._init();
        if (!global.expect) {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const { setOptions } = require("expect-webdriverio");
            setOptions(this._config.system.expectOpts);
        }
    }
    runTest(fullTitle, options) {
        return this.runner.runTest(fullTitle, options);
    }
    isWorker() {
        return true;
    }
}
exports.Hermione = Hermione;
//# sourceMappingURL=hermione.js.map