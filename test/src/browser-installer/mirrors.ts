import { BrowserName } from "../../../src/browser/types";
import { getBrowserDownloadMirror, getBrowserDownloadMirrorFileUrl } from "../../../src/browser-installer/mirrors";

describe("browser-installer/mirrors", () => {
    const mirrors = {
        chrome: "https://mirror.example/chrome/",
        chromium: "https://mirror.example/chromium/",
        firefox: "https://mirror.example/firefox/",
    };

    it("should resolve mirror for each downloadable browser", () => {
        assert.equal(getBrowserDownloadMirror(BrowserName.CHROME, mirrors), "https://mirror.example/chrome");
        assert.equal(
            getBrowserDownloadMirror(BrowserName.CHROMEHEADLESSSHELL, mirrors),
            "https://mirror.example/chrome",
        );
        assert.equal(getBrowserDownloadMirror(BrowserName.CHROMIUM, mirrors), "https://mirror.example/chromium");
        assert.equal(getBrowserDownloadMirror(BrowserName.FIREFOX, mirrors), "https://mirror.example/firefox");
    });

    it("should not resolve mirrors for browsers that Testplane does not download", () => {
        assert.isUndefined(getBrowserDownloadMirror(BrowserName.EDGE, mirrors));
        assert.isUndefined(getBrowserDownloadMirror(BrowserName.SAFARI, mirrors));
    });

    it("should reject an empty configured mirror", () => {
        assert.throws(
            () => getBrowserDownloadMirror(BrowserName.CHROME, { ...mirrors, chrome: "  " }),
            '"browserDownloadMirrors.chrome" must not be empty',
        );
    });

    it("should preserve pathname prefixes and normalize whitespace and trailing slashes", () => {
        assert.equal(
            getBrowserDownloadMirror(BrowserName.CHROME, {
                ...mirrors,
                chrome: "  https://mirror.example/cache/chrome///  ",
            }),
            "https://mirror.example/cache/chrome",
        );
    });

    [
        {
            value: "mirror.example/chrome",
            error: '"browserDownloadMirrors.chrome" must be an absolute http: or https: URL',
        },
        {
            value: "ftp://mirror.example/chrome",
            error: '"browserDownloadMirrors.chrome" must be an absolute http: or https: URL',
        },
        {
            value: "https://user:password@mirror.example/chrome",
            error: '"browserDownloadMirrors.chrome" must not contain a username or password',
        },
        {
            value: "https://mirror.example/chrome?channel=stable",
            error: '"browserDownloadMirrors.chrome" must not contain a query string',
        },
        {
            value: "https://mirror.example/chrome#stable",
            error: '"browserDownloadMirrors.chrome" must not contain a fragment',
        },
    ].forEach(({ value, error }) => {
        it(`should reject invalid programmatic mirror ${value}`, () => {
            assert.throws(() => getBrowserDownloadMirror(BrowserName.CHROME, { ...mirrors, chrome: value }), error);
        });
    });

    it("should reject a non-string programmatic mirror", () => {
        assert.throws(
            () =>
                getBrowserDownloadMirror(BrowserName.CHROME, {
                    ...mirrors,
                    chrome: true as unknown as string,
                }),
            '"browserDownloadMirrors.chrome" must be a string',
        );
    });

    it("should join metadata filename to mirror URL", () => {
        assert.equal(
            getBrowserDownloadMirrorFileUrl("https://mirror.example/chrome/", "LATEST_RELEASE_STABLE"),
            "https://mirror.example/chrome/LATEST_RELEASE_STABLE",
        );
    });
});
