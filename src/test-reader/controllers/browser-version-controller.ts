import { TestReaderEvents as ReadEvents } from "../../events";
import { EventEmitter } from "events";

type TreeBuilder = {
    addTrap: (trap: (obj: { browserId: string; browserVersion?: string }) => void) => void;
};

export class BrowserVersionController {
    #browserId: string;
    #eventBus: EventEmitter;

    static create<T extends BrowserVersionController>(
        this: new (browserId: string, eventBug: EventEmitter) => T,
        browserId: string,
        eventBug: EventEmitter,
    ): T {
        return new this(browserId, eventBug);
    }

    constructor(browserId: string, eventBus: EventEmitter) {
        this.#browserId = browserId;
        this.#eventBus = eventBus;
    }

    version(browserVersion: string): this {
        this.#eventBus.emit(ReadEvents.NEW_BUILD_INSTRUCTION, ({ treeBuilder }: { treeBuilder: TreeBuilder }) => {
            treeBuilder.addTrap(obj => {
                if (obj.browserId === this.#browserId) {
                    obj.browserVersion = browserVersion;
                }
            });
        });

        return this;
    }
}

export function mkProvider(
    knownBrowsers: string[],
    eventBus: EventEmitter,
): (browserId: string) => BrowserVersionController {
    return browserId => {
        if (!knownBrowsers.includes(browserId)) {
            throw new Error(`browser "${browserId}" was not found in config file`);
        }

        return BrowserVersionController.create(browserId, eventBus);
    };
}
