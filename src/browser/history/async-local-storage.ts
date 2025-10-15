import { AsyncLocalStorage } from "async_hooks";

export interface HistoryContext {
    shouldBypassHistory: boolean;
}

const historyContext = new AsyncLocalStorage<HistoryContext>();

export const runWithHistoryContext = (contextData: HistoryContext, fn: () => unknown): unknown => {
    return historyContext.run(contextData, fn);
};

export const getHistoryContext = (): HistoryContext | undefined => {
    return historyContext.getStore();
};
