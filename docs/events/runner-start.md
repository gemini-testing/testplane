# RUNNER_START {#runner-start}

**async | master**

The `RUNNER_START` event is triggered after all Testplane workers are initialized and before tests are executed. The event handler can be asynchronous: in this case, tests will start executing only after the _Promise_ returned by the event handler is resolved.

## Subscription {#subscription}

```javascript
testplane.on(testplane.events.RUNNER_START, async (runner) => {
    console.info('Processing the RUNNER_START event…');
});
```

### Handler parameters {#handler-parameters}

A reference to the runner instance is passed to the event handler. Using this instance, you can trigger various events or subscribe to them.

## Usage {#usage}

Let's say we want to automatically start an ssh tunnel when running tests and redirect all URLs in tests to the started tunnel. To do this, we can use the `RUNNER_START` and [RUNNER_END](./runner-end.md) events to open the tunnel when the runner starts and close it when the runner is finished.


```javascript
const parseConfig = require('./config');
const Tunnel = require('./lib/tunnel');

module.exports = (testplane, opts) => {
    const pluginConfig = parseConfig(opts);

    if (!pluginConfig.enabled) {
        // plugin is disabled - leave
        return;
    }

    // plugin config sets tunnel parameters:
    // host, ports, localport, retries, etc.
    const tunnel = Tunnel.create(testplane.config, pluginConfig);

    testplane.on(testplane.events.RUNNER_START, () => tunnel.open());
    testplane.on(testplane.events.RUNNER_END, () => tunnel.close());
};
```

A similar [implementation][ssh-tunneler-index] can be found in the [ssh-tunneler][ssh-tunneler] plugin.

[ssh-tunneler]: https://github.com/gemini-testing/ssh-tunneler
[ssh-tunneler-index]: https://github.com/gemini-testing/ssh-tunneler/blob/master/testplane.js
