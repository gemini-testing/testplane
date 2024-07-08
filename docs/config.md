## Testplane Config Reference

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->
### Contents

- [Overview](#overview)
- [sets](#sets)
- [browsers](#browsers)
  - [desiredCapabilities](#desiredcapabilities)
  - [gridUrl](#gridurl)
  - [baseUrl](#baseurl)
  - [browserWSEndpoint](#browserwsendpoint)
  - [automationProtocol](#automationprotocol)
  - [sessionEnvFlags](#sessionenvflags)
  - [httpTimeout](#httptimeout)
  - [urlHttpTimeout](#urlhttptimeout)
  - [pageLoadTimeout](#pageloadtimeout)
  - [sessionRequestTimeout](#sessionrequesttimeout)
  - [sessionQuitTimeout](#sessionquittimeout)
  - [testTimeout](#testtimeout)
  - [waitTimeout](#waittimeout)
  - [waitInterval](#waitinterval)
  - [sessionsPerBrowser](#sessionsperbrowser)
  - [takeScreenshotOnFails](#takescreenshotonfails)
  - [takeScreenshotOnFailsMode](#takescreenshotonfailsmode)
  - [takeScreenshotOnFailsTimeout](#takescreenshotonfailstimeout)
  - [testsPerSession](#testspersession)
  - [retry](#retry)
  - [shouldRetry](#shouldretry)
  - [calibrate](#calibrate)
  - [meta](#meta)
  - [windowSize](#windowsize)
  - [screenshotDelay](#screenshotdelay)
  - [orientation](#orientation)
  - [waitOrientationChange](#waitorientationchange)
  - [resetCursor](#resetcursor)
  - [tolerance](#tolerance)
  - [antialiasingTolerance](#antialiasingtolerance)
  - [compareOpts](#compareopts)
  - [buildDiffOpts](#builddiffopts)
  - [assertViewOpts](#assertviewopts)
  - [openAndWaitOpts](#openandwaitopts)
  - [screenshotsDir](#screenshotsdir)
  - [strictTestsOrder](#stricttestsorder)
  - [compositeImage](#compositeimage)
  - [screenshotMode](#screenshotmode)
  - [saveHistoryMode](#savehistorymode)
  - [agent](#agent)
  - [headers](#headers)
  - [transformRequest](#transformrequest)
  - [transformResponse](#transformresponse)
  - [strictSSL](#strictssl)
  - [user](#user)
  - [key](#key)
  - [region](#region)
  - [headless](#headless)
  - [isolation](#isolation)
  - [passive](#passive)
- [system](#system)
  - [debug](#debug)
  - [mochaOpts](#mochaopts)
  - [expectOpts](#expectopts)
  - [ctx](#ctx)
  - [patternsOnReject](#patternsonreject)
  - [workers](#workers)
  - [testsPerWorker](#testsperworker)
  - [parallelLimit](#parallellimit)
  - [fileExtensions](#fileextensions)
  - [testRunEnv](#testrunenv)
- [plugins](#plugins)
  - [Parallel execution plugin code](#parallel-execution-plugin-code)
  - [List of useful plugins](#list-of-useful-plugins)
- [prepareBrowser](#preparebrowser)
- [prepareEnvironment](#prepareenvironment)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

### Overview

Testplane is tuned using a configuration file. By default, it uses `.testplane.conf.js`, but you can use the `--config` option to specify a path to the configuration file.

There is only one required field – `browsers`.
```javascript
module.exports = {
    browsers: {
        chrome: {
            desiredCapabilities: {
                browserName: 'chrome'
            }
        }
    }
};
```

### sets
You can use sets to bind some set of tests to certain browsers.

Format of the sets section:
```javascript
sets: {
    common: {                 // run tests associated with this path in all browsers
        files: 'tests/common' // which are configured in the `browsers` option
    },
    desktop: {
        files: [
            'tests/desktop/*.testplane.js',
            'tests/common/*.testplane.js'
        ],
        ignoreFiles: ['tests/desktop/fixtures/**'], // exclude directories from reading while test finding
        browsers: ['browser'] // run tests which match the specified masks in the browser with the `browser` id
    }
}
```

* `files` – A list of test files or directories with test files. This can be a string if you want to specify just one file or directory. Also, you can use
  masks for this property.

* `ignoreFiles` - A list of paths or masks to ignore from reading while test finding. When you write `!**/some-dir/**` it means that the directory will be read, but all the entries will not be included in the results. So using `ignoreFiles` you can speed up test reading for your project.

* `browsers` – A list of browser IDs to run the tests specified in `files`. All browsers by default.

You can specify sets to run using the CLI option `--set`.

If sets are not specified in the config and paths were not passed from CLI, all files from the `testplane`
directory are launched in all browsers specified in the config.

Running tests using sets:

 ```
 testplane --set desktop
 ```

### browsers
**Required.** The list of browsers to use for running tests.

The browser section has the following format
```javascript
browsers: {
    <browser_id>: {
        <option>:<value>
        <option>:<value>
    }
}
```
`<browser-id>` value is used for browser identification.

Available browser options:

Option name               | Description
------------------------- | -------------
`desiredCapabilities`     | **Required.** Used WebDriver [DesiredCapabilities](https://github.com/SeleniumHQ/selenium/wiki/DesiredCapabilities)
`gridUrl`                 | Selenium grid URL. Default value is `http://localhost:4444/wd/hub`.
`baseUrl`                 | Base service-under-test URL. Default value is `http://localhost`.
`browserWSEndpoint`       | Websocket endpoint to connect to the browser in order to be able to use CDP protocol. Default value is `null`.
`automationProtocol`      | Browser automation protocol. Default value is `webdriver`.
`sessionEnvFlags`         | Environment flags that determine which protocol will be used in created browser session. Default value is `{}`.
`waitTimeout`             | Timeout for web page event. Default value is `1000` ms.
`waitInterval`            | Interval for web page event. Default value is `250` ms.
`httpTimeout`             | Timeout for any requests to Selenium server. Default value is `30000` ms.
`urlHttpTimeout`          | Timeout for `/url` request to Selenium server. Default value is `httpTimeout`.
`pageLoadTimeout`         | Timeout for the page loading to complete. Default value is `20000` ms.
`sessionRequestTimeout`   | Timeout for getting a browser session. Default value is `httpTimeout`.
`sessionQuitTimeout`      | Timeout for quitting a session. Default value is `5000`.
`testTimeout`             | Timeout for test execution (in milliseconds). Default value is `null`, in this case will be used common timeout for all browsers from `system.mochaOpts.timeout`.
`sessionsPerBrowser`      | Number of sessions which are run simultaneously. Default value is `1`.
`takeScreenshotOnFails`   | Options for setting up taking a screenshot of a test fail. Default value is `{testFail: true, assertViewFail: false}`.
`takeScreenshotOnFailsMode` | Mode for taking a screenshot on test fail. Available options are `fullpage` and `viewport`. Default value is `fullpage`.
`takeScreenshotOnFailsTimeout`| Timeout for taking screenshot on test fail. Default value is `5000`.
`testsPerSession`         | Maximum amount of tests (`it`s) to run in each web driver session.
`retry`                   | How many times a test should be rerun. Default value is `0`.
`shouldRetry`             | Function that determines whether to make a retry. By default returns `true `if retry attempts are available otherwise returns `false`.
`calibrate`               | Allows to correctly capture the image. Default value is `false`.
`meta`                    | Additional data that can be obtained via .getMeta() method.
`windowSize`              | Browser window dimensions. Default value is `null`.
`screenshotDelay`         | Allows to specify a delay (in milliseconds) before making any screenshot.
`orientation`             | Browser orientation that will be set before each test run. Default value is `null`.
`waitOrientationChange`   | Allows to wait until screen orientation is changed. Default value is `true`.
`resetCursor`             | Allows to configure whether to move mouse cursor to `body` coordinates `(0, 0)` before each test run.
`tolerance`               | Maximum allowed [CIEDE2000](http://en.wikipedia.org/wiki/Color_difference#CIEDE2000) difference between colors. Default value is `2.3`.
`antialiasingTolerance`   | Minimum difference in brightness between the darkest/lightest pixel (which is adjacent to the antiasing pixel) and theirs adjacent pixels. Default value is `4`.
`compareOpts`             | Options for comparing images.
`buildDiffOpts`           | Options for building diff image.
`assertViewOpts`          | Options for `assertView` command, used by default.
`openAndWaitOpts`         | Options for `openAndWaitOpts` command, used by default
`screenshotsDir`          | Directory to save reference images for command `assertView`. Default dir is `testplane/screens` which is relative to `process.cwd()`.
`strictTestsOrder`        | Testplane will guarantee tests order in [readTests](#readtests) results. `false` by default.
`compositeImage`          | Allows testing of regions which bottom bounds are outside of a viewport height. In the resulting screenshot the area which fits the viewport bounds will be joined with the area which is outside of the viewport height. `true` by default.
`screenshotMode`          | Image capture mode.
`saveHistoryMode`         | Allows to save history of executed commands. `all` by default.
`agent`                   | Allows to use a custom `http`/`https`/`http2` [agent](https://www.npmjs.com/package/got#agent) to make requests. Default value is `null`.
`headers`                 | Allows to set custom [headers](https://github.com/sindresorhus/got/blob/main/documentation/2-options.md#headers) to pass into every webdriver request. These headers aren't passed into browser request. Read more about this option in [wdio](https://github.com/sindresorhus/got/blob/main/documentation/2-options.md#headers). Default value is `null`.
`transformRequest`        | Allows to intercept [HTTP request options](https://github.com/sindresorhus/got#options) before a WebDriver request is made. Default value is `null`.
`transformResponse`       | Allows to intercept [HTTP response object](https://github.com/sindresorhus/got#response) after a WebDriver response has arrived. Default value is `null`.
`strictSSL`               | Whether it does require SSL certificate to be valid. Default value is `null` (it means that will be used [default value from wdio](https://webdriver.io/docs/options/#strictssl)).
`user`                    | Cloud service username. Default value is `null`.
`key`                     | Cloud service access key or secret key. Default value is `null`.
`region`                  | Ability to choose different datacenters for run in cloud service. Default value is `null`.
`headless`                | Ability to run headless browser in cloud service. Default value is `null`.
`isolation`               | Ability to execute tests in isolated clean-state environment ([incognito browser context](https://chromedevtools.github.io/devtools-protocol/tot/Target/#method-createBrowserContext)). Default value is `false`, but `true` for chrome@93 and higher.
`passive`                 | Ability to make browser passive. Tests are not run in passive browsers by default. Default value is `false`.

#### desiredCapabilities
**Required.** Used WebDriver [DesiredCapabilities](https://github.com/SeleniumHQ/selenium/wiki/DesiredCapabilities). For example,

```js
'chrome': {
  desiredCapabilities: {
    browserName: 'chrome',
    version: '75.0', // or "browserVersion" if browser support w3c
    chromeOptions: {...}
  }
}
```

#### gridUrl
Selenium grid URL. Default value is `http://localhost:4444/wd/hub`.

#### baseUrl
Base service-under-test URL. Default value is `http://localhost`.

#### browserWSEndpoint
Websocket endpoint to connect to the browser in order to be able to use [CDP protocol](https://chromedevtools.github.io/devtools-protocol/). For example you specify `browserWSEndpoint: "ws://YOUR_HOST/devtools"` to which `sessionId` of the browser will be added to the end: `ws://YOUR_HOST/devtools/12345`, where `12345` is a `sessionId`. Default value is `null`, it means that `webdriverio` is trying to figure out the websocket endpoint on its own.

#### automationProtocol
Browser automation protocol (`webdriver`, `devtools`) that will be used. Default value is `webdriver`.

#### sessionEnvFlags
Environment flags that determine which protocol will be used in created browser session. By default environment flags are set automatically according to the used `desiredCapabilities` but in rare cases they are determined inaccurately and using this option they can be overriden explicitly.

Available flags:
- isW3C - should apply [`WebDriverProtocol`](https://webdriver.io/docs/api/webdriver) or use default [`JsonWProtocol`](https://webdriver.io/docs/api/jsonwp);
- isChrome - should apply [`ChromiumProtocol`](https://webdriver.io/docs/api/chromium);
- isMobile - should apply [MJsonWProtocol](https://webdriver.io/docs/api/mjsonwp) and [AppiumProtocol](https://webdriver.io/docs/api/appium);
- isSauce - should apply [Sauce Labs specific vendor commands](https://webdriver.io/docs/api/saucelabs);
- isSeleniumStandalone - should apply [special commands when running tests using Selenium Grid or Selenium Standalone server](https://webdriver.io/docs/api/selenium);

For example:

```js
'chrome': {
    sessionEnvFlags: {
        isW3C: true,
        isChrome: true
    }
}
```

#### httpTimeout
Timeout for any requests to Selenium server. Default value is `30000` ms.

#### urlHttpTimeout
Timeout for `/url` request to Selenium server. Default value is `httpTimeout`.
It may be useful when opening url takes a long time (for example a lot of logic is executed in middlewares), and you don't want to increase timeout for other commands.

#### pageLoadTimeout
Timeout for the page loading to complete. Default value is `20000` ms.

#### sessionRequestTimeout
Timeout for getting a browser session. Default value is `httpTimeout`.

#### sessionQuitTimeout
Timeout for quitting a session. Default value is `5000`.

#### testTimeout
Timeout for test execution (in milliseconds).
If applied to suite then timeout will be set for all tests and hooks inside this suite.
Default value is `null`, in this case will be used common timeout for all browsers from `system.mochaOpts.timeout`.

#### waitTimeout
Timeout for [waitUntil](https://webdriver.io/docs/api/element/waitUntil) which is used to all `waitFor*` commands. It is used in the search for elements and web page events. Default value is `3000` ms.

*For example: `browser.$('.element').click()` will wait up to 3000ms for element to exist before clicking it by default*

#### waitInterval
Interval for [waitUntil](https://webdriver.io/docs/api/element/waitUntil) which is used to all `waitFor*` commands. It is used in element finding and web page events. Default value is `500` ms.

*For example: `browser.$('.element').click()` will check element existence every 500ms by default*

#### sessionsPerBrowser
Number of sessions which are run simultaneously. Global value for all browsers. Default value is `1`.

#### takeScreenshotOnFails
Options for setting up taking a screenshot of a test fail. Can be an object with `testFail` and `assertViewFail` keys.

* `testFail` (default: `true`) – takes a screenshot when an error occurs in the test, except `assertView` fail.
* `assertViewFail` (default: `true`) – takes a screenshot if the test fails on the `assetView` command.

#### takeScreenshotOnFailsMode
Mode for taking a screenshot on test fail. There are two available options:

* `fullpage` – Testplane will take a screenshot of the entire page from top. Default value.
* `viewport` – Testplane will take a screenshot of the current viewport.

#### takeScreenshotOnFailsTimeout
Timeout for taking screenshot on test fail. Default value is `5000`.

#### testsPerSession
Maximum amount of tests (`it`s) to run in each web driver session. After limit is reached, session will be closed and new one will be started.
By default is `Infinity` (no limit, all tests will be run in the same session). Set to smaller number in case of problems with stability.

#### retry
How many times a test should be retried if it fails. Global value for all browsers. Default value is `0`.

#### shouldRetry
Function that determines whether to make a retry. Must return boolean value. By default returns `true` if retry attempts are available otherwise returns `false`.
Argument of this function is object with fields:

* `retriesLeft {Number}` — number of available retries
* `ctx` — in case of test `TEST_FAIL` it would be bound data, in case of `ERROR` it would be link to `Runnable`
* `[error]` — error type (available only in case of ERROR)


#### calibrate
Does this browser need to perform the calibration procedure. This procedure allows to correctly capture the image in case the particular WebDriver implementation captures browser UI along with web page. Default value is `false`.

#### meta
Additional data that can be obtained via .getMeta() method

#### windowSize
Browser window dimensions (i.e. `1600x1200`). If not specified, the size of the window depends on WebDriver. Can be specified as string with pattern `800x1000` or object with `width` and `height` keys (both keys should be number). For example,

```javascript
windowSize: '800x1000'
```
and
```javascript
windowSize: {
  width: 800,
  height: 1000
}
```
are the same.

:warning: You can't set specific resolutions for browser Opera or mobile platforms. They use only full-screen resolution.

#### screenshotDelay
Allows to specify a delay (in milliseconds) before making any screenshot. This is useful when the page has elements which are animated or if you do not want to screen a scrollbar. Default value is `0`.

#### orientation
Browser orientation (`landscape`, `portrait`) that will be set before each test run. It is necessary in order to return the browser orientation to the default state after test execution in which orientation is changed. Default value is `null`.

#### waitOrientationChange
Allows to wait until screen orientation is changed. Works inside `webdriverio` commands `orientation` and `setOrientation`. This option guarantee that screen rotated before the next command will start to execute. Default value is `true`.

#### resetCursor
Allows to configure whether to move mouse cursor to `body` coordinates `(0, 0)` before each test run. This can be useful to escape cases when a default position of a cursor affects your tests. We recommend to set this option *truthy* value for desktop browsers and *falsey* for mobile devices. Default value is `true`.

#### tolerance
Indicates maximum allowed [CIEDE2000](http://en.wikipedia.org/wiki/Color_difference#CIEDE2000) difference between colors. Used only in non-strict mode. By default it's 2.3 which should be enough for the most cases. Increasing global default is not recommended, prefer changing tolerance for particular suites or states instead.

#### antialiasingTolerance
Read more about this option in [looks-same](https://github.com/gemini-testing/looks-same#comparing-images-with-ignoring-antialiasing).

#### compareOpts
Extra options for comparing images. See [looks-same](https://github.com/gemini-testing/looks-same#comparing-images) documentation for the list of available options. Default values are:
```javascript
compareOpts: {
    shouldCluster: false,
    clustersSize: 10,
    stopOnFirstFail: false
}
```

#### buildDiffOpts
Extra options for building diff image. See [looks-same](https://github.com/gemini-testing/looks-same#building-diff-image) documentation for the list of available options. Default values are:
```javascript
buildDiffOpts: {
    ignoreAntialiasing: true,
    ignoreCaret: true
}
```

#### assertViewOpts
Default options used when calling [assertView](https://github.com/gemini-testing/testplane/#assertview), can be overridden by `assertView` options. Default values are:
```javascript
    ignoreElements: [],
    captureElementFromTop: true,
    allowViewportOverflow: false,
    disableAnimation: true,
    ignoreDiffPixelCount: 0,
```

#### openAndWaitOpts
Default options used when calling [openAndWait](https://github.com/gemini-testing/testplane/#openandwait), can be overriden by `openAndWait` options. Default values are:
```javascript
    waitNetworkIdle: true,
    waitNetworkIdleTimeout: 500,
    failOnNetworkError: true,
    ignoreNetworkErrorsPatterns: []
```

#### screenshotsDir

Directory to save reference images for command `assertView`. Default dir is `testplane/screens` which is relative to `process.cwd()`. The value of this option can also be a function which accepts one argument - an instance of a test within which comand `assertView` is called:

```javascript
    screenshotsDir: (test) => `tests/screenshots/${test.parent.title}`
```

#### strictTestsOrder

Testplane will guarantee tests order in [readTests](#readtests) results. `false` by default.

#### compositeImage

Allows testing of regions which bottom bounds are outside of a viewport height (default: true). In the resulting screenshot the area which fits the viewport bounds will be joined with the area which is outside of the viewport height.

#### screenshotMode

Image capture mode. There are 3 allowed values for this option:

* `auto` (default). Mode will be obtained automatically;
* `fullpage`. Testplane will deal with screenshot of full page;
* `viewport`. Only viewport area will be used.

By default, `screenshotMode` on android browsers is set to `viewport` to work around [the chromium bug](https://bugs.chromium.org/p/chromedriver/issues/detail?id=2853).

#### saveHistoryMode

Allows to save history of all executed commands. `'all'` by default.

Available options:
- `'all'` - history is enabled
- `'none'` - history is disabled
- `'onlyFailed'` - history is saved for failed tests only

Some plugins can rely on this history, for instance:
- [html-reporter](https://github.com/gemini-testing/html-reporter)
- [@testplane/profiler](https://github.com/gemini-testing/testplane-profiler)

The history is available from such events: `TEST_END`, `TEST_PASS`, `TEST_FAIL` through payload:
```js
// example of plugin code
module.exports = (testplane) => {
    testplane.on(testplane.events.TEST_PASS, async (test) => {
        console.log(test.history);
    });
};
```

#### agent
Allows to use a custom `http`/`https`/`http2` [agent](https://www.npmjs.com/package/got#agent) to make requests. Default value is `null` (it means that will be used default http-agent from got).

####  headers
Allows to set custom [headers](https://github.com/sindresorhus/got/blob/main/documentation/2-options.md#headers) to pass into every webdriver request. These headers aren't passed into browser request. Read more about this option in [wdio](https://github.com/sindresorhus/got/blob/main/documentation/2-options.md#headers). Default value is `null`.

####  transformRequest
Allows to intercept [HTTP request options](https://github.com/sindresorhus/got#options) before a WebDriver request is made. Default value is `null`. If function is passed then it takes `RequestOptions` as the first argument and should return modified `RequestOptions`. Example:

```javascript
(RequestOptions) => RequestOptions
```

In runtime a unique `X-Request-ID` header is generated for each browser request which consists of `${FIRST_X_REQ_ID}__${LAST_X_REQ_ID}`, where:
- `FIRST_X_REQ_ID` - unique uuid for each test (different for each retry), allows to find all requests related to a single test run;
- `LAST_X_REQ_ID` - unique uuid for each browser request, allows to find one unique request in one test (together with `FIRST_X_REQ_ID`).

Header `X-Request-ID` can be useful if you manage the cloud with browsers yourself and collect logs with requests. Real-world example: `2f31ffb7-369d-41f4-bbb8-77744615d2eb__e8d011d8-bb76-42b9-b80e-02f03b8d6fe1`.

To override generated `X-Request-ID` to your own value you need specify it in `transformRequest` handler. Example:

```javascript
transformRequest: (req) => {
    req.headers["X-Request-ID"] = "my_x_req_id";

    return req;
}
```

####  transformResponse
Allows to intercept [HTTP response object](https://github.com/sindresorhus/got#response) after a WebDriver response has arrived. Default value is `null`. If function is passed then it takes `Response` (original response object) as the first and `RequestOptions` as the second argument. Should return modified `Response`. Example:

```javascript
(Response, RequestOptions) => Response
```

####  strictSSL
Whether it does require SSL certificate to be valid. Default value is `null` (it means that will be used [default value from wdio](https://webdriver.io/docs/options/#strictssl)).

####  user
Cloud service username. Default value is `null`.

####  key
Cloud service access key or secret key. Default value is `null`.

####  region
Ability to choose different datacenters for run in cloud service. Default value is `null`.

####  headless
Ability to run headless browser in cloud service. Default value is `null`. Can be set as a Boolean (the default value of the browser will be used). For Chrome browsers starting from version 112 also can be specified as a string with "new"|"old" values  - this will enable the new headless mode (see [Chrome's blog post](https://developer.chrome.com/docs/chromium/new-headless)).

####  isolation
Ability to execute tests in isolated clean-state environment ([incognito browser context](https://chromedevtools.github.io/devtools-protocol/tot/Target/#method-createBrowserContext)). It means that `testsPerSession` can be set to `Infinity` in order to speed up tests execution and save browser resources. Currently works only in chrome@93 and higher. Default value is `null`, but `true` for chrome@93 and higher.

#### passive
Ability to make browser passive. Tests are not run in passive browsers by default. Using [testplane.also.in](./writing-tests.md#also) makes it possible to run test or suite before which it is specified.

:warning: When using this option, you need to get rid of the [hermione-passive-browsers](https://github.com/gemini-testing/testplane-passive-browsers) plugin, since they work together incorrectly.

### system

#### debug
Turn webdriver debug mode on. Default value is `false`.

#### mochaOpts

Extra options for `mocha` which are passed to `mocha.setup`. See [Mocha](https://mochajs.org/) documentation for the list of options. Default values are:
```javascript
mochaOpts: {
    slow: 10000, // If test execution time is greater than this value, then the test is slow.
    timeout: 60000 // timeout for test execution.
}
```

#### expectOpts

Options for [expect-webdriverio](https://webdriver.io/docs/api/expect-webdriverio/) that allow you to change default wait timeout and interval between attempts. Default values are:

```javascript
expectOpts: {
    wait: 3000, // wait timeout for expectation to succeed
    interval: 100 // interval between attempts
}
```

#### ctx
A context which will be available in tests via method `testplane.ctx`:
```javascript
ctx: {
    foo: 'bar'
}
```

```javascript
it('awesome test', function() {
    console.log(testplane.ctx); // {foo: 'bar'}
});
```

**Recommendation**: use `ctx` in your tests in favor of global variables.

#### patternsOnReject
Session would be rejected if test has been faile with error message which matches to specified patterns:
```javascript
patternsOnReject: [
    /some-pattern/,
    'other-pattern'
]
```

#### workers
Testplane runs all tests in subprocesses in order to decrease the main process CPU usage. This options defines the numbers of subprocesses to start for running tests. Default value is `1`.

#### testsPerWorker
The maximum number of tests to be run in one worker before it will be restarted.

#### parallelLimit
By default, Testplane will run all browsers simultaneously. Sometimes (i.e. when using cloud services, such as SauceLabs) you have to limit the amount of browsers that can be run at the same time. This option effectively limits how many browsers Testplane will try to run in parallel. Default value is `Infinity`.

#### fileExtensions
Ability to set file extensions, which Testplane will search on the file system. Default value is `[".js", ".mjs", ".ts", ".mts", ".jsx", ".tsx"]`.

#### testRunEnv
Ability to specify in which environment the tests should be run. There are two available environments:

* `nodejs` – Testplane will run tests in nodejs process. Default value.
* `browser` – Testplane will run tests inside of the browser.

The `browser` environment has additional options:

* `viteConfig` - ability to specify own [Vite configuration](https://vitejs.dev/config/). You can pass relative path to the config file as `string`, object with [UserConfig](https://github.com/vitejs/vite/blob/v5.1.6/packages/vite/src/node/config.ts#L127-L282) type or function with `(env: ConfigEnv) => UserConfig | Promise<UserConfig>` type.

```typescript
// .testplane.conf.ts
import viteConfig from './vite.config.ts';

export const {
    // ...
    system: {
        // ...
        // as relative path to the config file
        testRunEnv: ['browser', { viteConfig: './vite.config.ts' }],
        // or use object with UserConfig type
        testRunEnv: ['browser', { viteConfig }],
        // or use function
        testRunEnv: ['browser', {
            viteConfig: (configEnv) => ({
                // ...
            })
        }],
    }
}
```

### plugins
Testplane plugins are commonly used to extend built-in functionality. For example, [html-reporter](https://github.com/gemini-testing/html-reporter) and [@testplane/safari-commands](https://github.com/gemini-testing/testplane-safari-commands).

A plugin is a module that exports a single function. The function has two arguments:

* The `testplane` instance
* Plugin options from the configuration file

Plugins will be loaded before Testplane runs tests.

It's strongly recommended to name Testplane plugins with the `testplane-` prefix. This makes searching for user plugins [very simple](https://github.com/search?l=JavaScript&q=testplane-&type=Repositories&utf8=%E2%9C%93).

If a plugin name starts with `testplane-`, then the prefix can be ommited in the configuration file. If two modules with names `testplane-some-module` and `some-module` are specified, the module with the prefix will have higher priority.

For example:
```js
// .testplane.conf.js
// ...
plugins: {
    'my-cool-plugin': {
        param: 'value'
    }
}
// ...

// testplane-my-cool-plugin/index.js
module.exports = function(testplane, opts) {
    testplane.on(testplane.events.RUNNER_START, function(runner) {
        return setUp(testplane.config, opts.param); // config can be mutated
    });

    testplane.on(testplane.events.RUNNER_END, function() {
        return tearDown();
    });
}
```

**Properties of the `testplane` object**

Property name             | Description
------------------------- | -------------
`config`                  | Config that is used in the test runner. Can be mutated.
`events`                  | Events list for subscription.

For details on `events` field, refer to the [Testplane Events](events.md) page.

#### Parallel execution plugin code

Runner has a method `registerWorkers` which register plugin's code for parallel execution in Testplane's worker farm. The method accepts parameters `workerFilepath` (string, absolute path), `exportedMethods` (array of string) and return object which contains async functions with names from `exportedMethods`. File with path `workerFilepath` should export object which contains async functions with names from `exportedMethods`.

*Example*
```js
// plugin code
let workers;

module.exports = (testplane) => {
    testplane.on(testplane.events.RUNNER_START, async (runner) => {
        const workerFilepath = require.resolve('./worker');
        const exportedMethods = ['foo'];
        workers = runner.registerWorkers(workerFilepath, exportedMethods);

        // outputs `FOO_RUNNER_START`
        console.log(await workers.foo('RUNNER_START'));
    });

    testplane.on(testplane.events.RUNNER_END, async () => {
        // outputs `FOO_RUNNER_END`
        console.log(await workers.foo('RUNNER_END'));
    });
};

// worker.js
module.exports = {
    foo: async function(event) {
        return 'FOO_' + event;
    }
};

```

#### List of useful plugins
There are several plugins that may be useful:

* [html-reporter](https://github.com/gemini-testing/html-reporter)
* [@testplane/safari-commands](https://github.com/gemini-testing/testplane-safari-commands)
* [@testplane/headless-chrome](https://github.com/gemini-testing/testplane-headless-chrome)
* ...and many others that you can find in [gemini-testing](https://github.com/search?q=topic%3Atestplane-plugin+org%3Agemini-testing&type=Repositories).

### prepareBrowser
Prepare the browser session before tests are run. For example, add custom user commands.
```js
prepareBrowser: function(browser) {
    browser.addCommand('commandName', require('./path/to/commands/commandName.js'));
}
```

The `browser` argument is a `WebdriverIO` session.

### prepareEnvironment
Configuration data can be changed depending on extra conditions in the `prepareEnvironment` function.

### devServer
Launch dev server on testplane initialize (INIT event).

For example, this setup:
```js
// .testplane.conf.js
const SERVER_PORT = 3000;
...
export default {
    ...
    devServer: {
        command: "npm run server:dev",
        env: {PORT: SERVER_PORT},
        readinessProbe: {
            url: `http://localhost:${SERVER_PORT}/health`
            timeouts: { // optional
                waitServerTimeout: 60_000 // default value
            }
        }
    }
}
```
Will spawn child process "npm run server:dev", pass extra environment variable "PORT" with value "3000" and wait, until "http://localhost:3000/health" is ready to receive network requests and responds with 200-299 status code. If server is still not ready after 60 seconds, Testplane will fail.

Full list of parameters:
 - command (optional) `String` – command to launch dev server. If null or not defined, dev server is disabled
 - env (optional) `Record<string, string>` – extra environment variables to pass to child process, in addition to your `process.env`
 - args (optional)  `String[]` – arguments to pass to child process
 - cwd (optional) `String` – current working directory of the child process. If not defined, testplane will try to find nearest "package.json", starting from the directory with testplane config
 - logs (optional) `Boolean` – if enabled, shows dev server logs in the console with prefix "\[dev server\]". Enabled by default
 - readinessProbe (optional) `(devServer: ChildProcess) => Promise<void> | Object` - if function, ready check is completed when function is resolved. Receives child process object. Object by default
   - url (optional) `String` – url to request ready check status. If not defined, ready check is disabled
   - isReady (optional) `(fetchResponse => bool | Promise<bool>)` – predicate to check if server is ready based on `readinessProbe.url` fetch response. Returns `true` if statusCode is 2xx by default
   - timeouts (optional) `Object` – server waiting timeouts
     - waitServerTimeout (optional) `Number` - timeout to wait for server to be ready (ms). 60_000 by default
     - probeRequestTimeout (optional) `Number` - one request timeout (ms), after which request will be aborted. 10_000 by default
     - probeRequestInterval (optional) `Number` - interval between ready probe requests (ms). 1_000 by default
