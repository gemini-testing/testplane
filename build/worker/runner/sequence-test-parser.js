'use strict';
const { EventEmitter } = require('events');
const { passthroughEvent } = require('../../core/events/utils');
const SimpleTestParser = require('./simple-test-parser');
const RunnerEvents = require('../constants/runner-events');
const fastq = require('fastq');
module.exports = class SequenceTestParser extends EventEmitter {
    static create(...args) {
        return new this(...args);
    }
    constructor(config) {
        super();
        this._parser = SimpleTestParser.create(config);
        passthroughEvent(this._parser, this, [
            RunnerEvents.BEFORE_FILE_READ,
            RunnerEvents.AFTER_FILE_READ
        ]);
        this._queue = fastq.promise((fn) => fn(), 1);
    }
    async parse({ file, browserId }) {
        return this._queue.push(() => this._parser.parse({ file, browserId }));
    }
};
