const ReadEvents = require("../read-events");

class OnlyController {
    #eventBus;

    static create(...args) {
        return new this(...args);
    }

    constructor(eventBus) {
        this.#eventBus = eventBus;
    }

    in(matchers) {
        this.#addTrap((browserId) => this.#match(browserId, matchers));

        return this;
    }

    notIn(matchers) {
        this.#addTrap((browserId) => !this.#match(browserId, matchers));

        return this;
    }

    #addTrap(match) {
        this.#eventBus.emit(ReadEvents.NEW_BUILD_INSTRUCTION, ({ treeBuilder }) => {
            treeBuilder.addTrap((obj) => {
                if (!match(obj.browserId)) {
                    obj.disable();
                }
            });
        });
    }

    #match(browserId, matchers) {
        return [].concat(matchers).some((m) => {
            return (m instanceof RegExp) ? m.test(browserId) : m === browserId;
        });
    }
}

module.exports = {
    OnlyController,
};
