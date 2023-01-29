const { EventEmitter } = require("events");
const Mocha = require("@gemini-testing/mocha");

const {
    EVENT_FILE_PRE_REQUIRE,
    EVENT_FILE_POST_REQUIRE,
    EVENT_SUITE_ADD_SUITE,
    EVENT_SUITE_ADD_TEST,
    EVENT_SUITE_ADD_HOOK_BEFORE_ALL,
    EVENT_SUITE_ADD_HOOK_AFTER_ALL,
    EVENT_SUITE_ADD_HOOK_BEFORE_EACH,
    EVENT_SUITE_ADD_HOOK_AFTER_EACH,
} = Mocha.Suite.constants;

class MochaEventBus extends EventEmitter {
    static events = Mocha.Suite.constants;

    static create(...args) {
        return new this(...args);
    }

    constructor(rootSuite) {
        super();

        rootSuite.setMaxListeners(0);
        this.#addRecursiveHandler(rootSuite, EVENT_SUITE_ADD_SUITE, (suite) => suite.setMaxListeners(0));

        [
            EVENT_FILE_PRE_REQUIRE,
            EVENT_FILE_POST_REQUIRE,
        ].forEach((event) => {
            rootSuite.on(event, (...args) => this.emit(event, ...args));
        });

        [
            EVENT_SUITE_ADD_SUITE,
            EVENT_SUITE_ADD_TEST,
            EVENT_SUITE_ADD_HOOK_BEFORE_ALL,
            EVENT_SUITE_ADD_HOOK_AFTER_ALL,
            EVENT_SUITE_ADD_HOOK_BEFORE_EACH,
            EVENT_SUITE_ADD_HOOK_AFTER_EACH,
        ].forEach((event) => {
            this.#addRecursiveHandler(rootSuite, event, (...args) => this.emit(event, ...args));
        });
    }

    #addRecursiveHandler(suite, event, cb) {
        suite.on(EVENT_SUITE_ADD_SUITE, (subSuite) => this.#addRecursiveHandler(subSuite, event, cb));
        suite.on(event, cb);
    }
}

module.exports = {
    MochaEventBus,
};
