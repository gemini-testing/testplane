# BEGIN {#begin}

**sync | master**

The `BEGIN` event is triggered before the test is executed, but after all runners are initialized. The event handler is executed synchronously.

## Subscription {#subscription}

```javascript
testplane.on(testplane.events.BEGIN, () => {
console.info('Handling the BEGIN event…');
});
```

### Handler parameters {#handler-parameters}

No data is passed to the event handler.

## Usage {#usage}

See the example in [NEW_WORKER_PROCESS](./new-worker-process.md#usage) about organizing the interaction of the Testplane master process with all workers.