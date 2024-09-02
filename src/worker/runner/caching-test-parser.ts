import { EventEmitter } from "events";
import { passthroughEvent } from "../../events/utils";
import { SequenceTestParser } from "./sequence-test-parser";
import { TestCollection } from "../../test-collection";
import { WorkerEvents } from "../../events";
import { Config } from "../../config";
import { Test } from "../../types";

export type CacheKey = {
    file: string;
    browserId: string;
};

export type ParseArgs = {
    file: string;
    browserId: string;
};

export class CachingTestParser extends EventEmitter {
    private _cache: Record<string, Record<string, Promise<Test[]>>>;
    private _sequenceTestParser: SequenceTestParser;

    static create<T extends CachingTestParser>(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this: new (...args: any[]) => T,
        ...args: ConstructorParameters<typeof CachingTestParser>
    ): T {
        return new this(...args);
    }

    constructor(config: Config) {
        super();

        this._cache = {};

        this._sequenceTestParser = SequenceTestParser.create(config);
        passthroughEvent(this._sequenceTestParser, this, [WorkerEvents.BEFORE_FILE_READ, WorkerEvents.AFTER_FILE_READ]);
    }

    async parse({ file, browserId }: ParseArgs): Promise<Test[]> {
        const cached = this._getFromCache({ file, browserId });
        if (cached) {
            return cached;
        }

        const testsPromise = this._sequenceTestParser.parse({ file, browserId });
        this._putToCache(testsPromise, { file, browserId });

        const tests = await testsPromise;

        this.emit(WorkerEvents.AFTER_TESTS_READ, TestCollection.create({ [browserId]: tests }));

        return tests;
    }

    private _getFromCache({ file, browserId }: CacheKey): Promise<Test[]> {
        return this._cache[browserId] && this._cache[browserId][file];
    }

    private _putToCache(testsPromise: Promise<Test[]>, { file, browserId }: CacheKey): void {
        this._cache[browserId] = this._cache[browserId] || {};
        this._cache[browserId][file] = testsPromise;
    }
}
