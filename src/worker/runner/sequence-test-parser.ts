import { EventEmitter } from "events";
import { passthroughEvent } from "../../events/utils";
import { SimpleTestParser } from "./simple-test-parser";
import { WorkerEvents } from "../../events";
import { Config } from "../../config";
import { Test } from "../../test-reader/test-object";
import { noopProfilerRuntime } from "../../profiler/runtime/noop";
import type { ProfilerRuntimeLike } from "../../profiler/runtime/types";
import { ProfilerSanitizer } from "../../profiler/sanitize";

export type ParseArgs = {
    file: string;
    browserId: string;
};

export class SequenceTestParser extends EventEmitter {
    private _parser: SimpleTestParser;
    private _queue: Promise<void>;
    private _profiler: ProfilerRuntimeLike;
    private _sanitizer?: ProfilerSanitizer;

    static create<T extends SequenceTestParser>(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this: new (...args: any[]) => T,
        ...args: ConstructorParameters<typeof SequenceTestParser>
    ): T {
        return new this(...args);
    }

    constructor(config: Config, profiler: ProfilerRuntimeLike = noopProfilerRuntime) {
        super();

        this._profiler = profiler;
        this._sanitizer = profiler.isEnabled(2) ? new ProfilerSanitizer() : undefined;
        this._parser = SimpleTestParser.create(config, profiler);
        passthroughEvent(this._parser, this, [WorkerEvents.BEFORE_FILE_READ, WorkerEvents.AFTER_FILE_READ]);

        this._queue = Promise.resolve();
    }

    parse({ file, browserId }: ParseArgs): Promise<Test[]> {
        const sanitizedFile = this._sanitizer?.path(file) ?? file;
        const queueSpan = this._profiler.startSpan("test.file.sequence-wait", {
            minLevel: 2,
            name: sanitizedFile,
            context: { browserId },
            attributes: { file: sanitizedFile, browserId },
        });
        return new Promise((resolve, reject) => {
            this._queue = this._queue.finally(() => {
                queueSpan.end();
                return this._parser.parse({ file, browserId }).then(resolve, reject);
            });
        });
    }
}
