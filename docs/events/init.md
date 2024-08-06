# INIT

**async | master**

The `INIT` event is triggered before the `run` or `readTests` tasks are executed. The event handler can be asynchronous: in this case, the tasks will start executing only after the _Promise_ returned by the event handler is resolved. The event is triggered only once, regardless of how many times the tasks are executed.

## Subscription {#subscription}

```javascript
testplane.on(testplane.events.INIT, async () => {
    console.info('Processing INIT event…');
});
```

### Handler parameters {#handler-parameters}

No data is passed to the event handler.

## Example of using {#usage}

In the `INIT` event handler, you can do something at the initialization stage.

```javascript
const parseConfig = require('./config');

module.exports = (testplane, opts) => {
    const pluginConfig = parseConfig(opts);

    if (!pluginConfig.enabled || testplane.isWorker()) {
        // either the plugin is disabled, or we are in the worker context - leave
        return;
    }

    testplane.on(testplane.events.INIT, () => {
        // do something
    });
};
```