import { EventEmitter } from "events";
import { TestReaderEvents as ReadEvents } from "../../events";
import type { Test } from "../../types";

interface TreeBuilder {
    addTrap: (trap: (test: Test) => void) => void;
}

export class AlsoController {
    #eventBus: EventEmitter;

    static create<T extends AlsoController>(this: new (eventBus: EventEmitter) => T, eventBus: EventEmitter): T {
        return new this(eventBus);
    }

    constructor(eventBus: EventEmitter) {
        this.#eventBus = eventBus;
    }

    in(matchers: string | RegExp | Array<string | RegExp>): this {
        this.#addTrap(browserId => this.#match(browserId, matchers));

        return this;
    }

    #addTrap(match: (browserId: string) => boolean): void {
        this.#eventBus.emit(ReadEvents.NEW_BUILD_INSTRUCTION, ({ treeBuilder }: { treeBuilder: TreeBuilder }) => {
            treeBuilder.addTrap(obj => {
                if (match(obj.browserId)) {
                    obj.enable();
                }
            });
        });
    }

    #match(browserId: string, matchers: string | RegExp | Array<string | RegExp>): boolean {
        return ([] as Array<string | RegExp>).concat(matchers).some(m => {
            return m instanceof RegExp ? m.test(browserId) : m === browserId;
        });
    }
}
