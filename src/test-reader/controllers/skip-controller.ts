import { TestReaderEvents as ReadEvents } from "../../events";
import type { Test } from "../../types";
import type { EventEmitter } from "events";

interface TreeBuilder {
    addTrap: (trap: (test: Test) => void) => void;
}

interface SkipOpts {
    negate?: boolean;
    silent?: boolean;
}

export class SkipController {
    #eventBus: EventEmitter;

    static create<T extends SkipController>(this: new (eventBus: EventEmitter) => T, eventBus: EventEmitter): T {
        return new this(eventBus);
    }

    constructor(eventBus: EventEmitter) {
        this.#eventBus = eventBus;
    }

    in(matchers: string | RegExp | Array<string | RegExp>, reason: string, { silent }: SkipOpts = {}): this {
        this.#addTrap(browserId => this.#match(matchers, browserId), reason, { silent });

        return this;
    }

    notIn(matchers: string | RegExp | Array<string | RegExp>, reason: string, { silent }: SkipOpts = {}): this {
        this.#addTrap(browserId => !this.#match(matchers, browserId), reason, { silent });

        return this;
    }

    #addTrap(match: (browserId: string) => boolean, reason: string, { silent }: SkipOpts = {}): void {
        this.#eventBus.emit(ReadEvents.NEW_BUILD_INSTRUCTION, ({ treeBuilder }: { treeBuilder: TreeBuilder }) => {
            treeBuilder.addTrap(obj => {
                if (obj.browserId && !match(obj.browserId)) {
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

    #match(matchers: string | RegExp | Array<string | RegExp>, browserId: string): boolean {
        return ([] as Array<string | RegExp>).concat(matchers).some(m => {
            return m instanceof RegExp ? m.test(browserId) : m === browserId;
        });
    }
}
