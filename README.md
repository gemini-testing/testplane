Hermione
========
Hermione is the utility for integration testing of web pages using [WebdriverIO](http://webdriver.io/) and [Mocha](https://mochajs.org).

<img src="hermione.png" align="right"/>

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->


- [Why should you choose hermione?](#why-should-you-choose-hermione)
  - [Easy to use](#easy-to-use)
  - [Parallel test running](#parallel-test-running)
  - [Extensibility](#extensibility)
  - [Retries for failed tests](#retries-for-failed-tests)
  - [Executing a separate test](#executing-a-separate-test)
  - [Skip tests in specific browsers](#skip-tests-in-specific-browsers)
  - [Flexible tests configuration](#flexible-tests-configuration)
  - [Auto initialization and closing grid sessions](#auto-initialization-and-closing-grid-sessions)
- [Prerequisites](#prerequisites)
- [Skip](#skip)
- [Only](#only)
- [WebdriverIO extensions](#webdriverio-extensions)
  - [Sharable meta info](#sharable-meta-info)
  - [Execution context](#execution-context)
- [Quick start](#quick-start)
- [.hermione.conf.js](#hermioneconfjs)
  - [specs](#specs)
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
  - [plugins](#plugins)
  - [prepareBrowser](#preparebrowser)
  - [prepareEnvironment](#prepareenvironment)
- [CLI](#cli)
- [Overriding settings](#overriding-settings)
- [Programmatic API](#programmatic-api)
- [Environment variables](#environment-variables)
  - [HERMIONE_SKIP_BROWSERS](#hermione_skip_browsers)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

## Why should you choose hermione?
`Hermione` provides several features which `WebdriverIO` doesn't and makes testing process easier.

### Easy to use
If you are familiar with [WebdriverIO](http://webdriver.io/) and [Mocha](https://mochajs.org), you can start writing and running tests in 5 minutes! You need to install `hermione` via npm and add a tiny config to your project. See details in [Quick start](#quick-start) section.

### Parallel test running
When tests are run one by one, it takes a lot of time. `Hermione` can run tests in parallel sessions in different browsers out of the box.

### Extensibility
`WebdriverIO` provides built-in commands for browser and page manipulation. Often projects need to store some common code and reuse it through all tests. So a developer should create some helpers and include them in the tests.

With `hermione` it's very simple and straightforward. You can add any number of custom commands in the hermione config and use them as `this.browser.myCustomCommand` in tests.

Moreover, `hermione` provides plugins which work as some kind of a hooks. They allow a developer to prepare environment for tests and react properly to test execution events.

### Retries for failed tests
Integration tests use a dynamic environment with a lot of dependencies where any of them can work unstable from time to time. As a result, integration tests become red randomly and make them undetermined. It spoils all testing process.

To prevent incidental fails `hermione` retries a failed test before marking it as a failed. It makes it possible to get rid of a majority of incidental fails. Number of retries can be specified for all browsers or for a specific browser.

:warning: `Hermione` reruns tests in a new browser session to exclude situations when the browser environment is a cause of the fail.

### Executing a separate test
Sometimes it is needed to run only specific tests but not all tests in a set. `Hermione` makes it possible. You can specify path to the test file
```
hermione tests/func/mytest.js
```

or filter describes by using `--grep` option

```
hermione --grep login
```

or simply use `mocha` `only()` API in the test

```
describe.only('user login', function() {...});
```

### Skip tests in specific browsers
Sometimes you need to skip test not in all browsers but in a specific one. For example, you don't need to run
some test in ~~ugly~~ IE browsers. In `hermione` you can do it with [hermione helper](#skip). For example,
you can skip some tests in the specific browser
```js
describe('feature', function() {
    hermione.skip.in('ie8', 'it can not work in this browser');
    it('nowaday functionality', function() {...});
});
```

or run tests in one of the browsers
```js
describe('feature', function() {
    // will be skipped in all browsers except chrome
    hermione.skip.notIn('chrome', 'it should work only in Chrome');
    it('specific functionality', function() {...});
});
```

In these cases you will see messages with a skip reason in reports.

To skip suite or test silently (without any messages in reports), you can pass the third argument with silent flag:
```js
hermione.skip.in('ie8', 'skipReason', {silent: true});
// or
hermione.skip.notIn('chrome', 'skipReason', {silent: true});
```

Or you can use another hermione helper - [only](#only), which is silent by default:
```js
hermione.only.in('chrome');
```

It will run tests only in one browser and skip rest silently.

### Flexible tests configuration
`Hermione` has possibility to configure running some set of tests in specific browsers. For example,
```js
specs: [
    'tests/common', // run common tests in all browsers specified in the config
    {
        files: 'tests/desktop',
        browsers: ['ie8', 'opera']
    },
    {
        files: 'tests/touch',
        browsers: ['iphone', 'android']
    }
]
```
See [specs](#specs) for more details.


### Auto initialization and closing grid sessions
All work with a grid client is incapsulated in hermione. Forget about `client.init` and `client.end` in your tests ;)

## Prerequisites
Because of `hermione` is based on `WebdriverIO` you need to set up [Selenium](http://www.seleniumhq.org/) before proceed further.

The simplest way to get started is to use one of the NPM selenium standalone packages like: [vvo/selenium-standalone](https://github.com/vvo/selenium-standalone). After installing it (globally) you can run your server by executing:
```
selenium-standalone start
```

## Skip
This feature allows you to ignore the specified suite or test in any browser with additional comment.
You can do it by using global `hermione.skip` helper. It supports the following methods:

 - `.in` — adds matchers for browsers with additional comment;
 - `.notIn` — `.in` method with reverted value;

Each of these methods takes following arguments:
 - browser {String|RegExp|Array<String|RegExp>} — matcher for browser(s) to skip;
 - [comment] {String} — comment for skipped test;
 - [options] {Object} - additional options;

**Note that matchers will be compared with `browserId` specified in a config file, e.g. `chrome-desktop`.**

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
    it('should done some tricky things', function() {
        return runTrickyTest();
    });
});
```

in this case behaviour `it should work this way` will be skipped only in `chrome` browser, but will be run in other browsers. `It should work that way` will not be ignored. So skip will be applied only to the nearest test. If you need to skip all tests within a suite you can apply `skip` helper to a `describe` - all tests within this suite will be skipped with the same comment.
```js
hermione.skip.in('chrome', 'skip comment');
describe('some feature', function() {
    it(...);
    it(...);
});
```

Also you can use `.notIn` method to invert matching. For example,
```js
// ...
hermione.skip.notIn('chrome', 'some comment');
it('should work this way', function() {
    return doSomething();
});
// ...
```

in this case test will be skipped in all browsers except `chrome`.

All of these methods are chainable. So you can skip test in several browsers with different comments. For example,
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

If you need to skip test in all browsers without a comment you can use [mocha `.skip` method](http://mochajs.org/#inclusive-tests) instead of `hermione.skip.in(/.*/);`. The result will be the same.

## Only
This feature allows you to ignore the specified suite or test in any browser silently (without any messages in reports).
You can do it by using global `hermione.only` helper. It supports only one method:

- `.in` — `hermione.skip.notIn` method with silent flag

This method takes following arguments:
 - browser {String|RegExp|Array<String|RegExp>} — matcher for browser(s) to skip;

For example:
```js
// ...
hermione.only.in('chrome');
it('should work this way', function() {
    return doSomething();
});
// ...
```

in this case test will be skipped in all browsers **silently** except `chrome`.

## WebdriverIO extensions
`Hermione` adds some usefull methods and properties to the `webdriverio` session after its initialization.

### Sharable meta info
Implemented via two commands:
* setMeta(key, value)
* getMeta(key)

These methods allow to store some information between webdriver calls so it can be used in custom commands for example. This meta information will be shown in [allure report](https://github.com/gemini-testing/hermione-allure-reporter).

**Note**: hermione saves in meta info last url opened in browser.

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
Execution context can be accessed by `browser.executionContext` property which contains current test/hook mocha object extended with browser id.

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
    specs: ['tests/func'],

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
`hermione` is tuned using a configuration file. By default `.hermione.conf.js` is used but a path to the configuration file can be specified using `--conf` option.

There are only two required fields: `specs` and `browsers`.
```javascript
module.exports = {
    specs: [
        'tests/desktop',
        'tests/touch'
    ],
    browsers: {
        chrome: {
            desiredCapabilities: {
                browserName: 'chrome'
            }
        }
    }
};
```

### specs
**Required.** The list of paths where `hermione` will look for tests.

For example,
```javascript
specs: [
    {                          // run tests associated with this path in all browsers
        files: 'tests/desktop' // which are configured in option `browsers`
    },
    'tests/deskpad',           // the alias for the previous case
    {
        files: 'tests/desktop/*.hermione.js' // run tests matched with a mask
    },
    {
        files: 'tests/touch',  // run tests associated with this path in a browser with id `browser`
        browsers: ['browser']  // which is configured in option `browsers`
    }
]
```

### browsers
**Required.** The list of browsers which should be used for running tests.

Browser section has the following format
```javascript
browsers: {
    <browser_id>: {
        <option>:<value>
        <option>:<value>
    }
}
```
`<browser-id>` values is used for browser identification.

Available browser options:

Option name               | Description
------------------------- | -------------
`desiredCapabilities`     | **Required.** Used WebDriver [DesiredCapabilities](https://github.com/SeleniumHQ/selenium/wiki/DesiredCapabilities)
`gridUrl`                 | Selenium grid Url. Default value is `http://localhost:4444/wd/hub`.
`baseUrl`                 | Base service-under-test url. Default value is `http://localhost`.
`waitTimeout`             | Timeout for web page event. Default value is `1000` ms.
`httpTimeout`             | Timeout for any requests to Selenium server. Default value is `90000` ms.
`sessionRequestTimeout`   | Timeout for getting of a browser session. Default value is `httpTimeout`.
`sessionQuitTimeout`      | Timeout for session quit. Default value is `httpTimeout`.
`sessionsPerBrowser`      | Number of sessions which are run simultaneously. Default value is `1`.
`retry`                   | How many times test should be rerun. Default value is `0`.
`screenshotPath`          | Directory to save screenshots by webdriverio. Default value is `null`.

### gridUrl
Selenium grid URL. Default value is `http://localhost:4444/wd/hub`.

### baseUrl
Base service-under-test url. Default value is `http://localhost`.

### httpTimeout
Timeout for any requests to Selenium server. Default value is `90000` ms.

### sessionRequestTimeout
Timeout for getting of a browser session. Default value is `httpTimeout`.

### sessionQuitTimeout
Timeout for session quit. Default value is `httpTimeout`.

### waitTimeout
Timeout for web page events. Default value is `1000` ms.

### sessionsPerBrowser
Number of sessions which are run simultaneously. Global value for all browsers. Default value is `1`.

### retry
How many times test should be retried in case of a fail. Global value for all browsers. Default value is `0`.

### system

#### debug
Turn webdriver debug mode on. Default value is `false`.

#### mochaOpts
Extra options for `mocha` which are passed to `mocha.setup`. See [Mocha](https://mochajs.org/) documentation for the list of options. Default values are:
```javascript
mochaOpts: {
    slow: 10000, // If test execution time is greater than this value, then test is slow.
    timeout: 60000 // timeout for test execution.
}
```

### plugins
`Hermione` plugins are commonly used to extend built-in possibilities. For example, [hermione-allure-reporter](https://github.com/gemini-testing/hermione-allure-reporter) and [hermione-tunnel](https://github.com/gemini-testing/hermione-tunnel).

Plugin is a module which exports a single function. The function has two arguments:
* hermione instance;
* plugin options from configuration file.

Plugins will be loaded before `hermione` runs tests.

It's strongly recommended to name `hermione` plugins with `hermione-` prefix. It makes search for user plugins [very simple](https://github.com/search?l=JavaScript&q=hermione-&type=Repositories&utf8=%E2%9C%93).

If a plugin name starts with `hermione-`, then the prefix can be ommited in the configuration file. If two modules with names `hermione-some-module` and `some-module` are specified, then module with prefix will have higher priority.

For example.
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

**Properties of `hermione` object**

Property name             | Description
------------------------- | -------------
`config`                  | Config which is used in test runner. Can be mutated.
`events`                  | Events list for subscription

**Available events**

Event                     | Description
------------------------- | -------------
`RUNNER_START`            | Will be triggered before tests execution. If a handler returns a promise, tests will be executed only after promise is resolved. Handler accepts an instance of a runner as a first argument. Using this instance you can emit and subscribe to any other available events.
`RUNNER_END`              | Will be triggered after tests execution. If a handler returns a promise, tests will be executed only after promise is resolved.
`SESSION_START`           | Will be triggered after browser session initialization. If a handler returns a promise, tests will be executed only after promise is resolved. Handler accepts an instance of webdriverIO as a first argument and object with browser identifier as second.
`SESSION_END`             | Will be triggered after browser session quit. If a handler returns a promise, tests will be executed only after promise is resolved. Handler accepts an instance of webdriverIO as a first argument and object with  browser identifier as second.
`SUITE_BEGIN`             | Test suite is about to execute
`SUITE_END`               | Test suite execution is finished
`SUITE_FAIL`              | Suite failed. For instance, `before` hook failed or a browser can not be launched (in fact, browsers are launched in `before` hook implicitly in the core of `hermione`)
`TEST_BEGIN`              | Test is about to execute
`TEST_END`                | Test execution is finished
`TEST_PASS`               | Test passed
`TEST_FAIL`               | Test failed
`TEST_PENDING`            | Test is skipped
`RETRY`                   | Test failed but went to retry
`ERROR`                   | Generic (no tests) errors.
`INFO`                    | Reserved
`WARNING`                 | Reserved
`EXIT`                    | Will be triggered when SIGTERM is received (for example, Ctrl + C). Handler can return a promise.

### prepareBrowser
Prepare browser session before tests are run. For example, adding custom user commands.
```js
prepareBrowser: function(browser) {
    // do setup here
}
```

`browser` argument is a `WebdriverIO` session.

### prepareEnvironment
Configuration data can be changed depending on extra conditions in `prepareEnvironment` function.

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

## Overriding settings

All options can also be overridden via command-line flags or environment variables. Priorities are the following:

* command-line option has the highest priority. It overrides environment variable and config file value.

* environment variable has second priority. It overrides config file value.

* config file value has the lowest priority.

* if no command-line option, environment variable or config file option specified, default is used.

To override config setting with CLI option, convert full option path to `--kebab-case`. For example, if you want to run tests against different base URL, call:

```
hermione path/to/mytest.js --base-url http://example.com
```

To change number of sessions for Firefox (considering you have browser with `firefox` id in the config):

```
hermione path/to/mytest.js --browsers-firefox-sessions-per-browser 7
```

To override setting with environment variable, convert its full path to `snake_case` and add `hermione_` prefix. Above examples can be rewritten to use environment variables instead of CLI options:

```
hermione_base_url=http://example.com hermione path/to/mytest.js
hermione_browsers_firefox_sessions_per_browser=7 hermione path/to/mytest.js
```

## Programmatic API

With the help of API you can use Hermione programmatically in your scripts or build tools.

```js
const Hermione = require('hermione');

const hermione = new Hermione(config, allowOverrides);

hermione.run(testPaths, options)
    .then((success) => process.exit(success ? 0 : 1))
    .catch((e) => {
        console.log(e.stack);
        process.exit(1);
    })
    .done();
```

* **config** (required) `String|Object` - path to configuration file which will be read relatively to `process.cwd` or [configuration object](#hermioneconfjs).
* **allowOverrides** (optional) `Object` - switch on/off [configuration override](#overriding-settings) via environment variables or cli options:
  * **env** (optional) `Boolean` – switch on/off configuration override via environment variables. Default is `false`
  * **cli** (optional) `Boolean` - switch on/off configuration override via cli options. Default is `false`
* **testPaths** (optional) `String[]` - paths to tests relatively to `process.cwd`
* **options** (optional) `Object`
  * **reporters** (optional) `String[]` - test result reporters
  * **browsers** (optional) `String[]` - browsers in which to run tests
  * **grep** (optional) `RegExp` - pattern which indicates which tests to run

## Environment variables

### HERMIONE_SKIP_BROWSERS
Skip browsers specified in a config by passing browser ids. Several browser ids should be split by commas
(spaces after commas are allowed).

For example,
```
HERMIONE_SKIP_BROWSERS=ie10,ie11 hermione
```
