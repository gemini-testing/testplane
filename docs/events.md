## Testplane Events

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->
### Contents

- [Master process events](#master-process-events)
- [Worker process events](#worker-process-events)
- [Sharing data between master and worker processes](#sharing-data-between-master-and-worker-processes)
- [Intercepting events](#intercepting-events)
  - [Events that can be intercepted](#events-that-can-be-intercepted)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

### Master process events

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

### Worker process events

Event                     | Description
------------------------- | -------------
`BEFORE_FILE_READ`        | Will be triggered on test files parsing before reading the file. The handler accepts data object with `file`, `testplane` (helper which will be available in test file) and `testParser` (`TestParserAPI` object) fields.
`AFTER_FILE_READ`         | Will be triggered on test files parsing right after reading the file. The handler accepts data object with `file` and `testplane` (helper which will be available in test file) fields.
`AFTER_TESTS_READ`        | Will be triggered right after tests read each time some file is being reading during test run.
`NEW_BROWSER`             | Will be triggered after new browser instance created. The handler accepts an instance of webdriverIO as the first argument and an object with a browser identifier and version as the second.
`UPDATE_REFERENCE`        | Will be triggered after updating reference image.

### Sharing data between master and worker processes

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

### Intercepting events

You have the ability to intercept events in plugins and translate them to other events:

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

#### Events that can be intercepted

Event                     |
------------------------- |
`SUITE_BEGIN`             |
`SUITE_END`               |
`TEST_BEGIN`              |
`TEST_END`                |
`TEST_PASS`               |
`TEST_FAIL`               |
`RETRY`                   |
