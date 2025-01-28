import { BrowserPlatform } from "@puppeteer/browsers";
export declare const getChromiumBuildId: (platform: BrowserPlatform, milestone: string | number) => Promise<string>;
export declare const getChromeDriverArchiveUrl: (version: string) => string;
export declare const getChromeDriverArchiveTmpPath: (version: string) => string;
