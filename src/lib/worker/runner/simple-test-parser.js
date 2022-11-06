'use strict';

const {EventEmitter} = require('events');
const {passthroughEvent} = require('../../core/events/utils');
const TestParser = require('../../test-reader/mocha-test-parser');
const RunnerEvents = require('../constants/runner-events');

module.exports = class SimpleTestParser extends EventEmitter {
    static create(...args) {
        return new this(...args);
    }

    constructor(config) {
        super();

        this._config = config;

        TestParser.prepare();
    }

    async parse({file, browserId}) {
        const parser = TestParser.create(browserId, this._config);

        passthroughEvent(parser, this, [
            RunnerEvents.BEFORE_FILE_READ,
            RunnerEvents.AFTER_FILE_READ
        ]);

        parser.applyConfigController();

        await parser.loadFiles(file);

        return parser.parse();
    }
};
