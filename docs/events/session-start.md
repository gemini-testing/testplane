# SESSION_START {#session-start}

**async | master**

The `SESSION_START` event is triggered after the browser session is initialized. The event handler can be asynchronous: in this case, the tests will start executing only after the _Promise_ returned by the event handler is resolved.

### Subscription {#subscription}

```javascript
testplane.on(testplane.events.SESSION_START, async (browser, { browserId, sessionId }) => {
    console.info('SESSION_START event is being processed…');
});
```

### Handler parameters {#handler-parameters}

The event handler receives 2 arguments:
* the first argument is `WebdriverIO` instance;
* the second argument is an object of the form `{ browserId, sessionId }`, where _browserId_ is the browser name, and _sessionId_ is the browser session ID.

## Usage {#usage}

Let's look at an example in which a plugin subscribes to the `SESSION_START` event to disable scroll bars in browsers using the Chrome DevTools Protocol.


```javascript
const parseConfig = require('./config');
const DevTools = require('./dev-tools');

module.exports = (testplane, opts) => {
    const pluginConfig = parseConfig(opts);

    if (!pluginConfig.enabled) {
        // plugin is disabled – leave
        return;
    }

    testplane.on(testplane.events.SESSION_START, async (browser, { browserId, sessionId }) => {
        if (!pluginConfig.browsers.includes(browserId)) {
            // the browser is not in the list of browsers for which it is possible to disable scrollbars
            // via Chrome DevTools Protocol (CDP) – leave
            return;
        }

        const gridUrl = testplane.config.forBrowser(browserId).gridUrl;

        // pluginConfig.browserWSEndpoint specifies a function that should return a URL
        // to work with the browser via CDP. In order for the function to calculate the URL,
        // the session ID and a reference to the grid are passed to the function
        const browserWSEndpoint = pluginConfig.browserWSEndpoint({ sessionId, gridUrl });

        const devtools = await DevTools.create({ browserWSEndpoint });

        devtools.setScrollbarsHiddenOnNewPage();

        await devtools.hideScrollbarsOnActivePages();
    });
};
```


A more detailed [implementation][testplane-hide-scrollbars-index] can be found in the [testplane-hide-scrollbars][testplane-hide-scrollbars] plugin.

[testplane-hide-scrollbars]: https://github.com/gemini-testing/testplane-hide-scrollbars
[testplane-hide-scrollbars-index]: https://github.com/gemini-testing/testplane-hide-scrollbars/blob/master/index.js