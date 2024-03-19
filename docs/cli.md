## Testplane CLI

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->
### Contents

- [Overview](#overview)
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

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

### Overview

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
