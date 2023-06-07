const ReadEvents = require("./read-events");

module.exports = class TestParserAPI {
    #ctx;
    #eventBus;

    static create(...args) {
        return new this(...args);
    }

    constructor(ctx, eventBus) {
        this.#ctx = ctx;
        this.#eventBus = eventBus;
    }

    setController(namespace, methods) {
        this.#ctx[namespace] = {};

        Object.entries(methods).forEach(([cbName, cb]) => {
            this.#ctx[namespace][cbName] = (...args) => {
                this.#eventBus.emit(ReadEvents.NEW_BUILD_INSTRUCTION, ({ treeBuilder }) => {
                    treeBuilder.addTrap(obj => cb.call(obj, ...args));
                });

                return this.#ctx[namespace];
            };
        });
    }
};
