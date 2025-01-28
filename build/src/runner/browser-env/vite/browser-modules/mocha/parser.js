import { MochaEvents } from "./events.js";
export class TestParser {
    _rootSuite = mocha.suite;
    static create() {
        return new this();
    }
    async loadFile(file, runnableHandler) {
        this._subscribeOnRunnableEvents(runnableHandler);
        await import(file);
    }
    _subscribeOnRunnableEvents(runnableHandler) {
        [MochaEvents.ADD_TEST, MochaEvents.ADD_HOOK_BEFORE_EACH, MochaEvents.ADD_HOOK_AFTER_EACH].forEach(event => {
            this._addRecursiveHandler(this._rootSuite, event, runnableHandler);
        });
    }
    _addRecursiveHandler(suite, event, cb) {
        suite.on(MochaEvents.ADD_SUITE, subSuite => this._addRecursiveHandler(subSuite, event, cb));
        suite.on(event, cb);
    }
}
//# sourceMappingURL=parser.js.map