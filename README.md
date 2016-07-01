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
  - [Auto initialization and closing grid sessions](#auto-initialization-and-closing-grid-sessions)
- [Prerequisites](#prerequisites)
- [Skip](#skip)
- [Quick start](#quick-start)
- [.hermione.conf.js](#hermioneconfjs)
  - [specs](#specs)
  - [browsers](#browsers)
  - [grid](#grid)
  - [baseUrl](#baseurl)
  - [timeout](#timeout)
  - [waitTimeout](#waittimeout)
  - [slow](#slow)
  - [debug](#debug)
  - [sessionsPerBrowser](#sessionsperbrowser)
  - [retry](#retry)
  - [plugins](#plugins)
  - [mochaOpts](#mochaopts)
  - [prepareBrowser](#preparebrowser)
  - [prepareEnvironment](#prepareenvironment)
- [CLI](#cli)
- [Environment variables](#environment-variables)
  - [HERMIONE_SKIP_BROWSERS](#hermione_skip_browsers)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

## Why should you choose hermione?
`Hermione` provides several features which `WebdriverIO` doesn't and makes testing process easier.

### Easy to use
If you know [WebdriverIO](http://webdriver.io/) and [Mocha](https://mochajs.org), you can start writting and running tests in 5 minutes! You need to install `hermione` via npm and add a tiny config in your project. See details in [Quick start](#quick-start) section.

### Parallel test running
When tests are run one by one, it takes a lot of time. `Hermione` can run tests in parallel sessions in different browsers out of the box.

### Extensibility
`WebdriverIO` provides built-in commands for browser and page manipulation. Often projects need to store some common code and reuse it through all tests. So a developer should create some helpers and include them in the tests.

With `hermione` it's very simple and straightforward. You can add any number of custom commands in the hermione config and use them as `this.browser.myCustomCommand` in tests.

Moreover, `hermione` provides plugins which work as a some kind of hooks. They allow a developer to prepare environement for tests and react properly to test execution events.

### Retries for failed tests
Integration tests use a dynamic environment with a lot of dependencies where any of them can work unstable from time to time. As a result, integration tests become red randomly and make them undetermined. It spoils all testing process.

To prevent incidental fails `hermione` retryies a failed test before marking it as failed. It makes it possible to get rid of a majority of incidental fails. Number of retries can be specified for all browsers or for a separate browser.

`Hermione` reruns tests in a new browser session to exclude situations when the browser environment is a cause of this fail.

### Executing a separate test
Sometimes it is needed to run only specific tests but not all set. `Hermione` makes it possible.
```
hermione tests/func/mytest.js
```

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

 - `.in` — adds matchers for browsers with additional comment
 - `.notIn` — `.in` method with reverted value;

Each method takes following arguments:
 - browser {String|RegExp|Array<String|RegExp>} — matcher for browser(s) to skip
 - [comment] {String} — comment for skipped test;

**Note that matchers will be compared with `browserId` specified in a config file, e.g. `chrome-desktop`.**

For example,
```js
describe('feature', () => {
    hermione.skip.in('chrome', "It shouldn't work this way in Chrome");
    it('should work this way', () => runTestThisWay());

    it('should work that way', () => runTestThatWay());

    hermione.skip.in(['chrome', 'firefox', /ie\d*/], 'Unstable test, see ticket TEST-487');
    it('should done some tricky things', () => runTrickyTest());
});
```

in this case behaviour `it should work this way` will be skipped only in `chrome` browser, but will be run in other browsers. `It should work that way` will not be ignored. So skip will be applied only to the nearest test. If you need to skip all tests within a suite you can apply `skip` helper to a `describe` - all tests within this suite will be skipped with the same comment.
```js
hermione.skip.in('chrome', 'skip comment');
describe('some feature', () => {
    it(...);
    it(...);
});
```

Also you can use `.notIn` method to invert matching. For example,
```js
// ...
hermione.skip.notIn('chrome', 'some comment');
it('should work this way', () => doSomething());
// ...
```

in this case test will be skipped in all browsers except `chrome`.

Methods `in` and `notIn` are chainable. So you can skip test in several browsers with different comments. For example,
```js
// ...
hermione.skip
    .in('chrome', 'some comment')
    .notIn('ie9', 'another comment');
it('test1', () => doSomething());
// ...
```

If you need to skip test in all browsers without a comment you can use [mocha `.skip` method](http://mochajs.org/#inclusive-tests) instead of `hermione.skip.in(/.*/);`. The result will be the same.

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
`desiredCapabilities`     | **Required.** Used WebDriver [DesiredCapabilites](https://github.com/SeleniumHQ/selenium/wiki/DesiredCapabilities)
`sessionsPerBrowser`      | Number of sessions which are run simultaneously. Default value is `1`.
`retry`                   | How many times test should be rerun. Default value is `0`.

### grid
Selenium grid URL. Default value is `http://localhost:4444/wd/hub`.

### baseUrl
Base service-under-test url. Default value is `http://localhost`.

### timeout
Timeout for text execution. Default value is `60000` ms.

### waitTimeout
Timeout for web page events. Default value is `1000` ms.

### slow
If test execution time is greater than this value, then test is slow. Default value is `10000`.

### debug
Turn webdriver debug mode on. Default value is `false`.

### sessionsPerBrowser
Number of sessions which are run simultaneously. Global value for all browsers. Default value is `1`.

### retry
How many times test should be retried in case of a fail. Global value for all browsers. Default value is `0`.

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
    hermione.on(hermione.events.RUNNER_START, function() {
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
`RUNNER_START`            | Will be triggered before tests execution. If handler return a promise, tests will be executed only after promise is resolved.
`RUNNER_END`              | Will be triggered after tests execution. If handler return a promise, tests will be executed only after promise is resolved.
`SUITE_BEGIN`             | Test suite is about to execute
`SUITE_END`               | Test suite execution is finished
`TEST_BEGIN`              | Test is about to execute
`TEST_END`                | Test execution is finished
`TEST_PASS`               | Test passed
`TEST_FAIL`               | Test failed
`TEST_PENDING`            | Test is skipped
`RETRY`                   | Test failed but went to retry
`ERROR`                   | Generic (no tests) errors. For instance, a browser cannot be loaded
`INFO`                    | Reserved
`WARNING`                 | Reserved
`EXIT`                    | Will be triggered when SIGTERM is received (for example, Ctrl + C). Handler can return a promise.

### mochaOpts
Extra options for `mocha` which are passed to `mocha.setup`. See [Mocha](https://mochajs.org/) documentation for the list of options.
```javascript
mochaOpts: {
    ignoreLeaks: true
}
```

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
    -c, --conf <path>          Path to configuration file [./.hermione.conf.js]
    --baseUrl <url>            Base service-under-test url [http://localhost]
    --grid <url>               Selenium grid URL [http://localhost:4444/wd/hub]
    --wait-timeout <ms>        Timeout for web page events [10000]
    --screenshot-path <path>   Path for saving screenshots []
    --debug <boolean>          Turn webdriver debug mode on [false]
    --grep <grep>              Filter tests matching string or regexp
    -r, --reporter <reporter>  Reporter [flat]
    -b, --browser <browser>    Run test in a specific browser
```

For example,
```
hermione --baseUrl http://yandex.ru/search
```

**Note.** All CLI options override config values.

## Environment variables

### HERMIONE_SKIP_BROWSERS
Skip browsers specified in a config by passing browser ids. Several browser ids should be split by commas
(spaces after commas are allowed).

For example,
```
HERMIONE_SKIP_BROWSERS=ie10,ie11 hermione
```
