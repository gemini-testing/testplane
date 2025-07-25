import { loadEsm } from "load-esm";

export const preloadWebdriver = async (): Promise<void> => {
    await loadEsm("@testplane/webdriver").catch(() => {});
};

export const preloadWebdriverIO = async (): Promise<void> => {
    await loadEsm("@testplane/webdriverio").catch(() => {});
};

export const preloadMochaReader = async (): Promise<void> => {
    await loadEsm(require.resolve("../test-reader/mocha-reader")).catch(() => {});
};

export const preloadTestTransformer = async (): Promise<void> => {
    await loadEsm(require.resolve("../bundle/test-transformer")).catch(() => {});
};
