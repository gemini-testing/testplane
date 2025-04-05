export const MIN_CHROME_VERSION_SUPPORT_ISOLATION = 93;
export const MIN_CHROME_VERSION_SUPPORT_BIDI = 128;
export const MIN_FIREFOX_VERSION_SUPPORT_BIDI = 119;
export const X_REQUEST_ID_DELIMITER = "__";

export const BROWSERS_SUPPORT_BIDI = [
    {
        name: "chrome",
        minVersion: MIN_CHROME_VERSION_SUPPORT_BIDI,
    },
    {
        name: "firefox",
        minVersion: MIN_FIREFOX_VERSION_SUPPORT_BIDI,
    },
];
