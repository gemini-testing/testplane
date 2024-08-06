# NEW_WORKER_PROCESS {#new-worker-process}

**sync | master**

The `NEW_WORKER_PROCESS` event is triggered after a new Testplane worker is spawned. The event handler is executed synchronously.

## Subscription {#subscription}

```javascript
testplane.on(testplane.events.NEW_WORKER_PROCESS, (workerProcess) => {
    console.info('Processing the NEW_WORKER_PROCESS event…');
});
```

### Handler parameters {#handler-parameters}

A wrapper object over the spawned worker is passed to the event handler, with a single `send` method for exchanging messages.

## Usage {#usage}

The example below shows how you can use the `NEW_WORKER_PROCESS` event to organize interaction between the master process and all Testplane workers. For example, to update the value of some parameter in all Testplane workers from the master process before starting to run all tests.

The example also uses the [BEGIN](./begin.md) event.


```javascript
const masterPlugin = (testplane, opts) => {
    const workers = [];

    testplane.on(testplane.events.NEW_WORKER_PROCESS, (workerProcess) => {
        // remember references to all created testplane workers
        workers.push(workerProcess);
    });

    testplane.on(testplane.events.BEGIN, () => {
        // send the parameter value to all workers
        workers.forEach((worker) => {
            worker.send({
                type: PARAM_VALUE_UPDATED_EVENT,
                param: 'some-value'
            });
        });
    });
};

const workerPlugin = (testplane) => {
    process.on('message', ({ type, ...data }) => {
        if (type === PARAM_VALUE_UPDATED_EVENT) {
            const { param } = data;
            console.info(`Received value "${param}" for "param" from master process`);
        }
    });

// …
};

const plugin = (testplane, opts) => {
    if (testplane.isWorker()) {
        workerPlugin(testplane, opts);
    } else {
        masterPlugin(testplane, opts);
    }
};

module.exports = plugin;
```
