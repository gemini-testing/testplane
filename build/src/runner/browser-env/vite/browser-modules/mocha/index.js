import { TestParser } from "./parser.js";
import { wrapConsoleMethods } from "../utils/index.js";
import { getErrorsOnPageLoad, getErrorsOnRunRunnable, BrowserError } from "../errors/index.js";
import { BrowserEventNames, WorkerEventNames } from "../types.js";
export class MochaWrapper {
    _runnables = new Map();
    _parser;
    _socket;
    static create() {
        return new this();
    }
    constructor() {
        this._socket = window.__testplane__.socket;
        this._validate();
        this._parser = TestParser.create();
    }
    async init() {
        mocha.setup("bdd");
        this._subscribeOnWorkerMessages();
        let error = undefined;
        try {
            await this._parser.loadFile(window.__testplane__.file, runnable => {
                this._runnables.set(runnable.fullTitle(), runnable);
            });
        }
        catch (err) {
            error = err;
        }
        this._socket.emit(BrowserEventNames.initialize, getErrorsOnPageLoad(error));
        wrapConsoleMethods();
    }
    _validate() {
        if (!window.Mocha) {
            const error = BrowserError.create({
                message: "Can't find Mocha inside Testplane dependencies. Try to reinstall Testplane.",
            });
            this._socket.emit(BrowserEventNames.initialize, getErrorsOnPageLoad(error));
            throw error;
        }
    }
    _subscribeOnWorkerMessages() {
        this._socket.on(WorkerEventNames.runRunnable, async (payload, cb) => {
            const runnableToRun = this._runnables.get(payload.fullTitle);
            if (!runnableToRun) {
                const error = BrowserError.create({
                    message: `Can't find a runnable with the title "${payload.fullTitle}" to run`,
                });
                cb(getErrorsOnRunRunnable(error));
                throw error;
            }
            let error = undefined;
            try {
                const ctx = { browser: window.__testplane__.browser };
                await runnableToRun.fn.call(ctx, ctx);
            }
            catch (err) {
                error = err;
            }
            return cb(getErrorsOnRunRunnable(error));
        });
    }
}
//# sourceMappingURL=index.js.map