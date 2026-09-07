import { Config } from "../../config";
import { EventEmitter } from "events";
import { passthroughEvent } from "../../events/utils";
import { TestParser } from "../../test-reader/test-parser";
import { WorkerEvents } from "../../events";
import { Test } from "../../types";
import { noopProfilerRuntime } from "../../profiler/runtime/noop";
import type { ProfilerRuntimeLike } from "../../profiler/runtime/types";

export type ParseArgs = {
    file: string;
    browserId: string;
};

export class SimpleTestParser extends EventEmitter {
    private _config: Config;
    private _profiler: ProfilerRuntimeLike;

    static create<T extends SimpleTestParser>(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this: new (...args: any[]) => T,
        ...args: ConstructorParameters<typeof SimpleTestParser>
    ): T {
        return new this(...args);
    }

    constructor(config: Config, profiler: ProfilerRuntimeLike = noopProfilerRuntime) {
        super();

        this._config = config;
        this._profiler = profiler;
    }

    async parse({ file, browserId }: ParseArgs): Promise<Test[]> {
        const parser = new TestParser(this._profiler);

        passthroughEvent(parser, this, [WorkerEvents.BEFORE_FILE_READ, WorkerEvents.AFTER_FILE_READ]);

        await parser.loadFiles([file], { config: this._config });

        return parser.parse([file], { browserId, config: this._config.forBrowser(browserId) });
    }
}
