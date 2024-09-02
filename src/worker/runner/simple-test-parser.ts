import { Config } from "../../config";

import _ from "lodash";
import { EventEmitter } from "events";
import { passthroughEvent } from "../../events/utils";
import { TestParser } from "../../test-reader/test-parser";
import { WorkerEvents } from "../../events";
import { Test } from "../../types";

export type ParseArgs = {
    file: string;
    browserId: string;
};

export class SimpleTestParser extends EventEmitter {
    private _config: Config;

    static create<T extends SimpleTestParser>(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this: new (...args: any[]) => T,
        ...args: ConstructorParameters<typeof SimpleTestParser>
    ): T {
        return new this(...args);
    }

    constructor(config: Config) {
        super();

        this._config = config;
    }

    async parse({ file, browserId }: ParseArgs): Promise<Test[]> {
        const testRunEnv = _.isArray(this._config.system.testRunEnv)
            ? this._config.system.testRunEnv[0]
            : this._config.system.testRunEnv;

        const parser = new TestParser({ testRunEnv });

        passthroughEvent(parser, this, [WorkerEvents.BEFORE_FILE_READ, WorkerEvents.AFTER_FILE_READ]);

        await parser.loadFiles([file], this._config);

        return parser.parse([file], { browserId, config: this._config.forBrowser(browserId) });
    }
}
