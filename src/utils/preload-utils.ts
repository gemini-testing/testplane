import { loadEsm } from "load-esm";

export const preloadWebdriverIO = async (): Promise<void> => {
    await loadEsm("@testplane/webdriverio").catch(() => {});
};

export const preloadMochaReader = async (): Promise<void> => {
    await loadEsm(require.resolve("../test-reader/mocha-reader")).catch(() => {});
};
