const ReadEvents = require("../read-events");

class SkipController {
    #eventBus;

    static create(...args) {
        return new this(...args);
    }

    constructor(eventBus) {
        this.#eventBus = eventBus;
    }

    in(matchers, reason, { silent } = {}) {
        this.#addTrap((browserId) => this.#match(matchers, browserId), reason, { silent });

        return this;
    }

    notIn(matchers, reason, { silent } = {}) {
        this.#addTrap((browserId) => !this.#match(matchers, browserId), reason, { silent });

        return this;
    }

    #addTrap(match, reason, { silent } = {}) {
        this.#eventBus.emit(ReadEvents.NEW_BUILD_INSTRUCTION, ({ treeBuilder }) => {
            treeBuilder.addTrap((obj) => {
                if (!match(obj.browserId)) {
                    return;
                }

                if (silent) {
                    obj.disable();
                } else {
                    obj.skip({ reason });
                }
            });
        });
    }

    #match(matchers, browserId) {
        return [].concat(matchers).some((m) => {
            return (m instanceof RegExp) ? m.test(browserId) : m === browserId;
        });
    }
}

module.exports = {
    SkipController,
};
