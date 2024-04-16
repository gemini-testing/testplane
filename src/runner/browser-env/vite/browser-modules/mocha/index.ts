import { TestParser } from "./parser.js";
import { wrapConsoleMethods } from "../utils/index.js";
import { getErrorsOnPageLoad, getErrorsOnRunRunnable, BrowserError } from "../errors/index.js";
import { BrowserEventNames, WorkerEventNames, type BrowserViteSocket, type RunnableFn } from "../types.js";

export class MochaWrapper {
    private _runnables = new Map<string, Mocha.Runnable>();
    private _parser: TestParser;
    private _socket: BrowserViteSocket;

    static create<T extends MochaWrapper>(this: new () => T): T {
        return new this();
    }

    constructor() {
        this._socket = window.__testplane__.socket;
        this._validate();

        this._parser = TestParser.create();
    }

    async init(): Promise<void> {
        mocha.setup("bdd");

        this._subscribeOnWorkerMessages();
        let error: Error | undefined = undefined;

        try {
            await this._parser.loadFile(window.__testplane__.file, runnable => {
                this._runnables.set(runnable.fullTitle(), runnable);
            });
        } catch (err) {
            error = err as Error;
        }

        this._socket.emit(BrowserEventNames.initialize, getErrorsOnPageLoad(error));

        wrapConsoleMethods();
    }

    private _validate(): never | void {
        if (!window.Mocha) {
            const error = BrowserError.create({
                message: "Can't find Mocha inside Testplane dependencies. Try to reinstall Testplane.",
            });

            this._socket.emit(BrowserEventNames.initialize, getErrorsOnPageLoad(error));
            throw error;
        }
    }

    private _subscribeOnWorkerMessages(): void {
        this._socket.on(WorkerEventNames.runRunnable, async (payload, cb): Promise<void> => {
            const runnableToRun = this._runnables.get(payload.fullTitle);

            if (!runnableToRun) {
                const error = BrowserError.create({
                    message: `Can't find a runnable with the title "${payload.fullTitle}" to run`,
                });

                cb(getErrorsOnRunRunnable(error));
                throw error;
            }

            let error: Error | undefined = undefined;

            try {
                const ctx = { browser: window.__testplane__.browser };
                await (runnableToRun.fn as unknown as RunnableFn).call(ctx, ctx);
            } catch (err) {
                error = err as Error;
            }

            return cb(getErrorsOnRunRunnable(error));
        });
    }
}
