import { EventEmitter } from "node:events";
import { passthroughEvent } from "../../events/utils.js";
import { TestParser } from "../../test-reader/test-parser.js";
import { WorkerEvents } from "../../events/index.js";

export default class SimpleTestParser extends EventEmitter {
    static create(...args) {
        return new this(...args);
    }

    constructor(config) {
        super();

        this._config = config;
    }

    async parse({ file, browserId }) {
        const parser = new TestParser();

        passthroughEvent(parser, this, [WorkerEvents.BEFORE_FILE_READ, WorkerEvents.AFTER_FILE_READ]);

        await parser.loadFiles([file], this._config);

        return parser.parse([file], { browserId, config: this._config.forBrowser(browserId) });
    }
}
