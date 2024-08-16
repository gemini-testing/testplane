import { ValueOf } from "type-fest";
import { MochaEvents } from "./events.js";
import type {} from "mocha";

type RunnableHandler = (runnable: Mocha.Runnable) => void;

export class TestParser {
    private _rootSuite: Mocha.Suite = mocha.suite;

    static create<T extends TestParser>(this: new () => T): T {
        return new this();
    }

    async loadFile(file: string, runnableHandler: RunnableHandler): Promise<void> {
        this._subscribeOnRunnableEvents(runnableHandler);

        await import(file);
    }

    private _subscribeOnRunnableEvents(runnableHandler: RunnableHandler): void {
        [MochaEvents.ADD_TEST, MochaEvents.ADD_HOOK_BEFORE_EACH, MochaEvents.ADD_HOOK_AFTER_EACH].forEach(event => {
            this._addRecursiveHandler(this._rootSuite, event, runnableHandler);
        });
    }

    private _addRecursiveHandler(
        suite: Mocha.Suite,
        event: ValueOf<typeof MochaEvents>,
        cb: (runnable: Mocha.Runnable) => void,
    ): void {
        suite.on(MochaEvents.ADD_SUITE, subSuite => this._addRecursiveHandler(subSuite as Mocha.Suite, event, cb));
        suite.on(event, cb);
    }
}
