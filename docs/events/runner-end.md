# RUNNER_END {#runner-end}

**async | master**

The `RUNNER_END` event is triggered after the test is executed and before all workers are finished. The event handler can be asynchronous: in this case, all workers will be finished only after the _Promise_ returned by the event handler is resolved.

## Subscription {#subscription}

```javascript
testplane.on(testplane.events.RUNNER_END, async (result) => {
    console.info('Processing the RUNNER_END event…');
});
```

### Handler parameters {#handler-parameters}

An object with test run statistics of the following type is passed to the event handler:

```javascript
{
    passed: 0, // number of successfully executed tests
    failed: 0, // number of failed tests
    retries: 0, // number of retries (re-runs) of tests
    skipped: 0, // number of disabled (skipped) tests
    total: 0 // total number of tests
};
```

## Usage {#usage}

See the example in [above](./runner-start.md#usage) about opening and closing a tunnel when starting and stopping the runner.