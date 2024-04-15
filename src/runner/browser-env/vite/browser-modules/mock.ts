/**
 * this file content is assigned to modules we mock out for browser compatibility
 */
export const createRequire = (): VoidFunction => {
    const require = (): void => {}
    require.resolve = (): void  => {}
    return require
}

export const SUPPORTED_BROWSER = [];
export const locatorStrategy = {};
export class EventEmitter {};
export const URL = window.URL;
export const pathToFileURL = (): string => '';
export const fileURLToPath = (): string => '';
export const dirname = (): string => '';
export const resolve = (): string => '';
export const download = (): string => '';
export const findEdgePath = (): string => '';
export const sep = '/';
export const start = (): void => {};
export const install = (): void => {};
export const computeExecutablePath = (): void => {};
export const Browser = (): void => {};
export const getInstalledBrowsers = (): void => {};
export const canDownload = (): void => {};
export const resolveBuildId = (): void => {};
export const ChromeReleaseChannel = (): void => {};
export const detectBrowserPlatform = (): void => {};
export const type = 'browser';
export const sync = (): void => {};
export const locateChrome = (): void => {};
export const locateFirefox = (): void => {};
export default (): void => {};


export const formatStackTrace = (): string => '';
export const separateMessageFromStack = (): {stack: string} => {
    return {stack: ""};
};
