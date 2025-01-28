/// <reference types="node" />
import { EventEmitter } from "events";
import { GlobalHelper } from "../types";
export type Context = GlobalHelper & Record<string, Record<string, unknown>>;
type Methods = Record<string, (...args: unknown[]) => unknown>;
export declare class TestParserAPI {
    #private;
    static create<T extends TestParserAPI>(this: new (ctx: Context, eventBus: EventEmitter) => T, ctx: Context, eventBus: EventEmitter): T;
    constructor(ctx: Context, eventBus: EventEmitter);
    setController(namespace: string, methods: Methods): void;
}
export {};
