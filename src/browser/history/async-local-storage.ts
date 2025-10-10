import { AsyncLocalStorage } from 'async_hooks';

interface ContextData {
    shouldBypassHistory: boolean;
}

const context = new AsyncLocalStorage<ContextData>();

export const runWithContext = (contextData: ContextData, fn: () => unknown): unknown => {
    return context.run(contextData, fn);
}

export const getContext = (): ContextData | undefined => {
    return context.getStore();
}
