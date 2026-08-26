import { unstable, type BrowserDownloadMirrorsInput, type ConfigInput } from "../../src";

export const browserDownloadMirrors: BrowserDownloadMirrorsInput = {
    chrome: "https://mirror.example/chrome",
    chromium: "https://mirror.example/chromium",
    firefox: "https://mirror.example/firefox",
};

export const configWithBrowserDownloadMirrors = {
    browserDownloadMirrors,
    browsers: {
        chrome: {
            desiredCapabilities: {
                browserName: "chrome",
            },
        },
    },
} satisfies ConfigInput;

export const launchStandaloneBrowserWithMirrors = (): ReturnType<typeof unstable.launchBrowser> =>
    unstable.launchBrowser({ browserDownloadMirrors });

export const configWithInvalidPerBrowserMirrors = {
    browsers: {
        chrome: {
            desiredCapabilities: {
                browserName: "chrome",
            },
            // @ts-expect-error browserDownloadMirrors is a root-only config option
            browserDownloadMirrors,
        },
    },
} satisfies ConfigInput;
