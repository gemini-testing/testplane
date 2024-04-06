## Testplane Programmatic API

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->
### Contents

- [Overview](#overview)
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

### Overview

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

For more details, refer to the [Testplane Events](https://github.com/gemini-testing/hermione/blob/master/docs/events.md) page.

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
