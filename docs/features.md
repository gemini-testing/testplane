<!-- DOCTOC SKIP -->

## Testplane Features Overview
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
