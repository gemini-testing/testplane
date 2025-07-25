import { loadEsm } from "load-esm";

export const preloadWebdriverIO = async (): Promise<void> => {
    await loadEsm("@testplane/webdriverio").catch(() => {});
};
