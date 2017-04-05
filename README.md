Hermione
========
Hermione is a utility for integration testing of web pages using [WebdriverIO](http://webdriver.io/) and [Mocha](https://mochajs.org).

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->


- [Why you should choose hermione](#why-should-you-choose-hermione)
  - [Easy to use](#easy-to-use)
  - [Runs tests in parallel](#parallel-test-running)
  - [Extensible](#extensibility)
  - [Retries failed tests](#retries-for-failed-tests)
  - [Executes separate tests](#executing-a-separate-test)
  - [Skips tests in specific browsers](#skip-tests-in-specific-browsers)
  - [Offers flexible test configuration](#flexible-tests-configuration)
  - [Automatically initializes and closes grid sessions](#auto-initialization-and-closing-grid-sessions)
- [Prerequisites](#prerequisites)
- [Skip](#skip)
- [Only](#only)
- [WebdriverIO extensions](#webdriverio-extensions)
  - [Sharable meta info](#sharable-meta-info)
  - [Execution context](#execution-context)
- [Quick start](#quick-start)
- [.hermione.conf.js](#hermioneconfjs)
  - [sets](#sets)
  - [browsers](#browsers)
  - [gridUrl](#gridurl)
  - [baseUrl](#baseurl)
  - [httpTimeout](#httptimeout)
  - [sessionRequestTimeout](#sessionrequesttimeout)
  - [sessionQuitTimeout](#sessionquittimeout)
  - [waitTimeout](#waittimeout)
  - [sessionsPerBrowser](#sessionsperbrowser)
  - [retry](#retry)
  - [system](#system)
    - [debug](#debug)
    - [mochaOpts](#mochaopts)
    - [ctx](#ctx)
  - [plugins](#plugins)
  - [prepareBrowser](#preparebrowser)
  - [prepareEnvironment](#prepareenvironment)
- [CLI](#cli)
- [Reporters](#reporters)
- [Overriding settings](#overriding-settings)
- [Programmatic API](#programmatic-api)
  - [run](#run)
  - [readTests](#readtests)
- [Environment variables](#environment-variables)
  - [HERMIONE_SKIP_BROWSERS](#hermione_skip_browsers)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

## Why you should choose hermione
`Hermione` provides several features that `WebdriverIO` doesn't, and makes the testing process easier.

### Easy to use
If you are familiar with [WebdriverIO](http://webdriver.io/) and [Mocha](https://mochajs.org), you can start writing and running tests in 5 minutes! You need to install `hermione` via npm and add a tiny config to your project. For details, see the [Quick start](#quick-start) section.

### Runs tests in parallel
When tests are run one by one, it takes a lot of time. `Hermione` can run tests in parallel sessions in different browsers out of the box.

### Extensible
`WebdriverIO` provides built-in commands for browser and page manipulation. Often projects need to store some common code and reuse it throughout all tests, so the developer needs to create some helpers and include them in the tests.

With `hermione` this is very simple and straightforward. You can add any number of custom commands in the hermione config and use them as `this.browser.myCustomCommand` in tests.

Moreover, `hermione` provides plugins that work like hooks. They allow the developer to prepare the testing environment and react properly to test execution events.

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

```
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

## Prerequisites
Because `hermione` is based on `WebdriverIO`, you need to set up [Selenium](http://www.seleniumhq.org/) before proceeding further.

The simplest way to get started is to use one of the NPM selenium standalone packages, such as [vvo/selenium-standalone](https://github.com/vvo/selenium-standalone). After installing it (globally), you can run your server by executing:
```
selenium-standalone start
```

## Skip
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

## Only
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

## WebdriverIO extensions
`Hermione` adds some useful methods and properties to the `webdriverio` session after its initialization.

### Sharable meta info
Implemented via two commands:
* setMeta(key, value)
* getMeta(key)

These methods allow you to store some information between webdriver calls and it can then be used in custom commands, for instance. This meta information will be shown in the [allure report](https://github.com/gemini-testing/hermione-allure-reporter).

**Note**: hermione saves the last URL opened in the browser in meta info.

Example:
```js
it('test1', function() {
    return this.browser
        .setMeta('foo', 'bar')
        .url('/foo/bar?baz=qux')
        .getMeta('foo')
        .then((val) => console.log(val)) // prints 'bar'
        .getMeta('url')
        .then((url) => console.log(url)); // prints '/foo/bar?baz=qux'
});
```

### Execution context
The execution context can be accessed by the `browser.executionContext` property, which contains the current test/hook mocha object extended with the browser id.

Example:
```js
it('some test', function() {
    return this.browser
        .url('/foo/bar')
        .then(function() {
            console.log('test', this.executionContext);
        });
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

## Quick start
First of all, make sure that all [prerequisites](#prerequisites) are satisfied.

Install the package.
```
npm install -g hermione
```

Then put `.hermione.conf.js` in the project root.
```javascript
module.exports = {
    sets: {
        desktop: {
            files: 'tests/desktop'
        }
    },

    browsers: {
        chrome: {
            desiredCapabilities: {
                browserName: 'chrome'
            }
        }
    }
};
```

Write your first test.
```javascript
var assert = require('chai').assert;

describe('yandex', function() {
    it('should find itself', function() {
        return this.browser
            .url('https://yandex.com')
            .setValue('.search2__input input', 'yandex')
            .click('.search2__button button')
            .getText('.z-entity-card__title')
            .then(function(title) {
                assert.equal(title, 'Yandex')
            });
    });
});
```

Finally, run tests.
```
hermione
```

## .hermione.conf.js
`hermione` is tuned using a configuration file. By default, it uses `.hermione.conf.js`, but you can use the `--conf` option to specify a path to the configuration file.

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
        ]
        browsers: ['browser'] // run tests which match the specified masks in the browser with the `browser` id
    }
}
```

* `files` – A list of test files or directories with test files. This can be a string if you want to specify just one file or directory. Also, you can use
masks for this property.

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
`waitTimeout`             | Timeout for web page event. Default value is `1000` ms.
`httpTimeout`             | Timeout for any requests to Selenium server. Default value is `90000` ms.
`sessionRequestTimeout`   | Timeout for getting a browser session. Default value is `httpTimeout`.
`sessionQuitTimeout`      | Timeout for quitting a session. Default value is `httpTimeout`.
`sessionsPerBrowser`      | Number of sessions which are run simultaneously. Default value is `1`.
`retry`                   | How many times a test should be rerun. Default value is `0`.
`screenshotPath`          | Directory to save screenshots by Webdriverio. Default value is `null`.
`meta`                    | Additional data that can be obtained via .getMeta() method

### gridUrl
Selenium grid URL. Default value is `http://localhost:4444/wd/hub`.

### baseUrl
Base service-under-test URL. Default value is `http://localhost`.

### httpTimeout
Timeout for any requests to Selenium server. Default value is `90000` ms.

### sessionRequestTimeout
Timeout for getting a browser session. Default value is `httpTimeout`.

### sessionQuitTimeout
Timeout for quitting a session. Default value is `httpTimeout`.

### waitTimeout
Timeout for web page events. Default value is `1000` ms.

### sessionsPerBrowser
Number of sessions which are run simultaneously. Global value for all browsers. Default value is `1`.

### retry
How many times a test should be retried if it fails. Global value for all browsers. Default value is `0`.

### meta
Additional data that can be obtained via .getMeta() method

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

### plugins
`Hermione` plugins are commonly used to extend built-in functionality. For example, [hermione-allure-reporter](https://github.com/gemini-testing/hermione-allure-reporter) and [hermione-tunnel](https://github.com/gemini-testing/hermione-tunnel).

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

**Available events**

Event                     | Description
------------------------- | -------------
`BEFORE_FILE_READ`        | Will be triggered on test files parsing before reading the file. The handler accepts data object with `file`, `browser` (browser id string), `hermione` (helper which will be available in test file) and `suite` (collection of tests in a file; provides the ability to subscribe on `test` and `suite` events) fields.
`AFTER_FILE_READ`         | Will be triggered on test files parsing right after reading the file. The handler accepts data object with `file`, `browser` (browser id string), `hermione` (helper which will be available in test file) and `suite` (collection of tests in a file; provides the ability to subscribe on `test` and `suite` events) fields.
`RUNNER_START`            | Will be triggered before test execution. If a handler returns a promise, tests will be executed only after the promise is resolved. The handler accepts an instance of a runner as the first argument. You can use this instance to emit and subscribe to any other available events.
`RUNNER_END`              | Will be triggered after test execution. If a handler returns a promise, tests will be executed only after the promise is resolved.
`SESSION_START`           | Will be triggered after browser session initialization. If a handler returns a promise, tests will be executed only after the promise is resolved. The handler accepts an instance of webdriverIO as the first argument and an object with a browser identifier as the second.
`SESSION_END`             | Will be triggered after the browser session ends. If a handler returns a promise, tests will be executed only after the promise is resolved. The handler accepts an instance of webdriverIO as the first argument and an object with a browser identifier as the second.
`SUITE_BEGIN`             | Test suite is about to execute.
`SUITE_END`               | Test suite execution is finished.
`SUITE_FAIL`              | Suite failed. For instance, the `before` hook failed or a browser cannot be launched (in fact, browsers are launched in `before` hook implicitly in the core of `hermione`).
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

### prepareBrowser
Prepare the browser session before tests are run. For example, add custom user commands.
```js
prepareBrowser: function(browser) {
    // do setup here
}
```

The `browser` argument is a `WebdriverIO` session.

### prepareEnvironment
Configuration data can be changed depending on extra conditions in the `prepareEnvironment` function.

## CLI
```
  Usage: hermione [options]

  Options:

    -h, --help                 Output usage information
    -c, --config <path>        Path to configuration file
    -r, --reporter <reporter>  Test reporter
    -b, --browser <browser>    Run tests only in specified browser
    --grep <grep>              Run only tests matching string or regexp
```

For example,
```
hermione --config ./config.js --reporter flat --browser firefox --grep name
```

**Note.** All CLI options override config values.

## Reporters
You can choose `flat` or `plain` reporter by option `-r, --reporter`. Default is `flat`.

* `flat` – all information about failed and retried tests would be grouped by browsers at the end of the report.

* `plain` – information about fails and retries would be placed after each test.

## Overriding settings

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

## Programmatic API

With the API, you can use Hermione programmatically in your scripts or build tools.

```js
const Hermione = require('hermione');

const hermione = new Hermione(config, allowOverrides);
```

* **config** (required) `String|Object` – Path to the configuration file that will be read relative to `process.cwd` or [configuration object](#hermioneconfjs).
* **allowOverrides** (optional) `Object` – Switch on/off [configuration override](#overriding-settings) via environment variables or CLI options:
  * **env** (optional) `Boolean` – Switch on/off configuration override via environment variables. Default is `false`.
  * **cli** (optional) `Boolean` - Switch on/off configuration override via CLI options. Default is `false`.

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

* **testPaths** (optional) `String[]` – Paths to tests relative to `process.cwd`.
* **options** (optional) `Object`
  * **reporters** (optional) `String[]` – Test result reporters.
  * **browsers** (optional) `String[]` – Browsers to run tests in.
  * **grep** (optional) `RegExp` – Pattern that defines which tests to run.

### readTests

```js
hermione.readTests(testPaths, browsers).done();
```

* **testPaths** (required) `String[]` – Paths to tests relative to `process.cwd`.
* **browsers** (optional) `String[]` – Read tests only for the specified browsers.

## Environment variables

### HERMIONE_SKIP_BROWSERS
Skip the browsers specified in the config by passing the browser IDs. Multiple browser IDs should be separated by commas
(spaces after commas are allowed).

For example,
```
HERMIONE_SKIP_BROWSERS=ie10,ie11 hermione
```
