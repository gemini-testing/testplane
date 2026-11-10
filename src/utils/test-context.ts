import { AsyncLocalStorage } from "node:async_hooks";

export interface TestContext {
    readonly testXReqId: string;
    readonly traceparent: string;
}

const storage = new AsyncLocalStorage<TestContext>();

export function withTestContext<T>(context: TestContext, action: () => T): T {
    return storage.run(context, action);
}

export function getTestContext(): TestContext | null {
    return storage.getStore() ?? null;
}
