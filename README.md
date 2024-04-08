# Testplane (ex-Hermione)

Testplane is a utility for integration testing of web pages using [WebdriverIO](https://webdriver.io/docs/api) and [Mocha](https://mochajs.org).

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->

- [Why you should choose Testplane](#why-you-should-choose-testplane)
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
  - [Using npm init Testplane (a quick way)](#using-npm-init-testplane-a-quick-way)
  - [Configuring .testplane.conf.js by yourself (a slow way)](#configuring-testplaneconfjs-by-yourself-a-slow-way)
    - [Chrome Devtools Protocol](#chrome-devtools-protocol)
    - [Webdriver protocol](#webdriver-protocol)
- [Commands API](#commands-api)
  - [Browser commands](#browser-commands)
    - [clearSession](#clearsession)
  - [Element commands](#element-commands)
    - [moveCursorTo](#movecursorto)
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
  - [OpenAndWait](#openandwait)
- [Typescript usage](#typescript-usage)
  - [testplane.ctx typings](#testplanectx-typings)
- [.testplane.conf.js](#testplaneconfjs)
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
  - [Debug mode](#debug-mode)
  - [REPL mode](#repl-mode)
    - [switchToRepl](#switchtorepl)
    - [Test development in runtime](#test-development-in-runtime)
      - [How to set up using VSCode](#how-to-set-up-using-vscode)
      - [How to set up using Webstorm](#how-to-set-up-using-webstorm)
  - [Environment variables](#environment-variables)
    - [TESTPLANE_SKIP_BROWSERS](#testplane_skip_browsers)
    - [TESTPLANE_SETS](#testplane_sets)
- [Programmatic API](#programmatic-api)
  - [config](#config)
  - [events](#events)
  - [errors](#errors)
    - [CoreError](#coreerror)
    - [CancelledError](#cancellederror)
    - [ClientBridgeError](#clientbridgeerror)
    - [HeightViewportError](#heightviewporterror)
    - [OffsetViewportError](#offsetviewporterror)
    - [AssertViewError](#assertviewerror)
    - [ImageDiffError](#imagedifferror)
    - [NoRefImageError](#norefimageerror)
  - [intercept](#intercept)
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

## Why you should choose Testplane
Testplane provides several features that `WebdriverIO` doesn't, and makes the testing process easier.

### Easy to use
If you are familiar with [WebdriverIO](http://webdriver.io/) and [Mocha](https://mochajs.org), you can start writing and running tests in 5 minutes! You need to install Testplane via npm and add a tiny config to your project. For details, see the [Quick start](#quick-start) section.

### Runs tests in parallel
When tests are run one by one, it takes a lot of time. Testplane can run tests in parallel sessions in different browsers out of the box.

### Runs tests in subprocesses
Running of too many tests in parallel can lead to the overloading of the main process CPU usage which causes degradation in test passing time, so Testplane runs all tests in subprocesses in order to solve this problem.

### Extensible
`WebdriverIO` provides built-in commands for browser and page manipulation. Often projects need to store some common code and reuse it throughout all tests, so the developer needs to create some helpers and include them in the tests.

With Testplane this is very simple and straightforward. You can add any number of custom commands in the Testplane config and use them as `browser.myCustomCommand` in tests.

Moreover, Testplane provides plugins that work like hooks. They allow the developer to prepare the testing environment and react properly to test execution events.

### Built-in assert library
when writing integration tests, we need to check for various conditions, such as that a button element has certain attributes. So Testplane provides global `expect` variable that gives you access to a number of `matchers` that let you validate different things on the browser, an element or mock object. More about using `expect` and its API you can find [here](https://webdriver.io/docs/api/expect-webdriverio/).

### Retries failed tests
Integration tests use a dynamic environment with a lot of dependencies, where any of them could be unstable from time to time. As a result, integration tests turn red randomly, which makes them imprecise. This spoils the entire testing process.

To prevent incidental fails, Testplane retries a failed test before marking it as failed. This makes it possible to get rid of a majority of incidental fails. The number of retries can be specified for all browsers or for a specific browser.

:warning: Testplane reruns tests in a new browser session to exclude situations when the browser environment is the cause of the failure.

### Executes separate tests
Sometimes you only need to run specific tests, not all the tests in a set. Testplane makes this possible. You can specify the path to the test file
```
testplane tests/func/mytest.js
```

or filter describes by using the `--grep` option

```
testplane --grep login
```

or simply use the `mocha` `only()` API in the test

```js
describe.only('user login', function() {...});
```

### Skips tests in specific browsers
Sometimes you need to skip a test just in a specific browser, not in all browsers. For example, you don't need to run
some test in ~~ugly~~ IE browsers. In Testplane you can do this with [Testplane helper](#skip). For example,
you can skip some tests in a specific browser
```js
describe('feature', function() {
    testplane.skip.in('ie8', 'it cannot work in this browser');
    it('nowaday functionality', function() {...});
});
```

or run tests in just one browser
```js
describe('feature', function() {
    // will be skipped in all browsers except Chrome
    testplane.skip.notIn('chrome', 'it should work only in Chrome');
    it('specific functionality', function() {...});
});
```

In these cases you will see messages in reports with the reason for skipping.

To skip a suite or test silently (without any messages in reports), you can pass the third argument with the silent flag:
```js
testplane.skip.in('ie8', 'skipReason', {silent: true});
// or
testplane.skip.notIn('chrome', 'skipReason', {silent: true});
```

Or you can use another Testplane helper, [only](#only), which is silent by default:
```js
testplane.only.in('chrome');
// or
testplane.only.notIn('ie8');
```

`testplane.only.in` will run tests only in the specified browsers and skip the rest silently.

`testplane.only.notIn` will run tests in all browsers except the specified ones.

### Override browser configuration for test
Testplane allows you to override a browser configuration for each test or a whole suite.
Each method of `testplane.browser(<browserName>)` provide chaining.

#### `version(<browserVersion>)`

```js
// change the browser version for all chindren
testplane.browser('chrome').version('70.3');
describe('suite', function() {
    // ...
});
```

```js
// change the browser version for a specific test
testplane.browser('chrome').version('70.3');
it('test', function() {...});
```

```js
testplane.browser('chrome').version('70.3');
describe('suite', function() {
    it('test 1', function() {...});

    // this call will override the version only for test below
    testplane.browser('chrome').version('70.1');
    it('test 2', function() {...});
});
```

### Offers flexible test configuration
Testplane lets you configure running some set of tests in specific browsers. For example,
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
All work with the grid client is encapsulated in Testplane. Forget about `client.init` and `client.end` in your tests ;)

### Fairly waits for screen rotate
Request `/session/:sessionId/orientation` is not a part of the official Webdriver specification, so commands `orientation` and `setOrientation` which are provided by client `webdriverio` from the box do not guarantee screen rotate before the next command will start to execute, but Testplane solves this problem.

## Prerequisites
All you need are browsers that Testplane could use for testing. To do this you need to install some browsers, such as [chrome](https://www.google.com/chrome/) (to automate this process you can use the [@testplane/headless-chrome](https://github.com/gemini-testing/testplane-headless-chrome) plugin).

Next, you have two ways to configure Testplane to work with browsers:

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

Now you have two ways to configure project.

### Using npm init Testplane (a quick way)

You just need to run the cli command from [create-testplane](https://github.com/gemini-testing/create-testplane) tool and answer a few questions:
```
npm init testplane YOUR_PROJECT_PATH
```

To skip all questions just add the option `-y` at the end.

### Configuring .testplane.conf.js by yourself (a slow way)

Create Testplane config file with name `.testplane.conf.js` in the project root. There are two configuration options depending on the method selected in the `prerequisites` section.

#### Chrome Devtools Protocol

```javascript
module.exports = {
    sets: {
        desktop: {
            files: 'tests/desktop/**/*.testplane.js'
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

#### Webdriver protocol

```javascript
module.exports = {
    gridUrl: 'http://localhost:4444/wd/hub',

    sets: {
        desktop: {
            files: 'tests/desktop/*.testplane.js'
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

Write your first test in `tests/desktop/github.testplane.js` file.
```javascript
describe('github', function() {
    it('should check repository name', async ({ browser }) => {
        await browser.url('https://github.com/gemini-testing/testplane');

        await expect(browser.$('#readme h1')).toHaveText('Testplane (ex-Hermione)');
    });
});
```

Finally, run tests (be sure that you have already run `selenium-standalone start` command in next tab).
```
node_modules/.bin/testplane
```

## Commands API

Since Testplane is based on [WebdriverIO v8](https://webdriver.io/docs/api/), all the commands provided by WebdriverIO are available in it. But Testplane also has her own commands.

### Browser commands

#### clearSession

Browser command that clears session state (deletes cookies, clears local and session storages). For example:

```js
it('test', async ({ browser }) => {
    await browser.url('https://github.com/gemini-testing/testplane');

    (await browser.getCookies()).length; // 5
    await browser.execute(() => localStorage.length); // 2
    await browser.execute(() => sessionStorage.length); // 1

    await browser.clearSession();

    (await browser.getCookies()).length; // 0
    await browser.execute(() => localStorage.length); // 0
    await browser.execute(() => sessionStorage.length); // 0
});
```

### Element commands

#### moveCursorTo

> This command is temporary and will be removed in the next major (`testplane@1`). Differs from the standard [moveTo](https://webdriver.io/docs/api/element/moveTo/) in that it moves the cursor relative to the top-left corner of the element (like it was in `hermione@7`).

Move the mouse by an offset of the specified element. If offset is not specified then mouse will be moved to the top-left corder of the element.

Usage:

```typescript
await browser.$(selector).moveCursorTo({ xOffset, yOffset });
```

Available parameters:

* **xOffset** (optional) `Number` – X offset to move to, relative to the top-left corner of the element;
* **yOffset** (optional) `Number` – Y offset to move to, relative to the top-left corner of the element.

## Tests API

### Arguments
Testplane calls test and hook callback with one argument. This argument is an object with the next properties:
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

`before` and `after` hooks **are forbidden** in Testplane, you should use `beforeEach` and `afterEach` hooks instead. This feature was implemented in order to ensure better stability while running tests and make them independent of each other.

### Skip
This feature allows you to ignore the specified suite or test in any browser, with an additional comment.
You can do this by using the global `testplane.skip` helper. It supports the following methods:

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
    testplane.skip.in('chrome', "It shouldn't work this way in Chrome");
    it('should work this way', function() {
        return runTestThisWay();
    });

    it('should work that way', function() {
        return runTestThatWay();
    });

    testplane.skip.in(['chrome', 'firefox', /ie\d*/], 'Unstable test, see ticket TEST-487');
    it('should have done some tricky things', function() {
        return runTrickyTest();
    });
});
```

In this case, the behaviour `it should work this way` will be skipped only in `chrome` browser, but will be run in other browsers. `It should work that way` will not be ignored. So only the nearest test will be skipped. If you need to skip all tests within a suite, you can apply the `skip` helper to a `describe` so all tests within this suite will be skipped with the same comment.
```js
testplane.skip.in('chrome', 'skip comment');
describe('some feature', function() {
    it(...);
    it(...);
});
```

You can also use the `.notIn` method to invert matching. For example,
```js
// ...
testplane.skip.notIn('chrome', 'some comment');
it('should work this way', function() {
    return doSomething();
});
// ...
```

In this case, the test will be skipped in all browsers except `chrome`.

All of these methods are chainable, so you can skip a test in several browsers with different comments. For example,
```js
// ...
testplane.skip
    .in('chrome', 'some comment')
    .notIn('ie9', 'another comment');
it('test1', function() {
    return doSomething();
});
// ...
```

If you need to skip a test in all browsers without a comment, you can use [mocha `.skip` method](http://mochajs.org/#inclusive-tests) instead of `testplane.skip.in(/.*/);`. The result will be the same.

### Only
This feature allows you to ignore the specified suite or test in any browser silently (without any messages in reports).
You can do this by using the global `testplane.only` helper. It supports two methods:

- `.in` — The `testplane.skip.notIn` method with the silent flag,
- `.notIn` — The `testplane.skip.in` with the silent flag.

These methods take the following arguments:

 - browser {String|RegExp|Array<String|RegExp>} — A matcher for browser(s) to skip.

For example:
```js
// ...
testplane.only.in('chrome');

it('should work this way', function() {
    return doSomething();
});
```
The test will be skipped all browsers **silently** except in `chrome`.

```js
testplane.only.notIn('ie9');
it('should work another way', function() {
    return doSomething();
});
```
The test will be processed in all browsers and **silently** skipped in `ie9`.

### Config overriding
You can override some config settings for specific test, suite or hook via `testplane.config.*` notation.

#### testTimeout
Overrides [testTimeout](#testtimeout-1) config setting. Can be set for tests and suites.

```js
testplane.config.testTimeout(100500);
it('some test', function() {
    return doSomething();
});
```

### WebdriverIO extensions
Testplane adds some useful methods and properties to the `webdriverio` session after its initialization.

#### Sharable meta info
Implemented via two commands:

* setMeta(key, value)
* getMeta([key])

These methods allow you to store some information between webdriver calls and it can then be used in custom commands, for instance. This meta information will be shown in the [html-reporter](https://github.com/gemini-testing/html-reporter).

**Note**: Testplane saves the last URL opened in the browser in meta info.

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
   - ignoreDiffPixelCount (optional) `Number | string` - the maximum amount of different pixels to still consider screenshots "the same". For example, when set to 5, it means that if there are 5 or fewer different pixels between two screenshots, they will still be considered the same. Alternatively, you can also define the maximum difference as a percentage (for example, 3%) of the image size. This option is useful when you encounter a few pixels difference that cannot be eliminated using the tolerance and antialiasingTolerance settings. The default value is 0.
   - allowViewportOverflow (optional) `Boolean` – by default Testplane throws an error if element is outside the viewport bounds. This option disables check that element is outside of the viewport left, top, right or bottom bounds. And in this case if browser option [compositeImage](#compositeimage) set to `false`, then only visible part of the element will be captured. But if [compositeImage](#compositeimage) set to `true` (default), then in the resulting screenshot will appear the whole element with not visible parts outside of the bottom bounds of viewport.
   - captureElementFromTop (optional) `Boolean` - ability to set capture element from the top area or from current position. In the first case viewport will be scrolled to the top of the element. Default value is `true`
   - compositeImage (optional) `Boolean` - overrides config [browsers](#browsers).[compositeImage](#compositeImage) value
   - screenshotDelay (optional) `Number` - overrides config [browsers](#browsers).[screenshotDelay](#screenshotDelay) value
   - selectorToScroll (optional) `String` - DOM-node selector which should be scroll when the captured element does not completely fit on the screen. Useful when you capture the modal (popup). In this case a duplicate of the modal appears on the screenshot. That happens because we scroll the page using `window` selector, which scroll only the background of the modal, and the modal itself remains in place. Works only when `compositeImage` is `true`.
   - disableAnimation (optional): `Boolean` - ability to disable animations and transitions while capturing a screenshot.

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

For tests which have been just written using `assertView` command you need to update reference images, so for the first time `testplane` should be run with option `--update-refs` or via command `gui` which is provided by plugin [html-reporter](https://github.com/gemini-testing/html-reporter) (we highly recommend to use `gui` command instead of option `--update-refs`).

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

- testplane: init browser
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

### OpenAndWait

Command that allows to open page and wait until it loads (by combination of the specified factors). For example:

```js
it('some test', async ({browser}) => {
    await browser.openAndWait('some/url', {
        selector: ['.some', '.selector'],
        predicate: () => document.isReady,
        ignoreNetworkErrorsPatterns: ['https://mc.yandex.ru'],
        waitNetworkIdle: true,
        waitNetworkIdleTimeout: 500,
        failOnNetworkError: true,
        timeout: 20000,
    });
});
```

In this example, page will be considered as loaded, if elements with selectors `.some` and `.selector` exists, `document.isReady` is `true`, it has been 500 ms since the last network request succeeded, and there were no errors, while trying to load images, fonts and stylesheets.

Parameters:

 - url (required) `String` – page url
 - waitOpts (optional) `Object`:
   - selector (optional) `String|String[]` – Selector(s) to element(s), which should exist on the page.
   - predicate (optional) `() => Promise<bool> | bool` – Predicate, which should return `true` if page is loaded. Predicate is being executed in the browser context: [waitUntil](https://webdriver.io/docs/api/element/waitUntil).
   - waitNetworkIdle (optional) `Boolean` – Waits until all network requests are done. `true` by default. Only works in chrome browser or when using [Chrome Devtools Protocol](#chrome-devtools-protocol).
   - waitNetworkIdleTimeout (optional) `Number` - Time (ms) after all network requests are resolved to consider network idle. 500 by default.
   - failOnNetworkError (optional) `Boolean` – If `true`, throws an error when network requests are failed. `true` by default. Only works in chrome browser or when using [Chrome Devtools Protocol](#chrome-devtools-protocol).
   - shouldThrowError (optional) `(match) => Boolean` - Predicate, which should return `true` on [Match](https://webdriver.io/docs/api/mock#match), if network error is considered critical for page load. By default, throws an error on image, stylesheet and font load error.
   - ignoreNetworkErrorsPatterns (optional) `Array<String | RegExp>` - Array of url patterns to ignore network requests errors. Has a priority over `shouldThrowError`
   - timeout (optional) `Number` - Page load timeout. [pageLoadTimeout](#pageloadtimeout) by default. Throws an error, if selectors are still not exist after timeout, or predicate is still resolving false.

## Typescript usage

To write Testplane tests on typescript, you would need to install `ts-node`:

```bash
npm i -D ts-node
```

And include Testplane types in your `tsconfig.json` file:

```js
// tsconfig.json
{
    // other tsconfig options
    "compilerOptions": {
        // other compiler options
        "types": [
            // other types
            "testplane",
        ]
    }
}
```

Now you will be able to write Testplane tests using typescript.

### testplane.ctx typings

If you want to extend testplane.ctx typings, you could use module augmentation:

```ts
import type { TestplaneCtx } from "testplane";

declare module "testplane" {
    interface TestplaneCtx {
        someVariable: string;
    }
}
```

Now `testplane.ctx` will have `someVariable` typings

## .testplane.conf.js
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
Ability to set file extensions, which Testplane will search on the file system. Default value is `[.js]`.

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

**Available events which are triggered in the main process**

Event                     | Description
------------------------- | -------------
`INIT`                    | Will be triggered before any job start (`run` or `readTests`). If handler returns a promise then job will start only after the promise will be resolved. Emitted only once no matter how many times job will be performed.
`BEFORE_FILE_READ`        | Will be triggered on test files parsing before reading the file. The handler accepts data object with `file`, `testplane` (helper which will be available in test file) and `testParser` (`TestParserAPI` object) fields.
`AFTER_FILE_READ`         | Will be triggered on test files parsing right after reading the file. The handler accepts data object with `file` and `testplane` (helper which will be available in test file) fields.
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
`BEFORE_FILE_READ`        | Will be triggered on test files parsing before reading the file. The handler accepts data object with `file`, `testplane` (helper which will be available in test file) and `testParser` (`TestParserAPI` object) fields.
`AFTER_FILE_READ`         | Will be triggered on test files parsing right after reading the file. The handler accepts data object with `file` and `testplane` (helper which will be available in test file) fields.
`AFTER_TESTS_READ`        | Will be triggered right after tests read each time some file is being reading during test run.
`NEW_BROWSER`             | Will be triggered after new browser instance created. The handler accepts an instance of webdriverIO as the first argument and an object with a browser identifier and version as the second.
`UPDATE_REFERENCE`        | Will be triggered after updating reference image.

**REMARK!**

Events which are triggered in the main process and subprocesses can not share information between each other, for example:

```js
module.exports = (testplane) => {
    let flag = false;

    testplane.on(testplane.events.RUNNER_START, () => {
        flag = true;
    });

    testplane.on(testplane.events.NEW_BROWSER, () => {
        // outputs `false`, because `NEW_BROWSER` event was triggered in a subprocess,
        // but `RUNNER_START` was not
        console.log(flag);
    });

    testplane.on(testplane.events.RUNNER_END, () => {
        // outputs `true`
        console.log(flag);
    });
};
```

But you can solve such problem this way:

```js
module.exports = (testplane, opts) => {
    testplane.on(testplane.events.RUNNER_START, () => {
      opts.flag = true;
    });

    testplane.on(testplane.events.NEW_BROWSER, () => {
        // outputs `true`, because properties in a config (variable `opts` is a part of a config)
        // which have raw data types are passed to subprocesses after `RUNNER_START` event
        console.log(opts.flag);
    });
};
```

Besides, you have the ability to intercept events in plugins and translate them to other events:

```js
module.exports = (testplane) => {
    testplane.intercept(testplane.events.TEST_FAIL, ({event, data: test}) => {
        test.skip({reason: 'intercepted failure'});

        return {event: testplane.events.TEST_PENDING, test};
    });

    testplane.on(testplane.events.TEST_FAIL, (test) => {
        // this event handler will never be called
    });

    testplane.on(testplane.evenst.TEST_PENDING, (test) => {
        // this event handler will always be called instead of 'TEST_FAIL' one
    });
};
```

If for some reason interceptor should not translate passed event to another one you can return the same object or some falsey value:

```js
module.exports = (testplane) => {
    testplane.intercept(testplane.events.TEST_FAIL, ({event, data}) => {
        return {event, data};
        // return;
        // return null;
        // return false;
    });

    testplane.on(testplane.events.TEST_FAIL, (test) => {
        // this event handler will be called as usual because interceptor does not change event
    });
};
```

If for some reason interceptor should ignore passed event and do not translate it to any other listeners you can return an empty object:

```js
module.exports = (testplane) => {
    testplane.intercept(testplane.events.TEST_FAIL, ({event, data}) => {
        return {};
    });

    testplane.on(testplane.events.TEST_FAIL, (test) => {
        // this event handler will NEVER be called because interceptor ignores it
    });
};
```

The above feature can be used to delay triggering of some events, for example:

```js
module.exports = (testplane) => {
  const intercepted = [];

  testplane.intercept(testplane.events.TEST_FAIL, ({event, data}) => {
        intercepted.push({event, data});
        return {};
    });

    testplane.on(testplane.events.END, () => {
        intercepted.forEach(({event, data}) => testplane.emit(event, data));
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

## CLI

```
testplane --help
```

shows the following

```
  Usage: testplane [options] [paths...]

  Options:

    -V, --version                output the version number
    -c, --config <path>          path to configuration file
    -b, --browser <browser>      run tests only in specified browser
    -s, --set <set>              run tests only in the specified set
    -r, --require <module>       require a module before running `testplane`
    --reporter <reporter>        test reporters
    --grep <grep>                run only tests matching the pattern
    --update-refs                update screenshot references or gather them if they do not exist ("assertView" command)
    --inspect [inspect]          nodejs inspector on [=[host:]port]
    --inspect-brk [inspect-brk]  nodejs inspector with break at the start
    --repl [type]                run one test, call `browser.switchToRepl` in test code to open repl interface (default: false)
    --repl-before-test [type]    open repl interface before test run (default: false)
    --repl-on-fail [type]        open repl interface on test fail only (default: false)
    -h, --help                   output usage information
```

For example,
```
testplane --config ./config.js --reporter flat --browser firefox --grep name
```

**Note.** All CLI options override config values.

### Reporters

You can choose `flat`, `plain` or `jsonl` reporter by option `--reporter`. Default is `flat`.
Information about test results is displayed to the command line by default. But there is an ability to redirect the output to a file, for example:
```
testplane --reporter '{"type": "jsonl", "path": "./some-path/result.jsonl"}'
```

In that example specified file path and all directories will be created automatically. Moreover you can use few reporters:
```
testplane --reporter '{"type": "jsonl", "path": "./some-path/result.jsonl"}' --reporter flat
```

Information about each report type:
* `flat` – all information about failed and retried tests would be grouped by browsers at the end of the report;
* `plain` – information about fails and retries would be placed after each test;
* `jsonl` - displays detailed information about each test result in [jsonl](https://jsonlines.org/) format.

### Require modules

Using `-r` or `--require` option you can load external modules, which exists in your local machine, before running `testplane`. This is useful for:

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
testplane path/to/mytest.js --base-url http://example.com
```

To change the number of sessions for Firefox (assuming you have a browser with the `firefox` id in the config):

```
testplane path/to/mytest.js --browsers-firefox-sessions-per-browser 7
```

To override a setting with an environment variable, convert its full path to `snake_case` and add the `testplane_` prefix. The above examples can be rewritten to use environment variables instead of CLI options:

```
testplane_base_url=http://example.com testplane path/to/mytest.js
testplane_browsers_firefox_sessions_per_browser=7 testplane path/to/mytest.js
```

### Debug mode

In order to understand what is going on in the test step by step, there is a debug mode. You can run tests in this mode using these options: `--inspect` and `--inspect-brk`. The difference between them is that the second one stops before executing the code.

Example:
```
testplane path/to/mytest.js --inspect
```

**Note**: In the debugging mode, only one worker is started and all tests are performed only in it.
Use this mode with option `sessionsPerBrowser=1` in order to debug tests one at a time.

### REPL mode

Testplane provides a [REPL](https://en.wikipedia.org/wiki/Read–eval–print_loop) implementation that helps you not only to learn the framework API, but also to debug and inspect your tests. In this mode, there is no timeout for the duration of the test (it means that there will be enough time to debug the test). It can be used by specifying the CLI options:

- `--repl` - in this mode, only one test in one browser should be run, otherwise an error is thrown. REPL interface does not start automatically, so you need to call [switchToRepl](#switchtorepl) command in the test code. Disabled by default;
- `--repl-before-test` - the same as `--repl` option except that REPL interface opens automatically before run test. Disabled by default;
- `--repl-on-fail` - the same as `--repl` option except that REPL interface opens automatically on test fail. Disabled by default.

#### switchToRepl

Browser command that stops the test execution and opens REPL interface in order to communicate with browser. For example:

```js
it('foo', async ({browser}) => {
    console.log('before open repl');

    await browser.switchToRepl();

    console.log('after open repl');
});
```

And run it using the command:

```bash
npx testplane --repl --grep "foo" -b "chrome"
```

In this case, we are running only one test in one browser (or you can use `testplane.only.in('chrome')` before `it` + `it.only`).
When executing the test, the text `before open repl` will be displayed in the console first, then test execution stops, REPL interface is opened and waits your commands. So we can write some command in the terminal:

```js
await browser.getUrl();
// about:blank
```

In the case when you need to execute a block of code, for example:

```js
for (const item of [...Array(3).keys]) {
    await browser.$(`.selector_${item}`).isDisplayed();
}
```

You need to switch to editor mode by running the `.editor` command in REPL and insert the desired a block of code. Then execute it by pressing `Ctrl+D`.
It is worth considering that some of code can be executed without editor mode:
- one-line code like `await browser.getUrl().then(console.log)`;
- few lines of code without using block scope or chaining, for example:
    ```js
    await browser.url('http://localhost:3000');
    await browser.getUrl();
    // http://localhost:3000
    ```

After user closes the server, the test will continue to run (text `after open repl` will be displayed in the console and browser will close).

Another command features:
- all `const` and `let` declarations called in REPL mode are modified to `var` in runtime. This is done in order to be able to redefine created variables;
- before switching to the REPL mode `process.cwd` is replaced with the path to the folder of the executed test. After exiting from the REPL mode `process.cwd` is restored. This feature allows you to import modules relative to the test correctly;
- ability to pass the context to the REPL interface. For example:

    ```js
    it('foo', async ({browser}) => {
        const foo = 1;

        await browser.switchToRepl({foo});
    });
    ```

    And now `foo` variable is available in REPL:

    ```bash
    console.log("foo:", foo);
    // foo: 1
    ```

#### Test development in runtime

For quick test development without restarting the test or the browser, you can run the test in the terminal of IDE with enabled REPL mode:

```bash
npx testplane --repl-before-test --grep "foo" -b "chrome"
```

After that, you need to configure the hotkey in IDE to run the selected one or more lines of code in the terminal. As a result, each new written line can be sent to the terminal using a hotkey and due to this, you can write a test much faster.

Also, during the test development process, it may be necessary to execute commands in a clean environment (without side effects from already executed commands). You can achieve this with the following commands:
- [clearSession](#clearsession) - clears session state (deletes cookies, clears local and session storages). In some cases, the environment may contain side effects from already executed commands;
- [reloadSession](https://webdriver.io/docs/api/browser/reloadSession/) - creates a new session with a completely clean environment.

##### How to set up using VSCode

1. Open `Code` -> `Settings...` -> `Keyboard Shortcuts` and print `run selected text` to search input. After that, you can specify the desired key combination
2. Run `testplane` in repl mode (examples were above)
3. Select one or mode lines of code and press created hotkey

##### How to set up using Webstorm

Ability to run selected text in terminal will be available after this [issue](https://youtrack.jetbrains.com/issue/WEB-49916/Debug-JS-file-selection) will be resolved.

### Environment variables

#### TESTPLANE_SKIP_BROWSERS
Skip the browsers specified in the config by passing the browser IDs. Multiple browser IDs should be separated by commas
(spaces after commas are allowed).

For example,
```
TESTPLANE_SKIP_BROWSERS=ie10,ie11 testplane
```

#### TESTPLANE_SETS
Specify sets to run using the environment variable as an alternative to using the CLI option `--set`.

For example,
```
TESTPLANE_SETS=desktop,touch testplane
```

## Programmatic API

With the API, you can use Testplane programmatically in your scripts or build tools. To do this, you must require `testplane` module and create instance:

```js
const Testplane = require('testplane');
const testplane = new Testplane(config);
```

* **config** (required) `Object|String` – Configuration object or path to the configuration file that will be read relative to `process.cwd`.

Next, you will have access to the following parameters and methods:

Name           | Description
-------------- | -------------
`config`       | Returns parsed Testplane config.
`events`       | Returns Testplane events on which you can subscribe to.
`errors`       | Errors which Testplane may return.
`intercept`    | Method to intercept Testplane's events.
`run`          | Starts running tests. By default run all tests from the config. Can also run only the specified tests.
`addTestToRun` | Adds test to the current run.
`readTests`    | Starts reading tests. By default read all tests from the config. Can also read only the specified tests.
`isFailed`     | Returns `true` or `false` depending on whether there has been an error or a test fail while running tests.
`isWorker`     | Returns `true` or `false` depending on whether you call the method in one of the workers or in the master process.
`halt`         | Abnormal termination of the test run in case of a terminal error.

### config

Returns parsed Testplane config. Useful when you need to read some field from the config.

```js
// create testplane instance
console.log('plugins:', testplane.config.plugins);
```

### events

Returns Testplane events on which you can subscribe to. Useful when you need to subscribe to a specific event.

```js
// create testplane instance
testplane.on(testplane.events.INIT, async () => {
    console.info('INIT event is being processed...');
});
```

### errors

Testplane may return errors of the following type:

- [CoreError](#coreerror)
- [CancelledError](#cancellederror)
- [ClientBridgeError](#clientbridgeerror)
- [HeightViewportError](#heightviewporterror)
- [OffsetViewportError](#offsetviewporterror)
- [AssertViewError](#assertviewerror)
- [ImageDiffError](#imagedifferror)
- [NoRefImageError](#norefimageerror)

#### CoreError

A `CoreError` is returned if the browser fails to calibrate a blank page (about:blank). The error contains the following message:

```
Could not calibrate. This could be due to calibration page has failed to open properly
```

#### CancelledError

The `CanceledEror` error is returned if the [halt](#halt) command terminates abnormally. The error contains the following message:

```
Browser request was cancelled
```

#### ClientBridgeError

A `ClientBridgeError` is returned when JavaScript injection on the client (browser) side fails. Testplane injects the code using the [execute](https://webdriver.io/docs/api/browser/execute/) WebDriverIO command. The error contains the following message:

```
Unable to inject client script
```

#### HeightViewportError

The `HeightViewportError` is returned when trying to take a screenshot of an area whose bottom border does not fit into the viewport area. The error contains the following message:

```
Can not capture the specified region of the viewport.
The region bottom bound is outside of the viewport height.
Alternatively, you can test such cases by setting "true" value to option "compositeImage" in the config file
or setting "false" to "compositeImage" and "true" to option "allowViewportOverflow" in "assertView" command.
Element position: <cropArea.left>, <cropArea.top>; size: <cropArea.width>, <cropArea.height>.
Viewport size: <viewport.width>, <viewport.height>.
```

In this case, the message prompts the Testplane user what settings need to be set in the Testplane config in order to be able to take a screenshot for the specified area.

#### OffsetViewportError

An `OffsetViewportError` is returned when attempting to take a screenshot of an area whose borders on the left, right, or top extend beyond the viewport. The error contains the following message:

```
Can not capture the specified region of the viewport.
Position of the region is outside of the viewport left, top or right bounds.
Check that elements:
- does not overflow the document
- does not overflow browser viewport
Alternatively, you can increase browser window size using
"setWindowSize" or "windowSize" option in the config file.
But if viewport overflow is expected behavior then you can use
option "allowViewportOverflow" in "assertView" command.
```

In this case, the message prompts the Testplane user what settings need to be set in the Testplane config in order to be able to take a screenshot for the specified area.

#### AssertViewError

An `AssertViewError` is returned when an attempt to take a screenshot fails. The error may contain one of the following messages, depending on the cause of the crash:

```
duplicate name for "<state>" state
```

```
element ("<selector>") still not existing after <this.options.waitforTimeout> ms
```

```
element ("<this.selector>") still not existing after <this.options.waitforTimeout> ms
```

#### ImageDiffError

An `ImageDiffError` is returned from the [assertView](#assertview) command if a diff (difference in images) is detected when taking and comparing a screenshot with a reference screenshot. The error contains the following message:

```
images are different for "<stateName>" state
```

In addition, the `ImageDiffError` error contains the following data:

* **stateName** `String` - Name of the state for which the screenshot was taken.
* **currImg** `Object` - Link to actual image.
* **refImg** `Object` - Link to reference image.
* **diffOpts** `Object` - Diff detection settings.
* **diffBounds** `Object` - Boundaries of areas with diffs in the image.
* **diffClusters** `Object` - Clusters with diffs in the image.

Read more about [diffBounds](https://github.com/gemini-testing/looks-same/blob/master/README.md#getting-diff-bounds) and [diffClusters](https://github.com/gemini-testing/looks-same/blob/master/README.md#getting-diff-clusters) in the documentation of the [looks-same](https://github.com/gemini-testing/looks-same) package.

#### NoRefImageError

The `NoRefImageError` error is returned from the [assertView](#assertview) command if, when taking and comparing a screenshot, Testplane does not find a reference screenshot on the file system. The error contains the following message:

```
can not find reference image at <refImg.path> for "<stateName>" state
```

In addition, the `NoRefImageError` error contains the following data:

* **stateName** `String` - Name of the state for which the screenshot was taken.
* **currImg** `Object` - Link to actual image.
* **refImg** `Object` - Link to reference image.

### intercept

Method to intercept Testplane's events. The first argument of the method is the event that needs to be intercepted, and the second is the event handler. Example:

```js
// create testplane instance
testplane.intercept(testplane.events.TEST_FAIL, ({ event, data }) => {
    return {event: testplane.events.TEST_PASS, test}; // make the test successful
});
```

Read more about event interception in the section [about plugins](#plugins).

### run

Starts running tests. By default run all tests from the config. Can also run only the specified tests. Returns `true` if the test run succeeded, and `false` if it failed. Example:

```js
// create testplane instance
const success = await testplane.run(testPaths, options);
```

Available parameters:

* **testPaths** (optional) `String[]|TestCollection` – Paths to tests relative to `process.cwd`. Also accepts test collection returned by `readTests`.
* **options** (optional) `Object`
  * **reporters** (optional) `String[]` – Test result reporters.
  * **browsers** (optional) `String[]` – Browsers to run tests in.
  * **sets** (optional) `String[]`– Sets to run tests in.
  * **grep** (optional) `RegExp` – Pattern that defines which tests to run.

### addTestToRun

Adds test to the current run. Returns `false` if the current run has already ended or has been cancelled. Otherwise returns `true`. Example:

```js
// create testplane instance
const success = testplane.addTestToRun(test, browserId);
```

* **test** (required) `Test` – Test to run.
* **browserId** (required) `String` – Browser to run test in.

### readTests

Starts reading tests. By default read all tests from the config. Can also read only the specified tests. Returns promise which resolves to the instance of [TestCollection](#test-collection) initialized by parsed tests. Example:

```js
// create testplane instance
await testplane.readTests(testPaths, options);
```

* **testPaths** (required) `String[]` – Paths to tests relative to `process.cwd`.
* **options** (optional) `Object`:
  * **browsers** (optional) `String[]` – Read tests only for the specified browsers.
  * **silent** (optional) `Boolean` – flag to disable events emitting while reading tests; default is `false`.
  * **ignore** (optional) `String|Glob|Array<String|Glob>` - patterns to exclude paths from the test search.
  * **sets** (optional) `String[]`– Sets to run tests in.
  * **grep** (optional) `RegExp` – Pattern that defines which tests to run.

### isFailed

Returns `true` or `false` depending on whether there has been an error or a test fail while running tests. Can be useful in plugins to determine Testplane's current status. Example:

```js
// create testplane instance
const failed = testplane.isFailed();
```

### isWorker

Returns `true` or `false` depending on whether you call the method in one of the workers or in the master process. Can be useful in plugins in order to distinguish the code execution context. Example:

```js
// implementation of some plugin
module.exports = (testplane) => {
    if (testplane.isWorker()) {
        // do some stuff only in workers
    } else {
        // do some stuff only in the master process
    }
};
```

### halt

Abnormal termination of the test run in case of a terminal error. If process fails to gracefully shutdown in `timeout` milliseconds, it would be forcibly terminated (unless `timeout` is explicitly set to `0`).

```js
// create testplane instance
testplane.halt(error, [timeout=60000ms]);
```

### Test Collection

TestCollection object is returned by `testplane.readTests` method.

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

Adds controller to `testplane` object in test files.

* `name` - controller name
* `methods` - an object with names as keys and callbacks as values describing controller methods. Each callback will be called on corresponding test or suite.

Example:
```js
// in plugin
testplane.on(testplane.events.BEFORE_FILE_READ, ({file, testParser}) => {
    testParser.setController('logger', {
        log: function(prefix) {
            console.log(`${prefix}: Just parsed ${this.fullTitle()} from file ${file}`);
        }
    });
});

// in test file
describe('foo', () => {
    testplane.logger.log('some-prefix');
    it('bar', function() {
        // ...
    });
});
```

**Note**: controller will be removed as soon as current file will be parsed
