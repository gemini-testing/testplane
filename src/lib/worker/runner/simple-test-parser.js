"use strict";

const { EventEmitter } = require("events");
const { passthroughEvent } = require("../../events/utils");
const { BrowserTestParser: TestParser } = require("../../test-reader/browser-test-parser");
const RunnerEvents = require("../constants/runner-events");

module.exports = class SimpleTestParser extends EventEmitter {
    static create(...args) {
        return new this(...args);
    }

    constructor(config) {
        super();

        this._config = config;
    }

    async parse({ file, browserId }) {
        const parser = TestParser.create(browserId, this._config);

        passthroughEvent(parser, this, [
            RunnerEvents.BEFORE_FILE_READ,
            RunnerEvents.AFTER_FILE_READ,
        ]);

        await parser.loadFiles([file]);

        return parser.parse();
    }
};
