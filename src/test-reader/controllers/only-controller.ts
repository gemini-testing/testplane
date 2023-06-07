import { TestReaderEvents as ReadEvents } from "../../events";
import { EventEmitter } from "events";

type TreeBuilder = {
    addTrap: (trap: (obj: { browserId: string; disable: () => void }) => void) => void;
};

export class OnlyController {
    #eventBus: EventEmitter;

    static create<T extends OnlyController>(this: new (eventBus: EventEmitter) => T, eventBus: EventEmitter): T {
        return new this(eventBus);
    }

    constructor(eventBus: EventEmitter) {
        this.#eventBus = eventBus;
    }

    in(matchers: string | RegExp | Array<string | RegExp>): this {
        this.#addTrap(browserId => this.#match(browserId, matchers));

        return this;
    }

    notIn(matchers: string | RegExp | Array<string | RegExp>): this {
        this.#addTrap(browserId => !this.#match(browserId, matchers));

        return this;
    }

    #addTrap(match: (browserId: string) => boolean): void {
        this.#eventBus.emit(ReadEvents.NEW_BUILD_INSTRUCTION, ({ treeBuilder }: { treeBuilder: TreeBuilder }) => {
            treeBuilder.addTrap(obj => {
                if (!match(obj.browserId)) {
                    obj.disable();
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
