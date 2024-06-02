# About events interception {#events-interception}

Testplane allows the developer to intercept a number of events and change them to others, ignore or delay their processing.

Events that can be intercepted are provided with the _can be intercepted_ tag in the description. There are 7 such events:

* [SUITE_BEGIN](./events/suite-begin.md)
* [SUITE_END](./events/suite-end.md)
* [TEST_BEGIN](./events/test-begin.md)
* [TEST_END](./events/test-end.md)
* [TEST_PASS](./events/test-pass.md)
* [TEST_FAIL](./events/test-fail.md)
* [RETRY](./events/retry.md)

## Changing one event to another {#changing-one-event-to-another}

For example, the code below shows how you can intercept the [TEST_FAIL](./events/test-fail.md) event and change it to the [TEST_PENDING](./events/test-pending.md) event — that is, automatically disable failing tests, preventing them from crashing the overall test run:

```javascript
module.exports = (testplane) => {
    testplane.intercept(testplane.events.TEST_FAIL, ({ event, data }) => {
        const test = Object.create(data);
        test.pending = true;
        test.skipReason = 'intercepted failure';

        return { event: testplane.events.TEST_PENDING, data: test };
    });

    testplane.on(testplane.events.TEST_FAIL, (test) => {
        // this handler will never be called
    });

    testplane.on(testplane.events.TEST_PENDING, (test) => {
        // this handler will always be called instead of the handler for TEST_FAIL
    });
};
```

## Leaving the event as is {#leaving-event-as-is}

If for some reason the intercepted event needs to be left _as is_, then its handler must return exactly the same object or any _falsey_ value: _undefined, null_ or _false._

```javascript
module.exports = (testplane) => {
    testplane.intercept(testplane.events.TEST_FAIL, ({ event, data }) => {
        return { event, data };
        // or return;
        // or return null;
        // or return false;
    });

    testplane.on(testplane.events.TEST_FAIL, (test) => {
        // this handler will be called as usual,
        // because intercepting the TEST_FAIL event does not change it in any way
    });
};
```

## Ignoring an event {#ignoring-event}

To ignore an event and prevent it from propagating further, you need to return an empty object from the handler (in which the event is intercepted):

```javascript
module.exports = (testplane) => {
    testplane.intercept(testplane.events.TEST_FAIL, ({ event, data }) => {
        return {};
    });

    testplane.on(testplane.events.TEST_FAIL, (test) => {
        // this handler will never be called
    });
};
```

## Delaying event processing {#delaying-events}

The above approach with ignoring an event can be used to delay the occurrence of certain events, for example:

```javascript
module.exports = (testplane) => {
    const intercepted = [];

    testplane.intercept(testplane.events.TEST_FAIL, ({ event, data }) => {
        // collect all TEST_FAIL events
        intercepted.push({ event, data });

        // and do not let them propagate further
        return {};
    });

    testplane.on(testplane.events.END, () => {
        // after the test run is finished, trigger all accumulated TEST_FAIL events
        intercepted.forEach(({ event, data }) => testplane.emit(event, data));
    });
};
```

### Passing information between event handlers {#passing-information-between-event-handlers}

Events that are triggered in the master process and in Testplane workers cannot exchange information via global variables.

For example, this approach will not work:

```javascript
module.exports = (testplane) => {
    let flag = false;

    testplane.on(testplane.events.RUNNER_START, () => {
        flag = true;
    });

    testplane.on(testplane.events.NEW_BROWSER, () => {
        // false will be displayed because the NEW_BROWSER event
        // is triggered in the testplane worker, and RUNNER_START in the master process
        console.info(flag);
    });

    testplane.on(testplane.events.RUNNER_END, () => {
        // true will be output
        console.info(flag);
    });
};
```

But you can solve the issue like this:

```javascript
module.exports = (testplane, opts) => {
    testplane.on(testplane.events.RUNNER_START, () => {
        opts.flag = true;
    });

    testplane.on(testplane.events.NEW_BROWSER, () => {
        // true will be output because the properties in the config,
        // which have a primitive type (and the "opts" variable is part of the config),
        // are automatically passed to workers during the RUNNER_START event
        console.info(opts.flag);
    });
};
```

Or like this: see [example](./events/new_worker_process.md#usage) from the description of the [NEW_WORKER_PROCESS](./events/new_worker_process.md) event.

### Parallel execution of plugin code {#parallel-execution-of-plugin-code}

The test runner has a method `registerWorkers`, which registers the plugin code for parallel execution in Testplane workers. The method accepts the following parameters:

| **Parameter** | **Type** | **Description** |
| ------------ | ------- | ------------ |
| `workerFilepath` | String | Absolute path to the worker. |
| `exportedMethods` | String[] | List of exported methods. |

Returns an object containing asynchronous functions with names from the exported methods.

The file with the path `workerFilepath` must export an object containing asynchronous functions with names from `exportedMethods`.

#### Example {#parallel-execution-of-plugin-code-example}

Plugin code: `plugin.js`

```javascript
let workers;

module.exports = (testplane) => {
    testplane.on(testplane.events.RUNNER_START, async (runner) => {
        const workerFilepath = require.resolve('./worker');
        const exportedMethods = ['foo'];

        workers = runner.registerWorkers(workerFilepath, exportedMethods);

        // outputs FOO_RUNNER_START
        console.info(await workers.foo('RUNNER_START'));
    });

    testplane.on(testplane.events.RUNNER_END, async () => {
        // outputs FOO_RUNNER_END
    console.info(await workers.foo('RUNNER_END'));
    });
};
```

Worker code: `worker.js`

```javascript
module.exports = {
    foo: async function(event) {
        return 'FOO_' + event;
    }
};
```