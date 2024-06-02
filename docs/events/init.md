# INIT

**async | master**

The `INIT` event is triggered before the `run` or `readTests tasks are executed. The event handler can be asynchronous: in this case, the tasks will start executing only after the _Promise_ returned by the event handler is resolved. The event is triggered only once, regardless of how many times the tasks are executed.

## Subscription {#subscription}

```javascript
testplane.on(testplane.events.INIT, async () => {
    console.info('Processing INIT event…');
});
```

### Handler parameters {#handler-parameters}

No data is passed to the event handler.

## Example of using {#usage}

In the `INIT` event handler, you can organize, for example, the launch of a dev server for your project.

{% note info "What is a dev server?" %}

A dev server is an [express](https://github.com/expressjs/express)-like application that allows you to develop the frontend of a project.

{% endnote %}

Below is the shortest implementation. A more detailed example can be found in the section "[Automatic launch of a dev server](./usage-examples/starting-dev-server.md)".


```javascript
const http = require('http');
const parseConfig = require('./config');

module.exports = (testplane, opts) => {
    const pluginConfig = parseConfig(opts);

    if (!pluginConfig.enabled || testplane.isWorker()) {
        // either the plugin is disabled, or we are in the worker context - leave
        return;
    }

    // ...

    testplane.on(testplane.events.INIT, () => {
        // content that the dev-server gives out
        const content = '<h1>Hello, World!</h1>';

        // create a server and start listening on port 3000
        http
            .createServer((req, res) => res.end(content))
            .listen(3000);

        // at http://localhost:3000/index.html the following will be given out: <h1>Hello, World!</h1>
    });
};
```