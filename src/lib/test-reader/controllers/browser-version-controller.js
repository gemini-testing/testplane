const ReadEvents = require('../read-events');

class BrowserVersionController {
    #browserId;
    #eventBus;

    static create(...args) {
        return new this(...args);
    }

    constructor(browserId, eventBus) {
        this.#browserId = browserId;
        this.#eventBus = eventBus;
    }

    version(browserVersion) {
        this.#eventBus.emit(ReadEvents.NEW_BUILD_INSTRUCTION, ({treeBuilder}) => {
            treeBuilder.addTrap((obj) => {
                if (obj.browserId === this.#browserId) {
                    obj.browserVersion = browserVersion;
                }
            });
        });

        return this;
    }
}

function mkProvider(knownBrowsers, eventBus) {
    return (browserId) => {
        if (!knownBrowsers.includes(browserId)) {
            throw new Error(`browser "${browserId}" was not found in config file`);
        }

        return BrowserVersionController.create(browserId, eventBus);
    };
}

module.exports = {
    mkProvider,
    BrowserVersionController
};
