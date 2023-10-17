import { isSupportIsolation } from "src/utils/browser";
import { MIN_CHROME_VERSION_SUPPORT_ISOLATION } from "src/constants/browser";

describe("browser-utils", () => {
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
    });
});
