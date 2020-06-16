'use strict';

const {EventEmitter} = require('events');
const _ = require('lodash');
const ParserEvents = require('./parser-events');
const RunnerEvents = require('../constants/runner-events');
const eventsUtils = require('gemini-core').events.utils;

module.exports = class TestParserAPI extends EventEmitter {
    static create(...args) {
        return new this(...args);
    }

    constructor(parser, ctx) {
        super();

        this._ctx = ctx;
        this._parser = parser;
        this._delayedCalls = [];

        eventsUtils.passthroughEvent(this._parser, this, [
            ParserEvents.TEST,
            ParserEvents.SUITE,
            ParserEvents.HOOK
        ]);
    }

    get events() {
        return ParserEvents;
    }

    setController(name, methods) {
        this._ctx[name] = {};
        this._addCleaner(name);

        _.forEach(methods, (cb, cbName) => {
            this._ctx[name][cbName] = (...args) => {
                this._delayedCalls.push({cb, args});
                this._setOneShotListener();

                return this._ctx[name];
            };
        });
    }

    _addCleaner(name) {
        const clean_ = () => {
            delete this._ctx[name];
            this._delayedCalls = [];

            this._parser.removeListener(RunnerEvents.AFTER_FILE_READ, clean_);
        };
        this._parser.on(RunnerEvents.AFTER_FILE_READ, clean_);
    }

    _setOneShotListener() {
        const flush_ = (runnable) => {
            this._flushDelayedCalls(runnable);
            this._parser.removeListener(ParserEvents.SUITE, flush_);
            this._parser.removeListener(ParserEvents.TEST, flush_);
        };

        this._parser.on(ParserEvents.SUITE, flush_);
        this._parser.on(ParserEvents.TEST, flush_);
    }

    _flushDelayedCalls(runnable) {
        this._delayedCalls.forEach(({cb, args}) => {
            cb.apply(runnable, args);
        });
        this._delayedCalls = [];
    }
};
