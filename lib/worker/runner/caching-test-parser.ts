import { EventEmitter } from 'events';
import { events } from 'gemini-core';

import RunnerEvents from '../constants/runner-events';
import TestCollection from '../../test-collection';
import TestParser from '../../test-reader/mocha-test-parser';

import type Config from '../../config';
import type { Test } from '../../types/mocha';

type ParseOpts = {
    file: string;
    browserId: string;
};

export default class CachingTestParser extends EventEmitter {
    private _config: Config;
    private _cache: {
        [browserId: string]: {
            [file: string]: Array<Test>;
        };
    };

    public static create(config: Config): CachingTestParser {
        return new this(config);
    }

    constructor(config: Config) {
        super();

        this._config = config;
        this._cache = {};

        TestParser.prepare();
    }

    public parse({file, browserId}: ParseOpts): Array<Test> {
        const cached = this._getFromCache({file, browserId});

        if (cached) {
            return cached;
        }

        const tests = this._parse({file, browserId});

        this._putToCache(tests, {file, browserId});
        this.emit(RunnerEvents.AFTER_TESTS_READ, TestCollection.create({[browserId]: tests}));

        return tests;
    }

    private _getFromCache({file, browserId}: ParseOpts): Array<Test> | undefined {
        return this._cache[browserId] && this._cache[browserId][file];
    }

    private _putToCache(tests: Array<Test>, {file, browserId}: ParseOpts): void {
        this._cache[browserId] = this._cache[browserId] || {};
        this._cache[browserId][file] = tests;
    }

    private _parse({file, browserId}: ParseOpts): Array<Test> {
        const parser = TestParser.create(browserId, this._config);

        events.utils.passthroughEvent(parser, this, [
            RunnerEvents.BEFORE_FILE_READ,
            RunnerEvents.AFTER_FILE_READ
        ]);

        return parser
            .applyConfigController()
            .loadFiles(file)
            .parse();
    }
};
