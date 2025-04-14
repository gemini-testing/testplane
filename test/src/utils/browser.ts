import { isSupportIsolation, getNormalizedBrowserName } from "src/utils/browser";
import { MIN_CHROME_VERSION_SUPPORT_ISOLATION } from "src/constants/browser";
import { BrowserName } from "src/browser/types";

describe("browser-utils", () => {
    describe("getNormalizedBrowserName", () => {
        it("CHROME", () => {
            assert.equal(getNormalizedBrowserName("chrome"), BrowserName.CHROME);
        });

        it("CHROMEHEADLESSSHELL", () => {
            assert.equal(getNormalizedBrowserName("chrome-headless-shell"), BrowserName.CHROMEHEADLESSSHELL);
        });

        it("FIREFOX", () => {
            assert.equal(getNormalizedBrowserName("firefox"), BrowserName.FIREFOX);
        });

        it("EDGE", () => {
            assert.equal(getNormalizedBrowserName("edge"), BrowserName.EDGE);
            assert.equal(getNormalizedBrowserName("MicrosoftEdge"), BrowserName.EDGE);
            assert.equal(getNormalizedBrowserName("msedge"), BrowserName.EDGE);
        });

        it("SAFARI", () => {
            assert.equal(getNormalizedBrowserName("safari"), BrowserName.SAFARI);
        });

        it("null", () => {
            const invalidValue = "unknown" as (typeof BrowserName)[keyof typeof BrowserName];

            assert.equal(getNormalizedBrowserName(invalidValue), null);
            assert.equal(getNormalizedBrowserName(), null);
        });
    });

    describe("isSupportIsolation", () => {
        describe("should return 'false' if", () => {
            it("specified browser is not chrome", () => {
                assert.isFalse(isSupportIsolation("firefox"));
            });

            it("specified browser is chrome, but version is not passed", () => {
                assert.isFalse(isSupportIsolation("chrome"));
            });

            it(`specified chrome lower than @${MIN_CHROME_VERSION_SUPPORT_ISOLATION}`, () => {
                assert.isFalse(isSupportIsolation("chrome", "90.0"));
            });
        });

        it(`should return 'true' if specified chrome@${MIN_CHROME_VERSION_SUPPORT_ISOLATION} or higher`, () => {
            assert.isTrue(isSupportIsolation("chrome", `${MIN_CHROME_VERSION_SUPPORT_ISOLATION}.0`));
        });

        it(`should return 'true' if specified chrome-headless-shell@${MIN_CHROME_VERSION_SUPPORT_ISOLATION} or higher`, () => {
            assert.isTrue(isSupportIsolation("chrome-headless-shell", `${MIN_CHROME_VERSION_SUPPORT_ISOLATION}.0`));
        });
    });
});
