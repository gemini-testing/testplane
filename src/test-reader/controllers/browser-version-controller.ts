import { TestReaderEvents as ReadEvents } from "../../events";
import type { EventEmitter } from "events";

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
            const lines: string[] = [];

            lines.push(`Browser "${browserId}" is not defined in the Testplane config.`);
            lines.push(
                "\nYou are calling 'browser.version(...)' for a browser ID that does not exist in the config.",
                `Available browser IDs: ${knownBrowsers.join(", ")}`,
            );

            lines.push(
                "\nWhat you can do:",
                `- Add a browser with id "${browserId}" to the 'browsers' section in your testplane.config.ts`,
                `- Or use one of the existing browser IDs: ${knownBrowsers.join(", ")}`,
            );

            throw new Error(lines.join("\n"));
        }

        return BrowserVersionController.create(browserId, eventBus);
    };
}
