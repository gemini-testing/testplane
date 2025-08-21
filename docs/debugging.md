<!-- DOCTOC SKIP -->
## Debugging

### Tracing

Testpalne supports [OpenTelemetry](https://opentelemetry.io) standard for tracing. A randomly generated `traceparent` header is added to all requests. It is generated according to [w3c](https://www.w3.org/TR/trace-context/#traceparent-header) specification.

You can use `traceparent` to trace the execution of individual tests.

### Keep Browser for Debugging

Testplane provides CLI options to keep browser sessions alive after test completion for debugging purposes. This feature has two main use cases:

1. **Local debugging**: After test fails, you can still interact with the browser and see what's wrong
2. **AI agents integration**: Let AI agents run tests to perform complex logic (e.g. custom authentication), then attach to browser via MCP and perform additional actions

#### Why not REPL?

While REPL mode pauses test execution for interactive debugging, keep-browser options preserve the final browser state after tests finish. For AI agents, it's much easier to say "write test with the same beforeEach as in this file and run it to prepare browser" rather than forcing AI to use REPL interactively.

#### `--keep-browser`

Keep browser session alive after test completion for debugging.

```bash
npx testplane --keep-browser --browser chrome tests/login.test.js
```

#### `--keep-browser-on-fail`

Keep browser session alive only when test fails for debugging.

```bash
npx testplane --keep-browser-on-fail --browser chrome tests/login.test.js
```

**Note**: These options work only when running a single test in a single browser.

#### Session Information

When a browser is kept alive, Testplane outputs a message with session information for programmatic access:

```
Testplane run has finished, but the browser won't be closed, because you passed the --keep-browser argument.
You may attach to this browser using the following capabilities:
{
    "sessionId": "abc123...",
    "capabilities": {
        "browserName": "chrome",
        "debuggerAddress": "127.0.0.1:9222"
    },
    "sessionOptions": {
        "hostname": "127.0.0.1",
        "port": 4444,
        "path": "/wd/hub",
        "protocol": "http"
    }
}
```

#### Attaching to Kept Session

You can use the outputted session information to attach to the kept browser through:

- **MCP (Model Context Protocol)** tools that support WebDriver session attachment
- **CDP (Chrome DevTools Protocol)** using the `debuggerAddress` from capabilities
- **Direct WebDriver** connection using the session ID and connection details
- **Custom automation tools** that can reuse existing browser sessions 
