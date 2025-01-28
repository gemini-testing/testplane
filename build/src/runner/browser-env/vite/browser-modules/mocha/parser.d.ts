type RunnableHandler = (runnable: Mocha.Runnable) => void;
export declare class TestParser {
    private _rootSuite;
    static create<T extends TestParser>(this: new () => T): T;
    loadFile(file: string, runnableHandler: RunnableHandler): Promise<void>;
    private _subscribeOnRunnableEvents;
    private _addRecursiveHandler;
}
export {};
