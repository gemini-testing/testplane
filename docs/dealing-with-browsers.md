<!-- DOCTOC SKIP -->

## Dealing with Browsers

Testplane v9 runs browser sessions through WebDriver. You can connect to a remote WebDriver grid or let Testplane install and run supported browsers and drivers locally.

### Local browsers and drivers

Set `gridUrl` to `"local"` and describe the browsers in the usual `browsers` section:

```typescript
export default {
    gridUrl: "local",

    browsers: {
        chrome: {
            desiredCapabilities: {
                browserName: "chrome",
                browserVersion: "130",
            },
        },
        firefox: {
            desiredCapabilities: {
                browserName: "firefox",
            },
        },
    },
} satisfies import("testplane").ConfigInput;
```

Install the configured browser binaries and drivers in advance:

```bash
npx testplane install-deps
```

You can also request explicit versions:

```bash
npx testplane install-deps chrome@130 firefox@128
```

If `install-deps` is not run first, Testplane can download missing local dependencies when the browser session starts. For a remote grid, set `gridUrl` to its WebDriver endpoint instead of `"local"`.

### Browser download mirrors

Configure mirrors once at the root of the Testplane config. The map is not a per-browser option:

```typescript
export default {
    gridUrl: "local",

    browserDownloadMirrors: {
        chrome: "https://mirror.example/chrome-for-testing",
        chromium: "https://mirror.example/chromium-browser-snapshots",
        firefox: "https://mirror.example/firefox",
    },

    browsers: {
        chrome: {
            desiredCapabilities: {
                browserName: "chrome",
                browserVersion: "130",
            },
        },
    },
} satisfies import("testplane").ConfigInput;
```

CI can supply or override individual mirrors with uppercase environment variables:

```bash
export TESTPLANE_BROWSER_DOWNLOAD_MIRRORS_CHROME=https://mirror.example/chrome-for-testing
export TESTPLANE_BROWSER_DOWNLOAD_MIRRORS_CHROMIUM=https://mirror.example/chromium-browser-snapshots
export TESTPLANE_BROWSER_DOWNLOAD_MIRRORS_FIREFOX=https://mirror.example/firefox
```

The uppercase variables take precedence over config values and compatibility variables with lowercase `testplane_` or `hermione_` prefixes. Leave an unused variable unset. An empty value is invalid.

Mirror URLs must be absolute `http:` or `https:` URLs without credentials, a query string, or a fragment. Testplane trims surrounding whitespace and trailing slashes while preserving a pathname prefix.

### Mirror layout

A mirror must preserve the archive layout expected by `@puppeteer/browsers` for every target platform used in CI.

- The Chrome mirror serves Chrome for Testing metadata at its root, including `LATEST_RELEASE_STABLE`, channel files such as `LATEST_RELEASE_BETA`, `latest-versions-per-milestone.json`, and `latest-patch-versions-per-build.json`.
- Chrome, Chrome Headless Shell, and ChromeDriver archives use Chrome for Testing paths such as `<build-id>/<platform>/chrome-<platform>.zip`, `<build-id>/<platform>/chrome-headless-shell-<platform>.zip`, and `<build-id>/<platform>/chromedriver-<platform>.zip`.
- The Chromium mirror serves snapshot archives under paths such as `<platform-folder>/<revision>/<archive>.zip`.
- The Firefox mirror serves `firefox_versions.json` at its root. Release archives use paths such as `<version>/<platform>/en-US/<archive>`.

The actual platform directory and archive names vary between Linux, macOS, Windows, and architectures. Mirror the upstream paths rather than inventing a new layout.

### Source exceptions and fallback behavior

The mirror keys cover different download sources:

- Chrome versions earlier than 113 are installed from Chromium snapshots and therefore use the `chromium` mirror.
- ChromeDriver versions earlier than 115 continue to use the legacy `chromedriver.storage.googleapis.com` source.
- GeckoDriver is not downloaded from the Firefox mirror. It continues to use its Mozilla/GitHub upstream source.

When a mirror covers a requested metadata file or archive, Testplane does not fall back to the public upstream. A missing platform archive, unavailable metadata file, or network failure stops installation with an error.

Download errors retain the underlying network diagnostics, including the mirror URL.
