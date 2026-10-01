# Browsers in Docker

Set `gridUrl: "docker"` and specify a `docker` object for each browser:

```js
module.exports = {
    gridUrl: "docker",
    baseUrl: "http://host.docker.internal:3000",
    browsers: {
        chrome: {
            docker: { image: "registry.example.com/browsers/chrome:98.0", path: "/", port: "4444" },
            desiredCapabilities: { browserName: "chrome", browserVersion: "98.0" },
        },
    },
};
```

Install Docker and start the local Docker daemon. For a private registry, authenticate with `docker login` first, then run:

```sh
npx testplane
```

Testplane uses `linux/amd64` browser images and starts them through Selenoid. If either image is missing locally, Testplane runs `docker pull --platform linux/amd64` automatically. Parallel sessions share each download; existing local images are not refreshed. On Apple Silicon, Docker must support AMD64 emulation; startup may take longer. Missing Docker, an unavailable daemon, a failed download, and an incompatible image platform produce separate errors. A missing or empty `docker.image` is rejected when starting the browser, not when loading the config.

`docker.image` must be a Selenoid-compatible image. Testplane copies the `docker` object into the browser version entry in `browsers.json`. Set `path`, `port`, `shmSize`, `tmpfs`, `volumes`, and other Selenoid container settings there. Omitted settings default to `port: "4444"`, `path: "/"`, `shmSize: 2147483648` (2 GiB), and `hosts: ["host.docker.internal:host-gateway"]`; explicit values replace these defaults. The path does not depend on the browser name: specify `path: "/wd/hub"` for images that need it, including the Firefox images discussed here.

`tmpfs` maps container paths to mount options, for example `tmpfs: { "/tmp": "size=512m" }`.

For example, an Android/Appium container can use:

```js
docker: {
    image: "registry.example.com/browsers/android:15",
    path: "/wd/hub",
    port: "4723",
    shmSize: 7516192768,
    volumes: ["/tmp/.X11-unix:/tmp/.X11-unix"],
}
```

Volume source paths refer to the Docker daemon's host (the Linux VM when using Docker Desktop or Colima). The controller still listens on port `4444`; `docker.port` selects the WebDriver port inside the browser container.

Testplane selects the entry using `desiredCapabilities.browserName` and the requested browser version. When `browserName` is absent, Testplane uses `appium:deviceName`, falling back to `deviceName`, to match Selenoid routing. If none is set, it uses an empty configuration key. These routing names are not injected into the capabilities sent to Appium. When no version is specified, Selenoid uses the configured image as the default.

Each WebDriver session gets an isolated Selenoid controller and Docker network. Testplane mounts the daemon's `/var/run/docker.sock` into Selenoid, copies in the generated config, and connects to `/wd/hub` on a dynamically allocated host port bound to `127.0.0.1`. Selenoid starts the browser container with its standard environment and privileges; the browser gets 2 GiB of shared memory unless overridden by `docker.shmSize`. Existing Testplane session reuse and parallelism settings apply.

Docker sessions use the standard transport selection: WSDriver is used when `useWsDriver` is enabled and the server advertises `se:wsdriver` with version `1` in `se:wsdriverVersion`; otherwise commands use HTTP WebDriver. CDP is initialized independently of `gridUrl`, using the usual endpoint selection (`browserWSEndpoint`, `se:cdp`, or the browser debugger address).

For Chrome containers, Testplane checks the CDP route exposed by Selenoid. If the image does not provide a CDP adapter on port `7070`, Testplane starts a Python proxy inside the browser container using `docker exec`. The image must include `python3`; only Python's standard library is used. No additional image or container is needed. The proxy connects to Chrome's actual debugger port from the session capabilities, resolves the browser WebSocket path, and exposes it through Selenoid's existing port. It stops when the browser container is removed. CDP isolation and selectivity can use this connection; explicit `browserWSEndpoint` settings still take precedence.

When a session closes, Testplane removes the controller, any remaining containers in its network, the network, and the temporary config. Cleanup also runs after failed session creation and normal interruption. On forced process exit, cleanup is best effort; SIGKILL or an unavailable daemon can leave resources behind. Controllers and networks have names starting with `testplane-`.

Before deleting a Docker session, Testplane saves a snapshot of the full available Selenoid and browser container output, plus the CDP proxy log, to `<os.tmpdir()>/testplane-logs/<session_id>.log` and prints the file path. Unlike the shortened diagnostics attached to startup errors, this file is not limited to the last 100 lines or 16 KiB. It survives container cleanup and is saved for successful runs, test failures, normal interruption, and initialization failures after a session ID has been assigned. Saving errors produce a warning and do not prevent cleanup. No session file is created if session creation fails before returning an ID; SIGKILL cannot trigger log collection. These files remain until removed manually or by the operating system's temporary-file cleanup.

Selenoid readiness uses `sessionRequestTimeout`, falling back to `httpTimeout`; the same value is passed to Selenoid for browser startup and session creation. Startup and session creation errors include the last Selenoid log lines and saved browser logs, collected before cleanup. If the browser service has not become ready, Testplane also reads Docker logs directly from up to four containers of the selected image in the session network (last 100 lines, capped at 16,384 characters per container). Saved browser log output is limited to four files and the last 16 KiB of each file. Docker commands have a separate 30-second timeout; image downloads have a 10-minute timeout.

The application may run on the host. Use `host.docker.internal` in URLs accessed by the browser and bind the application server to an interface reachable from Docker (usually `0.0.0.0`). Inside the browser container, `localhost` refers to that container. This mode requires a local Docker daemon; remote Docker contexts are not supported.

`gridUrl` can also be set per browser to mix Docker, remote grids, and native local browsers. `--local` overrides the Docker mode and uses a browser on the host. The standalone `launchBrowser` API accepts the same `gridUrl` and `docker` options.
