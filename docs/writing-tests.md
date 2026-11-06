## Writing Tests

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->
### Contents

- [Arguments](#arguments)
- [Missing await checks](#missing-await-checks)
  - [Configuration](#configuration)
  - [Scope and limitations](#scope-and-limitations)
- [Hooks](#hooks)
- [Skip](#skip)
- [Only](#only)
- [Also](#also)
- [Config overriding](#config-overriding)
  - [testTimeout](#testtimeout)
- [WebdriverIO extensions](#webdriverio-extensions)
  - [Sharable meta info](#sharable-meta-info)
  - [Execution context](#execution-context)
- [AssertView](#assertview)
- [RunStep](#runstep)
- [OpenAndWait](#openandwait)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

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

### Missing await checks

Testplane checks for missing `await` **before executing the initial test collection**. The check is enabled by default for JavaScript and TypeScript; it does not require ESLint or a `tsconfig.json`.

For example, this test stops the run with `TestPreflightError`, a nonzero CLI exit code, and the file, line, column and source snippet:

```js
it("plane", async ({ browser }) => {
    browser.assertView("plane"); // Missing await
});
```

Wait for the operation, or return its promise when it is the last operation:

```js
it("plane", async ({ browser }) => {
    await browser.assertView("plane");
});

it("plane", ({ browser }) => {
    return browser.assertView("plane");
});
```

The check follows known browser/element commands, promise chains, local saved promises and aliases, and ordinary branches. Saving a promise is not enough: it must be awaited or returned on every analyzed normal exit.

```js
it("plane", async ({ browser }) => {
    const screenshot = browser.assertView("plane");
    if (condition) await screenshot; // The other branch leaves it unawaited
});
```

It also reports async callbacks passed to a recognized `Array.forEach`, and unused promise arrays produced by `map`. `await array.forEach(async ...)` and `await array.map(async ...)` do not wait for those callbacks. Prefer a sequential loop for browser commands:

```js
it("pages", async ({ browser }) => {
    for (const url of ["/first", "/second"]) {
        await browser.url(url);
        await browser.assertView(url);
    }
});
```

WDIO element arrays are different from native arrays: both `browser.$$(selector)` and the resolved element array provide asynchronous `map`/`forEach` methods. Awaiting those methods is valid and is supported by the checker:

```js
await browser.$$("a").forEach(async element => {
    await element.click();
});
```

Local promise arrays can also be consumed with `for...of` plus `await`, or `for await...of`; early exits leave the remaining promises outstanding. Promise assimilation is shallow: `await Promise.all([[command()]])` does not await the command in the nested array, nor does returning an array from a `.then` callback.

For operations that are safe to run concurrently, `await Promise.all(items.map(async item => ...))` is supported. Adding `.catch(...)` or `void` alone does not wait for completion and does not suppress the check. `Promise.race` and `Promise.any` transfer ownership to the aggregate, but awaiting that aggregate does **not** guarantee that every input operation has finished.

#### Configuration

`system.checkMissingAwait` is a boolean, defaulting to `true`. Disable it explicitly for a project that uses unsupported source formats or test definitions:

```js
module.exports = {
    system: {
        checkMissingAwait: false,
    },
    // Other Testplane options
};
```

Equivalent overrides:

```bash
TESTPLANE_SYSTEM_CHECK_MISSING_AWAIT=false npx testplane
npx testplane --system-check-missing-await false
```

Disabling it skips both the check and loading the analyzer. Existing runtime error handling remains enabled.

#### Scope and limitations

- Supported sources: `.js`, `.jsx`, `.mjs`, `.cjs`, `.ts`, `.tsx`, `.mts`, `.cts`. Parsing uses the bundled TypeScript compiler. Syntax it cannot parse, unreadable files, missing source paths and unsupported Mocha UIs produce explicit analysis errors, not a successful check.
- Supported test definitions are inline callbacks for the standard `bdd`, `tdd` and `qunit` interfaces, including their per-test hooks and `.only`/`.skip` variants. The check recognizes the callback's browser context, `this.browser`, local aliases, and named imports from Testplane/Mocha. Arbitrary DSL wrappers and callbacks supplied by reference are not test entry points.
- The selected collection determines the files: a file is checked if it has at least one non-pending, non-disabled test. **The entire selected file is checked**, including tests skipped or excluded by `grep` within that file. Multiple browsers and symlinks do not cause duplicate selected-file analysis.
- Inline per-test hooks in those files are checked. Separate hook-only files, imported/injected hook bodies and plugin `beforeAll` callbacks are not covered. Hook metadata does not reliably identify the original hook file.
- The barrier is before browser-pool prewarming, `RUNNER_START`, test execution and runner-created browser sessions. Configuration, `INIT`, `beforeAll`, worker/dev-server initialization and top-level test-file code used for discovery may already have run. The analyzer itself never executes test/helper bodies.
- A TypeChecker supplements known command recognition using available JS inference, JSDoc, declarations and TS types. It reads the nearest `tsconfig.json` when present, otherwise uses built-in defaults. Imports and configured project files may be read for types, but external helper bodies are not recursively checked for missing waits. An imported helper/custom command with a known promise-returning type can be checked at its call site.
- Missing types, `any`, dynamic names/registrations and untyped external custom commands can hide errors. Known Testplane commands still work without types. Invalid compiler configuration is reported explicitly; this check is not a replacement for `tsc`.
- Local flow analysis is bounded, not a proof for arbitrary code. Passing a promise to an unknown consumer, storing it in objects or mutable containers, complex closures, correlated alias changes, recursion and implicit exception paths can leave the analysis scope. Transfer to an unknown consumer is **not** proof that it awaits the promise.
- `run(TestCollection)` is checked too, using its source files; a programmatically replaced callback may differ from that source. Tests added after the barrier, generated code without usable source and transpiled async state machines are outside the guarantee. Locations refer to the actual analyzed file, not an original source recovered through source maps.
- `readTests` and discovery-only commands do not run this validation. Successful preflight does not prove that all asynchronous work will finish with the test; keep runtime safeguards and, where applicable, typed linting.

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

### Also
This feature allows you to run the specified suite or test in [passive browser](https://testplane.io/docs/v8/config/browsers/#passive).
You can do this by using the global `testplane.also` helper. It supports the following methods:

- `.in` – Adds matchers for browsers.

These methods take the following arguments:

- browser {String|RegExp|Array<String|RegExp>} — A matcher for browser(s) to enable test.

For example:
```js
// ...
testplane.also.in('yabro');

it('should run in passive browser', function() {
    return doSomething();
});
```
The test will be run in passive browser "yabro" and in all other not passive browsers.

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

With skipped `selector` parameter, assertView will take a screenshot of the current viewport. Example:

```js
it('some test', async ({ browser }) => {
    await browser.url('some/url');
    // Scroll 1000 px down
    await browser.execute(() => window.scrollTo(0, 1000));
    // Screen the viewport
    await browser.assertView('plain');

    // Click the button
    await browser.$('.button').click();
    // Screen the viewport with custom options
    await browser.assertView('clicked', { ignoreDiffPixelCount: 5 });
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
- selector (optional, can be skipped) `String|String[]` – DOM-node selector that you need to capture. If not specified or skipped, will be set to `body` and the following options will be automatically added to opts:
    ```
    {
        allowViewportOverflow: true,
        compositeImage: false,
        captureElementFromTop: false
    }
    ```

    So, assertView without `selector` parameter will take a screenshot of the current viewport.

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
