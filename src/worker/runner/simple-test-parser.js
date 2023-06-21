"use strict";

const { EventEmitter } = require("events");
const { passthroughEvent } = require("../../events/utils");
const { TestParser } = require("../../test-reader/test-parser");
const { WorkerEvents } = require("../../events");

module.exports = class SimpleTestParser extends EventEmitter {
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
};
