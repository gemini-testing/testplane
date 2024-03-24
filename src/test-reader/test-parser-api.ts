import { TestReaderEvents } from "../events/index.js";

import type { EventEmitter } from "node:events";
import type { GlobalHelper } from "../types/index.js";
import type { TreeBuilder } from "./tree-builder.js";

type Context = GlobalHelper & Record<string, Record<string, unknown>>;
type Methods = Record<string, (...args: unknown[]) => unknown>;

interface NewBuildEventOpts {
    treeBuilder: TreeBuilder;
}

export class TestParserAPI {
    #ctx: Context;
    #eventBus: EventEmitter;

    static create<T extends TestParserAPI>(
        this: new (ctx: Context, eventBus: EventEmitter) => T,
        ctx: Context,
        eventBus: EventEmitter,
    ): T {
        return new this(ctx, eventBus);
    }

    constructor(ctx: Context, eventBus: EventEmitter) {
        this.#ctx = ctx;
        this.#eventBus = eventBus;
    }

    setController(namespace: string, methods: Methods): void {
        this.#ctx[namespace] = {};

        Object.entries(methods).forEach(([cbName, cb]) => {
            this.#ctx[namespace][cbName] = (...args: unknown[]): Record<string, unknown> => {
                this.#eventBus.emit(TestReaderEvents.NEW_BUILD_INSTRUCTION, ({ treeBuilder }: NewBuildEventOpts) => {
                    treeBuilder.addTrap((obj: unknown) => cb.call(obj, ...args));
                });

                return this.#ctx[namespace];
            };
        });
    }
}
