import _ from 'lodash';
import { EventEmitter } from 'events';
import * as eventsUtils from 'gemini-core/lib/events/utils';

import ParserEvents from './parser-events';
import RunnerEvents from '../constants/runner-events';

import type TestParser from './mocha-test-parser';
import type { Suite, Test } from '../types/mocha';

type DelayedCall = {
    cb: Function;
    args: Array<any>;
};

export default class TestParserAPI extends EventEmitter {
    private _ctx: Record<string, any>;
    private _parser: TestParser;
    private _delayedCalls: Array<DelayedCall>;

    public static create(parser: TestParser, ctx: Record<string, any>): TestParserAPI {
        return new this(parser, ctx);
    }

    constructor(parser: TestParser, ctx: Record<string, any>) {
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

    public get events(): typeof ParserEvents {
        return ParserEvents;
    }

    public setController(name: string, methods: Record<string, Function>): void {
        this._ctx[name] = {};
        this._addCleaner(name);

        _.forEach(methods, (cb, cbName) => {
            this._ctx[name][cbName] = (...args: [...any]) => {
                this._delayedCalls.push({cb, args});
                this._setOneShotListener();

                return this._ctx[name];
            };
        });
    }

    private _addCleaner(name: string): void {
        const clean_ = () => {
            delete this._ctx[name];
            this._delayedCalls = [];

            this._parser.removeListener(RunnerEvents.AFTER_FILE_READ, clean_);
        };
        this._parser.on(RunnerEvents.AFTER_FILE_READ, clean_);
    }

    private _setOneShotListener(): void {
        const flush_ = (runnable: Test | Suite) => {
            this._flushDelayedCalls(runnable);
            this._parser.removeListener(ParserEvents.SUITE, flush_);
            this._parser.removeListener(ParserEvents.TEST, flush_);
        };

        this._parser.on(ParserEvents.SUITE, flush_);
        this._parser.on(ParserEvents.TEST, flush_);
    }

    private _flushDelayedCalls(runnable: Test | Suite): void {
        this._delayedCalls.forEach(({cb, args}) => {
            cb.apply(runnable, args);
        });
        this._delayedCalls = [];
    }
};
