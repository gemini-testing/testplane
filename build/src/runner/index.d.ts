/// <reference types="node" />
import * as pool from "../browser-pool";
import { BrowserRunner } from "./browser-runner";
import { InterceptedEvent, RunnerSyncEvent, Interceptor, InterceptData } from "../events";
import { Runner } from "./runner";
import WorkersRegistry from "../utils/workers-registry";
import PromiseGroup from "./promise-group";
import { TestCollection } from "../test-collection";
import { Config } from "../config";
import type { runTest, cancel } from "../worker";
import type { Stats as RunnerStats } from "../stats";
import EventEmitter from "events";
import { Test } from "../types";
interface WorkerMethods {
    runTest: typeof runTest;
    cancel: typeof cancel;
}
export interface Workers extends EventEmitter, WorkerMethods {
}
type MapOfMethods<T extends ReadonlyArray<string>> = {
    [K in T[number]]: (...args: Array<unknown>) => Promise<unknown> | unknown;
};
type RegisterWorkers<T extends ReadonlyArray<string>> = EventEmitter & MapOfMethods<T>;
export declare class MainRunner extends Runner {
    protected config: Config;
    protected interceptors: Interceptor[];
    protected browserPool: pool.BrowserPool | null;
    protected activeBrowserRunners: Map<string, BrowserRunner>;
    protected running: PromiseGroup;
    protected runned: boolean;
    protected cancelled: boolean;
    protected workersRegistry: WorkersRegistry;
    protected workers: Workers | null;
    constructor(config: Config, interceptors: Interceptor[]);
    init(): void;
    _isRunning(): boolean;
    run(testCollection: TestCollection, stats: RunnerStats): Promise<void>;
    addTestToRun(test: Test, browserId: string): boolean;
    protected _runTests(testCollection: TestCollection): Promise<void>;
    protected _runTestsInBrowser(testCollection: TestCollection, browserId: string): Promise<void>;
    protected getEventsToPassthrough(): RunnerSyncEvent[];
    protected getEventsToIntercept(): InterceptedEvent[];
    protected interceptEvents(runner: BrowserRunner, events: InterceptedEvent[]): void;
    protected applyInterceptors({ event, data }: Partial<InterceptData> | undefined, interceptors: Interceptor[]): Partial<InterceptData>;
    cancel(): void;
    registerWorkers<T extends ReadonlyArray<string>>(workerFilepath: string, exportedMethods: T): RegisterWorkers<T>;
}
export {};
