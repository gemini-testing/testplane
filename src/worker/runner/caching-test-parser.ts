import { EventEmitter } from "events";
import { passthroughEvent } from "../../events/utils";
import { SequenceTestParser } from "./sequence-test-parser";
import { TestCollection } from "../../test-collection";
import { WorkerEvents } from "../../events";
import { Config } from "../../config";
import { Test } from "../../types";
import { noopProfilerRuntime } from "../../profiler/runtime/noop";
import type { ProfilerRuntimeLike } from "../../profiler/runtime/types";
import { ProfilerSanitizer } from "../../profiler/sanitize";

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
    private _profiler: ProfilerRuntimeLike;
    private _sanitizer?: ProfilerSanitizer;

    static create<T extends CachingTestParser>(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this: new (...args: any[]) => T,
        ...args: ConstructorParameters<typeof CachingTestParser>
    ): T {
        return new this(...args);
    }

    constructor(config: Config, profiler: ProfilerRuntimeLike = noopProfilerRuntime) {
        super();

        this._cache = {};
        this._profiler = profiler;

        this._sequenceTestParser = SequenceTestParser.create(config, profiler);
        passthroughEvent(this._sequenceTestParser, this, [WorkerEvents.BEFORE_FILE_READ, WorkerEvents.AFTER_FILE_READ]);
    }

    async parse({ file, browserId }: ParseArgs): Promise<Test[]> {
        const cached = this._getFromCache({ file, browserId });
        if (cached) {
            if (!this._profiler.isEnabled()) {
                return cached;
            }
            this._profiler.increment("testFile.cacheHit", 1, { browserId });
            if (!this._profiler.isEnabled(2)) {
                return cached;
            }
            const sanitizedFile = this._sanitizePath(file);
            return this._profiler.withSpan(
                "test.file.cache",
                {
                    minLevel: 2,
                    name: sanitizedFile,
                    context: { browserId },
                    attributes: { file: sanitizedFile, browserId, cacheHit: true },
                },
                () => cached,
            );
        }

        const testsPromise = this._loadUncached({ file, browserId });
        this._putToCache(testsPromise, { file, browserId });

        const tests = await testsPromise;

        this.emit(WorkerEvents.AFTER_TESTS_READ, TestCollection.create({ [browserId]: tests }));

        return tests;
    }

    private _loadUncached({ file, browserId }: ParseArgs): Promise<Test[]> {
        if (!this._profiler.isEnabled()) {
            return this._sequenceTestParser.parse({ file, browserId });
        }

        this._profiler.increment("testFile.cacheMiss", 1, { browserId });
        if (!this._profiler.isEnabled(2)) {
            return this._sequenceTestParser.parse({ file, browserId });
        }
        const sanitizedFile = this._sanitizePath(file);
        return this._profiler.withSpan(
            "test.file.worker-load",
            {
                minLevel: 2,
                name: sanitizedFile,
                context: { browserId },
                attributes: { file: sanitizedFile, browserId, cacheHit: false },
            },
            () => this._sequenceTestParser.parse({ file, browserId }),
        );
    }

    private _sanitizePath(file: string): string {
        this._sanitizer ??= new ProfilerSanitizer();
        return this._sanitizer.path(file);
    }

    private _getFromCache({ file, browserId }: CacheKey): Promise<Test[]> {
        return this._cache[browserId] && this._cache[browserId][file];
    }

    private _putToCache(testsPromise: Promise<Test[]>, { file, browserId }: CacheKey): void {
        this._cache[browserId] = this._cache[browserId] || {};
        this._cache[browserId][file] = testsPromise;
    }
}
