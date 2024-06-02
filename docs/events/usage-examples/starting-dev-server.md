# Automatic launch of the dev server {#starting_dev_server}

We will implement the `testplane-dev-server` plugin for Testplane schematically, so that the dev server is automatically launched each time Testplane is launched.

Launching the dev server is optional: for this, the plugin adds a special `--dev-server` option to Testplane, allowing the developer to specify whether the dev server should be launched when Testplane is launched.

In addition, the plugin allows you to set the `devServer` parameter in your config.

This example uses the following Testplane events:
* [CLI](../cli.md)
* [INIT](../init.md)

Plugin code

```javascript
const http = require('http');
const parseConfig = require('./config');

module.exports = (testplane, opts) => {
    const pluginConfig = parseConfig(opts);

    if (!pluginConfig.enabled || testplane.isWorker()) {
        // either the plugin is disabled, or we are in the worker context - leave
        return;
    }

    let program;

    testplane.on(testplane.events.CLI, (cli) => {
        // we need to save a reference to the commander instance (https://github.com/tj/commander.js),
        // to check for the option later
        program = cli;
        // add the --dev-server option to testplane,
        // so that the user can explicitly specify when to run the dev-server
        cli.option('--dev-server', 'run dev-server');
    });

    testplane.on(testplane.events.INIT, () => {
        // the dev server can be launched either by specifying the --dev-server option
        // when launching testplane, or in the plugin settings
        const devServer = program && program.devServer || pluginConfig.devServer;

        if (!devServer) {
            // if the dev server does not need to be launched, we leave
            return;
        }

        // content that the dev server gives out
        const content = '<h1>Hello, World!</h1>';

        // create a server and start listening on port 3000
        http
            .createServer((req, res) => res.end(content))
            .listen(3000);

        // at http://localhost:3000/index.html the following will be given out: <h1>Hello, World!</h1>
    });
};
```

Testplane config

```javascript
module.exports = {
    // tests will be run in the local browser,
    // see about selenium-standalone in the "Quick start" section
    gridUrl: 'http://localhost:4444/wd/hub',
    
    // specify the path to the dev server
    baseUrl: 'http://localhost:3000',

    browsers: {
        chrome: {
            desiredCapabilities: { browserName: 'chrome' }
        }
    },

    plugins: {
        // add our plugin to the list of plugins
        'testplane-dev-server': {
            enabled: true,
            // the dev server will not start by default
            devServer: false
        },
    }
};
```

Test code

```javascript
const { assert } = require('chai');

describe('example', async () => {
    it('should find hello world', async ({ browser }) => {
        // baseUrl, relative to which index.html is set,
        // specified in the Testplane config above
        await browser.url('index.html');

        const title = await browser.$('h1').getText();
        assert.equal(title, 'Hello, World!');
    });
});
```