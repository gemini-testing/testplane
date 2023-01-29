const ReadEvents = require("../read-events");

class ConfigController {
    #eventBus;

    static create(...args) {
        return new this(...args);
    }

    constructor(eventBus) {
        this.#eventBus = eventBus;
    }

    testTimeout(timeout) {
        this.#eventBus.emit(ReadEvents.NEW_BUILD_INSTRUCTION, ({ treeBuilder }) => {
            treeBuilder.addTrap((obj) => obj.timeout = timeout);
        });

        return this;
    }
}

module.exports = {
    ConfigController,
};
