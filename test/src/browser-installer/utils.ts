import { Browser } from "../../../src/browser-installer/utils";
import * as utils from "../../../src/browser-installer/utils";

describe("browser-installer/utils", () => {
    describe("getNormalizedBrowserName", () => {
        it("CHROME", () => {
            assert.equal(utils.getNormalizedBrowserName("chrome"), Browser.CHROME);
        });

        it("FIREFOX", () => {
            assert.equal(utils.getNormalizedBrowserName("firefox"), Browser.FIREFOX);
        });

        it("EDGE", () => {
            assert.equal(utils.getNormalizedBrowserName("edge"), Browser.EDGE);
            assert.equal(utils.getNormalizedBrowserName("MicrosoftEdge"), Browser.EDGE);
            assert.equal(utils.getNormalizedBrowserName("msedge"), Browser.EDGE);
        });

        it("SAFARI", () => {
            assert.equal(utils.getNormalizedBrowserName("safari"), Browser.SAFARI);
        });

        it("null", () => {
            const invalidValue = "unknown" as (typeof Browser)[keyof typeof Browser];

            assert.equal(utils.getNormalizedBrowserName(invalidValue), null);
            assert.equal(utils.getNormalizedBrowserName(), null);
        });
    });

    it("createBrowserLabel", () => {
        assert.equal(utils.createBrowserLabel("browserName", "browserVersion"), "browserName@browserVersion");
    });

    describe("getMilestone", () => {
        it("if number", () => {
            assert.equal(utils.getMilestone(89), "89");
        });

        it("if semantic version", () => {
            assert.equal(utils.getMilestone("100.0.5670.160"), "100");
        });
    });

    describe("semverVersionsComparator", () => {
        it("greater", () => {
            assert.isAbove(utils.semverVersionsComparator("100.0.10.20", "99.0.20.10"), 0);
            assert.isAbove(utils.semverVersionsComparator("101.0.20.10", "100.0.10.20"), 0);
            assert.isAbove(utils.semverVersionsComparator("100.0.20.10", "100.0.10.20"), 0);
            assert.isAbove(utils.semverVersionsComparator("100.0.10.30", "foo_100.0.10.20"), 0);
            assert.isAbove(utils.semverVersionsComparator("bar_100.0.10.30", "100.0.10.20"), 0);
            assert.isAbove(utils.semverVersionsComparator("100.0.20.30", "100.0.10"), 0);
        });

        it("less", () => {
            assert.isBelow(utils.semverVersionsComparator("99.0.20.10", "100.0.10.20"), 0);
            assert.isBelow(utils.semverVersionsComparator("100.0.10.20", "101.0.20.10"), 0);
            assert.isBelow(utils.semverVersionsComparator("100.0.10.20", "100.0.20.10"), 0);
            assert.isBelow(utils.semverVersionsComparator("foo_100.0.10.20", "100.0.10.30"), 0);
            assert.isBelow(utils.semverVersionsComparator("100.0.10.20", "bar_100.0.10.30"), 0);
            assert.isBelow(utils.semverVersionsComparator("100.0.10.20", "100.0.20"), 0);
        });

        it("equal", () => {
            assert.equal(utils.semverVersionsComparator("100.0.10.20", "100.0.10.20"), 0);
            assert.equal(utils.semverVersionsComparator("foo_100.0.10", "100.0.10"), 0);
            assert.equal(utils.semverVersionsComparator("bar_100.0", "100.0"), 0);
            assert.equal(utils.semverVersionsComparator("100", "100"), 0);
        });
    });

    describe("normalizeChromeVersion", () => {
        it("1 part", () => {
            assert.equal(utils.normalizeChromeVersion("112"), "112");
        });

        it("2 parts", () => {
            assert.equal(utils.normalizeChromeVersion("112.0"), "112");
        });

        it("3 parts", () => {
            assert.equal(utils.normalizeChromeVersion("112.0.5678"), "112.0.5678");
        });

        it("4 parts", () => {
            assert.equal(utils.normalizeChromeVersion("112.0.5678.170"), "112.0.5678");
        });
    });
});
