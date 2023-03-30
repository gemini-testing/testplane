# Hermione

Hermione is a utility for integration testing of web pages using [WebdriverIO v7](https://webdriver.io/docs/api) and [Mocha](https://mochajs.org).

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->

- [Why you should choose hermione](#why-you-should-choose-hermione)
  - [Easy to use](#easy-to-use)
  - [Runs tests in parallel](#runs-tests-in-parallel)
  - [Runs tests in subprocesses](#runs-tests-in-subprocesses)
  - [Extensible](#extensible)
  - [Built-in assert library](#built-in-assert-library)
  - [Retries failed tests](#retries-failed-tests)
  - [Executes separate tests](#executes-separate-tests)
  - [Skips tests in specific browsers](#skips-tests-in-specific-browsers)
  - [Override browser configuration for test](#override-browser-configuration-for-test)
    - [`version(<browserVersion>)`](#versionbrowserversion)
  - [Offers flexible test configuration](#offers-flexible-test-configuration)
  - [Automatically initializes and closes grid sessions](#automatically-initializes-and-closes-grid-sessions)
  - [Fairly waits for screen rotate](#fairly-waits-for-screen-rotate)
- [Prerequisites](#prerequisites)
  - [Selenium-standalone](#selenium-standalone)
- [Quick start](#quick-start)
  - [Chrome Devtools Protocol](#chrome-devtools-protocol)
  - [Webdriver protocol](#webdriver-protocol)
- [Tests API](#tests-api)
  - [Arguments](#arguments)
  - [Hooks](#hooks)
  - [Skip](#skip)
  - [Only](#only)
  - [Config overriding](#config-overriding)
    - [testTimeout](#testtimeout)
  - [WebdriverIO extensions](#webdriverio-extensions)
    - [Sharable meta info](#sharable-meta-info)
    - [Execution context](#execution-context)
  - [AssertView](#assertview)
  - [RunStep](#runstep)
- [.hermione.conf.js](#hermioneconfjs)
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
    - [testTimeout](#testtimeout-1)
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
  - [plugins](#plugins)
    - [Parallel execution plugin code](#parallel-execution-plugin-code)
    - [List of useful plugins](#list-of-useful-plugins)
  - [prepareBrowser](#preparebrowser)
  - [prepareEnvironment](#prepareenvironment)
- [CLI](#cli)
  - [Reporters](#reporters)
  - [Require modules](#require-modules)
  - [Overriding settings](#overriding-settings)
  - [Environment variables](#environment-variables)
    - [HERMIONE_SKIP_BROWSERS](#hermione_skip_browsers)
    - [HERMIONE_SETS](#hermione_sets)
  - [Debug mode](#debug-mode)
- [Programmatic API](#programmatic-api)
  - [init](#init)
  - [run](#run)
  - [addTestToRun](#addtesttorun)
  - [readTests](#readtests)
  - [isFailed](#isfailed)
  - [isWorker](#isworker)
  - [halt](#halt)
  - [Test Collection](#test-collection)
  - [Test Parser API](#test-parser-api)
    - [setController(name, methods)](#setcontrollername-methods)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

## Why you should choose hermione
`Hermione` provides several features that `WebdriverIO` doesn't, and makes the testing process easier.

### Easy to use
If you are familiar with [WebdriverIO](http://webdriver.io/) and [Mocha](https://mochajs.org), you can start writing and running tests in 5 minutes! You need to install `hermione` via npm and add a tiny config to your project. For details, see the [Quick start](#quick-start) section.

### Runs tests in parallel
When tests are run one by one, it takes a lot of time. `Hermione` can run tests in parallel sessions in different browsers out of the box.

### Runs tests in subprocesses
Running of too many tests in parallel can lead to the overloading of the main process CPU usage which causes degradation in test passing time, so Hermione runs all tests in subprocesses in order to solve this problem.

### Extensible
`WebdriverIO` provides built-in commands for browser and page manipulation. Often projects need to store some common code and reuse it throughout all tests, so the developer needs to create some helpers and include them in the tests.

With `hermione` this is very simple and straightforward. You can add any number of custom commands in the hermione config and use them as `browser.myCustomCommand` in tests.

Moreover, `hermione` provides plugins that work like hooks. They allow the developer to prepare the testing environment and react properly to test execution events.

### Built-in assert library
when writing integration tests, we need to check for various conditions, such as that a button element has certain attributes. So hermione provides global `expect` variable that gives you access to a number of `matchers` that let you validate different things on the browser, an element or mock object. More about using `expect` and its API you can find [here](https://webdriver.io/docs/api/expect-webdriverio/).

### Retries failed tests
Integration tests use a dynamic environment with a lot of dependencies, where any of them could be unstable from time to time. As a result, integration tests turn red randomly, which makes them imprecise. This spoils the entire testing process.

To prevent incidental fails, `hermione` retries a failed test before marking it as failed. This makes it possible to get rid of a majority of incidental fails. The number of retries can be specified for all browsers or for a specific browser.

:warning: `Hermione` reruns tests in a new browser session to exclude situations when the browser environment is the cause of the failure.

### Executes separate tests
Sometimes you only need to run specific tests, not all the tests in a set. `Hermione` makes this possible. You can specify the path to the test file
```
hermione tests/func/mytest.js
```

or filter describes by using the `--grep` option

```
hermione --grep login
```

or simply use the `mocha` `only()` API in the test

```js
describe.only('user login', function() {...});
```

### Skips tests in specific browsers
Sometimes you need to skip a test just in a specific browser, not in all browsers. For example, you don't need to run
some test in ~~ugly~~ IE browsers. In `hermione` you can do this with [hermione helper](#skip). For example,
you can skip some tests in a specific browser
```js
describe('feature', function() {
    hermione.skip.in('ie8', 'it cannot work in this browser');
    it('nowaday functionality', function() {...});
});
```

or run tests in just one browser
```js
describe('feature', function() {
    // will be skipped in all browsers except Chrome
    hermione.skip.notIn('chrome', 'it should work only in Chrome');
    it('specific functionality', function() {...});
});
```

In these cases you will see messages in reports with the reason for skipping.

To skip a suite or test silently (without any messages in reports), you can pass the third argument with the silent flag:
```js
hermione.skip.in('ie8', 'skipReason', {silent: true});
// or
hermione.skip.notIn('chrome', 'skipReason', {silent: true});
```

Or you can use another hermione helper, [only](#only), which is silent by default:
```js
hermione.only.in('chrome');
// or
hermione.only.notIn('ie8');
```

`hermione.only.in` will run tests only in the specified browsers and skip the rest silently.

`hermione.only.notIn` will run tests in all browsers except the specified ones.

### Override browser configuration for test
`Hermione` allows you to override a browser configuration for each test or a whole suite.
Each method of `hermione.browser(<browserName>)` provide chaining.

#### `version(<browserVersion>)`

```js
// change the browser version for all chindren
hermione.browser('chrome').version('70.3');
describe('suite', function() {
    // ...
});
```

```js
// change the browser version for a specific test
hermione.browser('chrome').version('70.3');
it('test', function() {...});
```

```js
hermione.browser('chrome').version('70.3');
describe('suite', function() {
    it('test 1', function() {...});

    // this call will override the version only for test below
    hermione.browser('chrome').version('70.1');
    it('test 2', function() {...});
});
```

### Offers flexible test configuration
`Hermione` lets you configure running some set of tests in specific browsers. For example,
```js
sets: {
    desktop: {
        files: 'tests/desktop',
        browsers: ['ie8', 'opera']
    },
    touch: {
        files: 'tests/touch',
        browsers: ['iphone', 'android']
    }
}
```
See [sets](#sets) for more details.


### Automatically initializes and closes grid sessions
All work with the grid client is encapsulated in hermione. Forget about `client.init` and `client.end` in your tests ;)

### Fairly waits for screen rotate
Request `/session/:sessionId/orientation` is not a part of the official Webdriver specification, so commands `orientation` and `setOrientation` which are provided by client `webdriverio` from the box do not guarantee screen rotate before the next command will start to execute, but `Hermione` solves this problem.

## Prerequisites
All you need are browsers that `Hermione` could use for testing. To do this you need to install some browsers, such as [chrome](https://www.google.com/chrome/) (to automate this process you can use the [hermione-headless-chrome](https://github.com/gemini-testing/hermione-headless-chrome) plugin).

Next, you have two ways to configure `Hermione` to work with browsers:

* Using the devtools protocol (available only for `Chromium`-based browsers). This method does not need to be pre-configured. Just go to the [quick start](#quick-start).
* Using the webdriver protocol. In this case you need to set up [Selenium](http://www.seleniumhq.org/) grid. The simplest way to get started is to use one of the NPM selenium standalone packages, such as [vvo/selenium-standalone](https://github.com/vvo/selenium-standalone). For more information about setting up, see [selenium-standalone](#selenium-standalone).

### Selenium-standalone
Install `selenium-standalone` by command:

```
npm i -g selenium-standalone
```

Next you need to install browser drivers

```
selenium-standalone install
```

and run your server by executing

```
selenium-standalone start
```

:warning: If you will get error like `No Java runtime present, requesting install.` you should install [Java Development Kit (JDK)](https://www.oracle.com/technetwork/java/javase/downloads/index.html) for your OS.

## Quick start
First of all, make sure that all [prerequisites](#prerequisites) are satisfied.

Install the package.
```
npm install hermione chai
```

Then put `.hermione.conf.js` in the project root. There are two configuration options depending on the method selected in the `prerequisites` block.

### Chrome Devtools Protocol

```javascript
module.exports = {
    sets: {
        desktop: {
            files: 'tests/desktop'
        }
    },

    browsers: {
        chrome: {
            automationProtocol: 'devtools',
            desiredCapabilities: {
                browserName: 'chrome'
            }
        }
    }
};
```

### Webdriver protocol

```javascript
module.exports = {
    gridUrl: 'http://localhost:4444/wd/hub',

    sets: {
        desktop: {
            files: 'tests/desktop'
        }
    },

    browsers: {
        chrome: {
            automationProtocol: 'webdriver', // default value
            desiredCapabilities: {
                browserName: 'chrome'
            }
        }
    }
};
```

Write your first test in `tests/desktop/github.js` file.
```javascript
const assert = require('chai').assert;

describe('github', async function() {
    it('should find hermione', async function() {
        await this.browser.url('https://github.com/gemini-testing/hermione');

        const title = await this.browser.$('#readme h1').getText();
        assert.equal(title, 'Hermione');
    });
});
```

Finally, run tests (be sure that you have already run `selenium-standalone start` command in next tab).
```
node_modules/.bin/hermione
```

## Tests API

### Arguments
Hermione calls test and hook callback with one argument. This argument is an object with the next properties:
- **browser** - browser client
- **currentTest** - current executing test

Example:
```js
beforeEach(async ({ browser, currentTest }) => {
    await browser.url(`/foo/bar?baz=${currentTest.id}`);
});

afterEach(async ({ browser, currentTest }) => {
    // Do some post actions with browser
});

it('some test', async ({ browser, currentTest }) => {
    await browser.click('.some-button');

    // Do some actions and asserts
});
```

You also can pass any data into your test through parameters:
```js
beforeEach(async (opts) => {
    opts.bar = 'bar';
});

it('some test', async ({ browser, bar }) => {
    await browser.url(`/foo/${bar}`);

    // Do some actions and asserts
});
```

**browser** and **currentTest** also available through callback context:
```js
beforeEach(async function() {
    await this.browser.url(`/foo/bar?baz=${this.currentTest.id}`);
});

afterEach(async function() {
    // Do some post actions with this.browser
});

it('some test', async function() {
    await this.browser.click('.some-button');

    // Do some actions and asserts
});
```

### Hooks

`before` and `after` hooks **are forbidden** in `hermione`, you should use `beforeEach` and `afterEach` hooks instead. This feature was implemented in order to ensure better stability while running tests and make them independent of each other.

### Skip
This feature allows you to ignore the specified suite or test in any browser, with an additional comment.
You can do this by using the global `hermione.skip` helper. It supports the following methods:

 - `.in` – Adds matchers for browsers with the additional comment.
 - `.notIn` – `.in` method with the reverted value.

Each of these methods takes the following arguments:

 - browser {String|RegExp|Array<String|RegExp>} – Matcher for browser(s) to skip.
 - [comment] {String} – Comment for skipped test.
 - [options] {Object} – Additional options.

**Note that matchers will be compared with `browserId` specified in the config file, e.g. `chrome-desktop`.**

For example,
```js
describe('feature', function() {
    hermione.skip.in('chrome', "It shouldn't work this way in Chrome");
    it('should work this way', function() {
        return runTestThisWay();
    });

    it('should work that way', function() {
        return runTestThatWay();
    });

    hermione.skip.in(['chrome', 'firefox', /ie\d*/], 'Unstable test, see ticket TEST-487');
    it('should have done some tricky things', function() {
        return runTrickyTest();
    });
});
```

In this case, the behaviour `it should work this way` will be skipped only in `chrome` browser, but will be run in other browsers. `It should work that way` will not be ignored. So only the nearest test will be skipped. If you need to skip all tests within a suite, you can apply the `skip` helper to a `describe` so all tests within this suite will be skipped with the same comment.
```js
hermione.skip.in('chrome', 'skip comment');
describe('some feature', function() {
    it(...);
    it(...);
});
```

You can also use the `.notIn` method to invert matching. For example,
```js
// ...
hermione.skip.notIn('chrome', 'some comment');
it('should work this way', function() {
    return doSomething();
});
// ...
```

In this case, the test will be skipped in all browsers except `chrome`.

All of these methods are chainable, so you can skip a test in several browsers with different comments. For example,
```js
// ...
hermione.skip
    .in('chrome', 'some comment')
    .notIn('ie9', 'another comment');
it('test1', function() {
    return doSomething();
});
// ...
```

If you need to skip a test in all browsers without a comment, you can use [mocha `.skip` method](http://mochajs.org/#inclusive-tests) instead of `hermione.skip.in(/.*/);`. The result will be the same.

### Only
This feature allows you to ignore the specified suite or test in any browser silently (without any messages in reports).
You can do this by using the global `hermione.only` helper. It supports two methods:

- `.in` — The `hermione.skip.notIn` method with the silent flag,
- `.notIn` — The `hermione.skip.in` with the silent flag.

These methods take the following arguments:

 - browser {String|RegExp|Array<String|RegExp>} — A matcher for browser(s) to skip.

For example:
```js
// ...
hermione.only.in('chrome');

it('should work this way', function() {
    return doSomething();
});
```
The test will be skipped all browsers **silently** except in `chrome`.

```js
hermione.only.notIn('ie9');
it('should work another way', function() {
    return doSomething();
});
```
The test will be processed in all browsers and **silently** skipped in `ie9`.

### Config overriding
You can override some config settings for specific test, suite or hook via `hermione.config.*` notation.

#### testTimeout
Overrides [testTimeout](#testtimeout-1) config setting. Can be set for tests and suites.

```js
hermione.config.testTimeout(100500);
it('some test', function() {
    return doSomething();
});
```

### WebdriverIO extensions
`Hermione` adds some useful methods and properties to the `webdriverio` session after its initialization.

#### Sharable meta info
Implemented via two commands:

* setMeta(key, value)
* getMeta([key])

These methods allow you to store some information between webdriver calls and it can then be used in custom commands, for instance. This meta information will be shown in the [html-reporter](https://github.com/gemini-testing/html-reporter).

**Note**: hermione saves the last URL opened in the browser in meta info.

Example:
```js
it('test1', async ({ browser }) => {
    await browser.setMeta('foo', 'bar');
    await browser.url('/foo/bar?baz=qux');

    const val = await browser.getMeta('foo');
    console.log(val); // prints 'bar'

    const url = await browser.getMeta('url');
    console.log(url); // prints '/foo/bar?baz=qux'

    const meta = await browser.getMeta();
    console.log(meta); // prints `{foo: 'bar', url: '/foo/bar?baz=qux'}`
});
```

#### Execution context
The execution context can be accessed by the `browser.executionContext` property, which contains the current test/hook object extended with the browser id.

Example:
```js
it('some test', async ({ browser }) => {
    await browser.url('/foo/bar');
    console.log('test', browser.executionContext);
});
```
will print something like this
```
test: {
  "title": "some test",
  "async": 0,
  "sync": true,
  "timedOut": false,
  "pending": false,
  "type": "test",
  "body": "...",
  "file": "/foo/bar/baz/qux.js",
  "parent": "#<Suite>",
  "ctx": "#<Context>",
  "browserId": "chrome",
  "meta": {},
  "timer": {}
}
```

### AssertView

Command that adds ability to take screenshot for test state. Each state should have his own unique name. For example:

```js
it('some test', async ({ browser }) => {
    await browser.url('some/url');
    await browser.assertView('plain', '.button');

    await browser.click('.button');
    await browser.assertView('clicked', '.button');
});
```

Could also be used as element's method:

```js
it('some test', async ({ browser }) => {
    await browser.url('some/url');

    const elem = await browser.$('.button');

    await elem.assertView('plain');
    await elem.click();
    await elem.assertView('clicked');
});
```

*Note: assertView will trigger [waitForExist](https://webdriver.io/docs/api/element/waitForExist/) with [waitTimeout](#waittimeout) and [waitInterval](#waitinterval)*

Parameters:

 - state (required) `String` – state name; should be unique within one test
 - selector (required) `String|String[]` – DOM-node selector that you need to capture
 - opts (optional) `Object`:
   - ignoreElements (optional) `String|String[]` – elements, matching specified selectors will be ignored when comparing images
   - tolerance (optional) `Number` – overrides config [browsers](#browsers).[tolerance](#tolerance) value
   - antialiasingTolerance (optional) `Number` – overrides config [browsers](#browsers).[antialiasingTolerance](#antialiasingTolerance) value
   - allowViewportOverflow (optional) `Boolean` – by default Hermione throws an error if element is outside the viewport bounds. This option disables check that element is outside of the viewport left, top, right or bottom bounds. And in this case if browser option [compositeImage](#compositeimage) set to `false`, then only visible part of the element will be captured. But if [compositeImage](#compositeimage) set to `true` (default), then in the resulting screenshot will appear the whole element with not visible parts outside of the bottom bounds of viewport.
   - captureElementFromTop (optional) `Boolean` - ability to set capture element from the top area or from current position. In the first case viewport will be scrolled to the top of the element. Default value is `true`
   - compositeImage (optional) `Boolean` - overrides config [browsers](#browsers).[compositeImage](#compositeImage) value
   - screenshotDelay (optional) `Number` - overrides config [browsers](#browsers).[screenshotDelay](#screenshotDelay) value
   - selectorToScroll (optional) `String` - DOM-node selector which should be scroll when the captured element does not completely fit on the screen. Useful when you capture the modal (popup). In this case a duplicate of the modal appears on the screenshot. That happens because we scroll the page using `window` selector, which scroll only the background of the modal, and the modal itself remains in place. Works only when `compositeImage` is `true`.

All options inside `assertView` command override the same options in the [browsers](#browsers).[assertViewOpts](#assertViewOpts).

Full example:

```js
it('some test', async ({ browser }) => {
    await browser.url('some/url');
    await browser.assertView(
        'plain', '.form',
        {
            ignoreElements: ['.link'],
            tolerance: 5,
            antialiasingTolerance: 4,
            allowViewportOverflow: true,
            captureElementFromTop: true,
            compositeImage: true,
            screenshotDelay: 10,
            selectorToScroll: '.modal'
        }
    );
});
```

For tests which have been just written using `assertView` command you need to update reference images, so for the first time `hermione` should be run with option `--update-refs` or via command `gui` which is provided by plugin [html-reporter](https://github.com/gemini-testing/html-reporter) (we highly recommend to use `gui` command instead of option `--update-refs`).

### RunStep

Command that allows to add human-readable description for commands in `history`, when it is enabled ([html-reporter](https://github.com/gemini-testing/html-reporter) required) with [saveHistoryMode](#savehistorymode). For example:

```js
it('some test', async ({browser}) => {
    await browser.runStep('some step name', async () => {
        await browser.url('some/url');
        await browser.$('some-selector').click();
    });

    await browser.runStep('other step name', async () => {
        await browser.runStep('some nested step', async () => {
            await browser.$('not-exist').click();
        });
    });

    await browser.runStep('another step', async () => {
        ...
    });
});
```

Will produce the following history, if test fails on 'Can't call click on element with selector "not-exist" because element wasn't found':

- hermione: init browser
- some step name
- other step name
  - some nested step
    - $("not-exist")
    - click()
      - waitForExist

In this example step `some step name` is collapsed, because it is completed successfully.

You can also return values from step:

```js
const parsedPage = await browser.runStep('parse page', async () => {
    ...
    return someData;
});
```

Parameters:

 - stepName (required) `String` – step name
 - stepCb (required) `Function` – step callback

*Note: [html-reporter](https://github.com/gemini-testing/html-reporter) v9.7.7+ provides better history representation.*

## .hermione.conf.js
`hermione` is tuned using a configuration file. By default, it uses `.hermione.conf.js`, but you can use the `--config` option to specify a path to the configuration file.

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
            'tests/desktop/*.hermione.js',
            'tests/common/*.hermione.js'
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

If sets are not specified in the config and paths were not passed from CLI, all files from the `hermione`
directory are launched in all browsers specified in the config.

Running tests using sets:

 ```
 hermione --set desktop
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
`screenshotsDir`          | Directory to save reference images for command `assertView`. Default dir is `hermione/screens` which is relative to `process.cwd()`.
`strictTestsOrder`        | `hermione` will guarantee tests order in [readTests](#readtests) results. `false` by default.
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

* `fullpage` – Hermione will take a screenshot of the entire page from top. Default value.
* `viewport` – Hermione will take a screenshot of the current viewport.

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
Default options used when calling [assertView](https://github.com/gemini-testing/hermione/#assertview), can be overridden by `assertView` options. Default values are:
```javascript
    ignoreElements: [],
    captureElementFromTop: true,
    allowViewportOverflow: false
```

#### screenshotsDir

Directory to save reference images for command `assertView`. Default dir is `hermione/screens` which is relative to `process.cwd()`. The value of this option can also be a function which accepts one argument - an instance of a test within which comand `assertView` is called:

```javascript
    screenshotsDir: (test) => `tests/screenshots/${test.parent.title}`
```

#### strictTestsOrder

`hermione` will guarantee tests order in [readTests](#readtests) results. `false` by default.

#### compositeImage

Allows testing of regions which bottom bounds are outside of a viewport height (default: true). In the resulting screenshot the area which fits the viewport bounds will be joined with the area which is outside of the viewport height.

#### screenshotMode

Image capture mode. There are 3 allowed values for this option:

  * `auto` (default). Mode will be obtained automatically;
  * `fullpage`. Hermione will deal with screenshot of full page;
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
 - [hermione-profiler](https://github.com/gemini-testing/hermione-profiler)

The history is available from such events: `TEST_END`, `TEST_PASS`, `TEST_FAIL` through payload:
```js
// example of plugin code
module.exports = (hermione) => {
    hermione.on(hermione.events.TEST_PASS, async (test) => {
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
Ability to run headless browser in cloud service. Default value is `null`.

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
A context which will be available in tests via method `hermione.ctx`:
```javascript
ctx: {
    foo: 'bar'
}
```

```javascript
it('awesome test', function() {
    console.log(hermione.ctx); // {foo: 'bar'}
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
Hermione runs all tests in subprocesses in order to decrease the main process CPU usage. This options defines the numbers of subprocesses to start for running tests. Default value is `1`.

#### testsPerWorker
The maximum number of tests to be run in one worker before it will be restarted.

#### parallelLimit
By default, `hermione` will run all browsers simultaneously. Sometimes (i.e. when using cloud services, such as SauceLabs) you have to limit the amount of browsers that can be run at the same time. This option effectively limits how many browsers `hermione` will try to run in parallel. Default value is `Infinity`.

#### fileExtensions
Ability to set file extensions, which hermione will search on the file system. Default value is `[.js]`.

### plugins
`Hermione` plugins are commonly used to extend built-in functionality. For example, [html-reporter](https://github.com/gemini-testing/html-reporter) and [hermione-safari-commands](https://github.com/gemini-testing/hermione-safari-commands).

A plugin is a module that exports a single function. The function has two arguments:

* The hermione instance
* Plugin options from the configuration file

Plugins will be loaded before `hermione` runs tests.

It's strongly recommended to name `hermione` plugins with the `hermione-` prefix. This makes searching for user plugins [very simple](https://github.com/search?l=JavaScript&q=hermione-&type=Repositories&utf8=%E2%9C%93).

If a plugin name starts with `hermione-`, then the prefix can be ommited in the configuration file. If two modules with names `hermione-some-module` and `some-module` are specified, the module with the prefix will have higher priority.

For example:
```js
// .hermione.conf.js
// ...
plugins: {
    'my-cool-plugin': {
        param: 'value'
    }
}
// ...

// hermione-my-cool-plugin/index.js
module.exports = function(hermione, opts) {
    hermione.on(hermione.events.RUNNER_START, function(runner) {
        return setUp(hermione.config, opts.param); // config can be mutated
    });

    hermione.on(hermione.events.RUNNER_END, function() {
        return tearDown();
    });
}
```

**Properties of the `hermione` object**

Property name             | Description
------------------------- | -------------
`config`                  | Config that is used in the test runner. Can be mutated.
`events`                  | Events list for subscription.

**Available events which are triggered in the main process**

Event                     | Description
------------------------- | -------------
`INIT`                    | Will be triggered before any job start (`run` or `readTests`). If handler returns a promise then job will start only after the promise will be resolved. Emitted only once no matter how many times job will be performed.
`BEFORE_FILE_READ`        | Will be triggered on test files parsing before reading the file. The handler accepts data object with `file`, `hermione` (helper which will be available in test file) and `testParser` (`TestParserAPI` object) fields.
`AFTER_FILE_READ`         | Will be triggered on test files parsing right after reading the file. The handler accepts data object with `file` and `hermione` (helper which will be available in test file) fields.
`AFTER_TESTS_READ`        | Will be triggered right after tests read via `readTests` or `run` methods with `TestCollection` object.
`RUNNER_START`            | Will be triggered after worker farm initialization and before test execution. If a handler returns a promise, tests will be executed only after the promise is resolved. The handler accepts an instance of a runner as the first argument. You can use this instance to emit and subscribe to any other available events.
`RUNNER_END`              | Will be triggered after test execution and before worker farm ends. If a handler returns a promise, worker farm will be ended only after the promise is resolved. The handler accepts an object with tests execution statistics.
`NEW_WORKER_PROCESS`      | Will be triggered after new subprocess is spawned. The handler accepts a restricted process object with only `send` method.
`SESSION_START`           | Will be triggered after browser session initialization. If a handler returns a promise, tests will be executed only after the promise is resolved. The handler accepts an instance of webdriverIO as the first argument and an object with a browser identifier as the second.
`SESSION_END`             | Will be triggered after the browser session ends. If a handler returns a promise, tests will be executed only after the promise is resolved. The handler accepts an instance of webdriverIO as the first argument and an object with a browser identifier as the second.
`BEGIN`                   | Will be triggered before test execution, but after all the runners are initialized.
`END`                     | Will be triggered just before `RUNNER_END` event. The handler accepts a stats of tests execution.
`SUITE_BEGIN`             | Test suite is about to execute.
`SUITE_END`               | Test suite execution is finished.
`TEST_BEGIN`              | Test is about to execute.
`TEST_END`                | Test execution is finished.
`TEST_PASS`               | Test passed.
`TEST_FAIL`               | Test failed.
`TEST_PENDING`            | Test is skipped.
`RETRY`                   | Test failed but went to retry.
`ERROR`                   | Generic (no tests) errors.
`INFO`                    | Reserved.
`WARNING`                 | Reserved.
`EXIT`                    | Will be triggered when SIGTERM is received (for example, Ctrl + C). The handler can return a promise.

**Available events which are triggered in subprocesses**

Event                     | Description
------------------------- | -------------
`BEFORE_FILE_READ`        | Will be triggered on test files parsing before reading the file. The handler accepts data object with `file`, `hermione` (helper which will be available in test file) and `testParser` (`TestParserAPI` object) fields.
`AFTER_FILE_READ`         | Will be triggered on test files parsing right after reading the file. The handler accepts data object with `file` and `hermione` (helper which will be available in test file) fields.
`AFTER_TESTS_READ`        | Will be triggered right after tests read each time some file is being reading during test run.
`NEW_BROWSER`             | Will be triggered after new browser instance created. The handler accepts an instance of webdriverIO as the first argument and an object with a browser identifier and version as the second.
`UPDATE_REFERENCE`        | Will be triggered after updating reference image.

**REMARK!**

Events which are triggered in the main process and subprocesses can not share information between each other, for example:

```js
module.exports = (hermione) => {
    let flag = false;

    hermione.on(hermione.events.RUNNER_START, () => {
        flag = true;
    });

    hermione.on(hermione.events.NEW_BROWSER, () => {
        // outputs `false`, because `NEW_BROWSER` event was triggered in a subprocess,
        // but `RUNNER_START` was not
        console.log(flag);
    });

    hermione.on(hermione.events.RUNNER_END, () => {
        // outputs `true`
        console.log(flag);
    });
};
```

But you can solve such problem this way:

```js
module.exports = (hermione, opts) => {
    hermione.on(hermione.events.RUNNER_START, () => {
      opts.flag = true;
    });

    hermione.on(hermione.events.NEW_BROWSER, () => {
        // outputs `true`, because properties in a config (variable `opts` is a part of a config)
        // which have raw data types are passed to subprocesses after `RUNNER_START` event
        console.log(opts.flag);
    });
};
```

Besides, you have the ability to intercept events in plugins and translate them to other events:

```js
module.exports = (hermione) => {
    hermione.intercept(hermione.events.TEST_FAIL, ({event, data: test}) => {
        test.skip({reason: 'intercepted failure'});

        return {event: hermione.events.TEST_PENDING, test};
    });

    hermione.on(hermione.events.TEST_FAIL, (test) => {
        // this event handler will never be called
    });

    hermione.on(hermione.evenst.TEST_PENDING, (test) => {
        // this event handler will always be called instead of 'TEST_FAIL' one
    });
};
```

If for some reason interceptor should not translate passed event to another one you can return the same object or some falsey value:

```js
module.exports = (hermione) => {
    hermione.intercept(hermione.events.TEST_FAIL, ({event, data}) => {
        return {event, data};
        // return;
        // return null;
        // return false;
    });

    hermione.on(hermione.events.TEST_FAIL, (test) => {
        // this event handler will be called as usual because interceptor does not change event
    });
};
```

If for some reason interceptor should ignore passed event and do not translate it to any other listeners you can return an empty object:

```js
module.exports = (hermione) => {
    hermione.intercept(hermione.events.TEST_FAIL, ({event, data}) => {
        return {};
    });

    hermione.on(hermione.events.TEST_FAIL, (test) => {
        // this event handler will NEVER be called because interceptor ignores it
    });
};
```

The above feature can be used to delay triggering of some events, for example:

```js
module.exports = (hermione) => {
  const intercepted = [];

  hermione.intercept(hermione.events.TEST_FAIL, ({event, data}) => {
        intercepted.push({event, data});
        return {};
    });

    hermione.on(hermione.events.END, () => {
        intercepted.forEach(({event, data}) => hermione.emit(event, data));
    });
};
```

**Available events which can be intercepted**

Event                     |
------------------------- |
`SUITE_BEGIN`             |
`SUITE_END`               |
`TEST_BEGIN`              |
`TEST_END`                |
`TEST_PASS`               |
`TEST_FAIL`               |
`RETRY`                   |

#### Parallel execution plugin code

Runner has a method `registerWorkers` which register plugin's code for parallel execution in Hermione's worker farm. The method accepts parameters `workerFilepath` (string, absolute path), `exportedMethods` (array of string) and return object which contains async functions with names from `exportedMethods`. File with path `workerFilepath` should export object which contains async functions with names from `exportedMethods`.

*Example*
```js
// plugin code
let workers;

module.exports = (hermione) => {
    hermione.on(hermione.events.RUNNER_START, async (runner) => {
        const workerFilepath = require.resolve('./worker');
        const exportedMethods = ['foo'];
        workers = runner.registerWorkers(workerFilepath, exportedMethods);

        // outputs `FOO_RUNNER_START`
        console.log(await workers.foo('RUNNER_START'));
    });

    hermione.on(hermione.events.RUNNER_END, async () => {
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
* [hermione-safari-commands](https://github.com/gemini-testing/hermione-safari-commands)
* [hermione-headless-chrome](https://github.com/gemini-testing/hermione-headless-chrome)
* ...and many others that you can find in [gemini-testing](https://github.com/search?q=topic%3Ahermione-plugin+org%3Agemini-testing&type=Repositories).

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

## CLI

```
hermione --help
```

shows the following

```
  Usage: hermione [options] [paths...]

  Options:

    -V, --version                output the version number
    -c, --config <path>          path to configuration file
    -b, --browser <browser>      run tests only in specified browser
    -s, --set <set>              run tests only in the specified set
    -r, --require <module>       require a module before running hermione
    --reporter <reporter>        test reporters
    --grep <grep>                run only tests matching the pattern
    --update-refs                update screenshot references or gather them if they do not exist ("assertView" command)
    --inspect [inspect]          nodejs inspector on [=[host:]port]
    --inspect-brk [inspect-brk]  nodejs inspector with break at the start
    -h, --help                   output usage information
```

For example,
```
hermione --config ./config.js --reporter flat --browser firefox --grep name
```

**Note.** All CLI options override config values.

### Reporters

You can choose `flat`, `plain` or `jsonl` reporter by option `--reporter`. Default is `flat`.
Information about test results is displayed to the command line by default. But there is an ability to redirect the output to a file, for example:
```
hermione --reporter '{"type": "jsonl", "path": "./some-path/result.jsonl"}'
```

In that example specified file path and all directories will be created automatically. Moreover you can use few reporters:
```
hermione --reporter '{"type": "jsonl", "path": "./some-path/result.jsonl"}' --reporter flat
```

Information about each report type:
* `flat` – all information about failed and retried tests would be grouped by browsers at the end of the report;
* `plain` – information about fails and retries would be placed after each test;
* `jsonl` - displays detailed information about each test result in [jsonl](https://jsonlines.org/) format.

### Require modules

Using `-r` or `--require` option you can load external modules, which exists in your local machine, before running hermione. This is useful for:

- compilers such as TypeScript via [ts-node](https://www.npmjs.com/package/ts-node) (using `--require ts-node/register`) or Babel via [@babel/register](https://www.npmjs.com/package/@babel/register) (using `--require @babel/register`);
- loaders such as ECMAScript modules via [esm](https://www.npmjs.com/package/esm).

Be sure to update [fileExtensions](#fileExtensions) apropriately, if you are planning to import anything other than `.js`.

### Overriding settings

All options can also be overridden via command-line flags or environment variables. Priorities are the following:

* A command-line option has the highest priority. It overrides the environment variable and config file value.

* An environment variable has second priority. It overrides the config file value.

* A config file value has the lowest priority.

* If there isn't a command-line option, environment variable or config file option specified, the default is used.

To override a config setting with a CLI option, convert the full option path to `--kebab-case`. For example, if you want to run tests against a different base URL, call:

```
hermione path/to/mytest.js --base-url http://example.com
```

To change the number of sessions for Firefox (assuming you have a browser with the `firefox` id in the config):

```
hermione path/to/mytest.js --browsers-firefox-sessions-per-browser 7
```

To override a setting with an environment variable, convert its full path to `snake_case` and add the `hermione_` prefix. The above examples can be rewritten to use environment variables instead of CLI options:

```
hermione_base_url=http://example.com hermione path/to/mytest.js
hermione_browsers_firefox_sessions_per_browser=7 hermione path/to/mytest.js
```

### Environment variables

#### HERMIONE_SKIP_BROWSERS
Skip the browsers specified in the config by passing the browser IDs. Multiple browser IDs should be separated by commas
(spaces after commas are allowed).

For example,
```
HERMIONE_SKIP_BROWSERS=ie10,ie11 hermione
```

#### HERMIONE_SETS
Specify sets to run using the environment variable as an alternative to using the CLI option `--set`.

For example,
```
HERMIONE_SETS=desktop,touch hermione
```

### Debug mode

In order to understand what is going on in the test step by step, there is a debug mode. You can run tests in this mode using these options: --inspect and --inspect-brk. The difference between them is that the second one stops before executing the code.

Example:
```
hermione path/to/mytest.js --inspect
```

**Note**: In the debugging mode, only one worker is started and all tests are performed only in it.
Use this mode with option `sessionsPerBrowser=1` in order to debug tests one at a time.

## Programmatic API

With the API, you can use Hermione programmatically in your scripts or build tools.

```js
const Hermione = require('hermione');

const hermione = new Hermione(config);
```

* **config** (required) `Object|String` – Configuration object or path to the configuration file that will be read relative to `process.cwd`.

### init

```js
hermione.init().done();
```

Initializes hermione instance, load all plugins ans so on.

### run

```js
hermione.run(testPaths, options)
    .then((success) => process.exit(success ? 0 : 1))
    .catch((e) => {
        console.log(e.stack);
        process.exit(1);
    })
    .done();
```

* **testPaths** (optional) `String[]|TestCollection` – Paths to tests relative to `process.cwd`. Also accepts test collection returned by `readTests`.
* **options** (optional) `Object`
  * **reporters** (optional) `String[]` – Test result reporters.
  * **browsers** (optional) `String[]` – Browsers to run tests in.
  * **sets** (optional) `String[]`– Sets to run tests in.
  * **grep** (optional) `RegExp` – Pattern that defines which tests to run.

### addTestToRun

```js
hermione.addTestToRun(test, browser);
```

Adds test to the current run.

* **test** (required) `Test` – Test to run.
* **browserId** (required) `String` – Browser to run test in.

Returns `false` if current run is ended or cancelled, `true` otherwise.

### readTests

```js
hermione.readTests(testPaths, options).done();
```

* **testPaths** (required) `String[]` – Paths to tests relative to `process.cwd`.
* **options** (optional) `Object`:
  * **browsers** (optional) `String[]` – Read tests only for the specified browsers.
  * **silent** (optional) `Boolean` – flag to disable events emitting while reading tests; default is `false`.
  * **ignore** (optional) `String|Glob|Array<String|Glob>` - patterns to exclude paths from the test search.

Returns promise which resolves to the instance of `TestCollection` initialized by parsed tests

### isFailed

```js
hermione.isFailed();
```

Returns `true` or `false` depending on whether there has been an error or a test fail while running tests; can be useful in plugins to
determine current Hermione status.

### isWorker

```js
hermione.isWorker();
```

Returns `true` or `false` depending on whether you call the method in one of the workers or in the master process; can be useful in plugins to share some code execution between the master process and its workers, for example:


```js
// implementation of some plugin
module.exports = (hermione) => {
    if (hermione.isWorker()) {
        // do some stuff only in workers
    } else {
        // do some stuff only in the master process
    }
};
```

### halt
```js
hermione.halt(error, [timeout=60000ms]);
```

Method for abnormal termination of the test run in case of a terminal error. If process fails to gracefully shutdown in `timeout` milliseconds, it would be forcibly terminated (unless `timeout` is explicitly set to `0`).

### Test Collection

TestCollection object is returned by `hermione.readTests` method.

TestCollection API:

* `getBrowsers()` — returns list of browsers for which there are tests in collection.

* `mapTests(browserId, (test, browserId) => ...)` - maps over tests for passed browser. If first argument (`browserId`) is omitted then method will map over tests for all browsers.

* `sortTests(browserId, (currentTest, nextTest) => ...)` - sorts over tests for passed browser. If first argument (`browserId`) is omitted then method will sort over tests for all browsers.

* `eachTest(browserId, (test, browserId) => ...)` - iterates over tests for passed browser. If first argument (`browserId`) is omitted then method will iterate over tests for all browsers.

* `eachTestByVersion(browserId, (test, browserId, version) => ...)` - iterates over tests and over browser versions for passed browser. Implicitly sets browser version for each test in `browserVersion` property.

* `disableAll([browserId])` - disables all tests. Disables tests for specific browser if `browserId` passed. Returns current test collection instance.

* `enableAll([browserId])` - enables all previously disabled tests. Enables tests for specific browser if `browserId` passed. Returns current test collection instance.

* `disableTest(fullTitle, [browserId])` - disables test with passed full title. Disables test only in specific browser if `browserId` passed. Returns current test collection instance.

* `enableTest(fullTitle, [browserId])` - enables test with passed full title. Enables test only in specific browser if `browserId` passed. Returns current test collection instance.

* `getRootSuite(browserId)` - returns root suite for passed browser. Returns `undefined` if there are no tests in collection for passed browser.

* `eachRootSuite((root, browserId) => ...)` - iterates over all root suites in collection which have some tests.

### Test Parser API

`TestParserAPI` object is emitted on `BEFORE_FILE_READ` event. It provides the ability to customize test parsing process.

#### setController(name, methods)

Adds controller to `hermione` object in test files.

* `name` - controller name
* `methods` - an object with names as keys and callbacks as values describing controller methods. Each callback will be called on corresponding test or suite.

Example:
```js
// in plugin
hermione.on(hermione.events.BEFORE_FILE_READ, ({file, testParser}) => {
    testParser.setController('logger', {
        log: function(prefix) {
            console.log(`${prefix}: Just parsed ${this.fullTitle()} from file ${file}`);
        }
    });
});

// in test file
describe('foo', () => {
    hermione.logger.log('some-prefix');
    it('bar', function() {
        // ...
    });
});
```

**Note**: controller will be removed as soon as current file will be parsed
