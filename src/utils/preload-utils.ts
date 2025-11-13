export const loadEsm = new Function("specifier", "return import(specifier)") as <T = unknown>(
    specifier: string,
) => Promise<T>; // eslint-disable-line no-use-before-define

export const preloadWebdriverIO = async (): Promise<void> => {
    await loadEsm("@testplane/webdriverio").catch(() => {});
};

export const preloadMochaReader = async (): Promise<void> => {
    await loadEsm(require.resolve("../test-reader/mocha-reader")).catch(() => {});
};
