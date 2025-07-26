import { TestReaderEvents as ReadEvents } from "../../events";
import RuntimeConfig from "../../config/runtime-config";
import type { EventEmitter } from "events";

type TreeBuilder = {
    addTrap: (trap: (obj: { timeout: number }) => void) => void;
};

export class ConfigController {
    #eventBus: EventEmitter;

    static create<T extends ConfigController>(this: new (eventBus: EventEmitter) => T, eventBus: EventEmitter): T {
        return new this(eventBus);
    }

    constructor(eventBus: EventEmitter) {
        this.#eventBus = eventBus;
    }

    testTimeout(timeout: number): this {
        const { replMode } = RuntimeConfig.getInstance();

        if (replMode?.enabled) {
            return this;
        }

        this.#eventBus.emit(ReadEvents.NEW_BUILD_INSTRUCTION, ({ treeBuilder }: { treeBuilder: TreeBuilder }) => {
            treeBuilder.addTrap(obj => (obj.timeout = timeout));
        });

        return this;
    }
}
