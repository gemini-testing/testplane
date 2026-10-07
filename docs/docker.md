# Browsers in Docker

Set `gridUrl: "docker"`, specify a browser image, and set `docker.selenoidImage` globally or per browser:

```js
module.exports = {
    gridUrl: "docker",
    docker: { selenoidImage: "registry.yandex.net/search-interfaces/selenoid:1.11.3-d496072" },
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

`docker.image` must be a Selenoid-compatible image. Testplane copies the `docker` object, except `selenoidImage`, into the browser version entry in `browsers.json`, replacing `image` with the prepared local image. Set `path`, `port`, `shmSize`, `tmpfs`, `volumes`, and other Selenoid container settings there. Omitted settings default to `port: "4444"`, `path: "/"`, `shmSize: 2147483648` (2 GiB), and `hosts: ["host.docker.internal:host-gateway"]`; explicit values replace these defaults. The path does not depend on the browser name: specify `path: "/wd/hub"` for images that need it, including the Firefox images discussed here.

Set `docker.selenoidImage` to choose the Selenoid controller image. A browser-specific value takes precedence over the top-level `docker.selenoidImage`, even when the browser defines its own `docker.image`. There is no default: if neither is set, or the resolved value is empty or invalid, Docker browser startup fails before pulling images or creating containers. The controller image must support Selenoid's existing Docker configuration and command-line options and target `linux/amd64`; missing images are pulled automatically. This field is not passed to `browsers.json`.

```js
module.exports = {
    gridUrl: "docker",
    docker: { selenoidImage: "registry.example.com/selenoid:shared" },
    browsers: {
        chrome: {
            docker: { image: "registry.example.com/browsers/chrome:149.1" },
            desiredCapabilities: { browserName: "chrome" },
        },
        firefox: {
            docker: {
                image: "registry.example.com/browsers/firefox:148.0",
                selenoidImage: "registry.example.com/selenoid:custom",
                path: "/wd/hub",
            },
            desiredCapabilities: { browserName: "firefox" },
        },
    },
};
```

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

Before running Docker browsers, Testplane reads the Docker daemon's CPU count and fails if configured Docker parallelism exceeds `floor(CPUs * 10 / 8)` (10 browsers for 8 CPUs). Parallelism is the sum of `sessionsPerBrowser` for the selected Docker browsers, capped by `system.parallelLimit`. Reduce either limit or allocate more CPUs to Docker to proceed. Failure to determine the CPU count also stops the run. Remote and native local browsers are excluded, and `--local` skips the check.

Docker sessions use the standard transport selection: WSDriver is used when `useWsDriver` is enabled and the server advertises `se:wsdriver` with version `1` in `se:wsdriverVersion`; otherwise commands use HTTP WebDriver. CDP is initialized independently of `gridUrl`, using the usual endpoint selection (`browserWSEndpoint`, `se:cdp`, or the browser debugger address).

For Chrome containers, Testplane uses Selenoid's existing CDP route and the browser image's native `/usr/bin/devtools` adapter on port `7070`. The adapter connects to Chrome's internal debugger socket; the published Selenoid port remains bound to `127.0.0.1`. No Testplane Python proxy is started.

Before creating sessions, Testplane builds a local derived browser image named `testplane-browser:<hash>`. If `/usr/bin/devtools` is UPX-packed, the build installs `upx-ucl` (unless already installed), unpacks the executable in place, and verifies that it runs. This avoids the packed executable's crash under Rosetta. Images without this adapter skip the preparation commands. The original image is unchanged; its entrypoint, command and user are preserved in the derived image. Its normal entrypoint starts the repaired adapter.

Unpacking a packed adapter during the first build requires an apt-based image with `upx-ucl` available and network access to its package repositories, unless UPX is already installed. The build has a ten-minute timeout. Subsequent sessions use the prepared image directly: no apt, UPX checks, binary copying or separate adapter startup takes place in browser containers. The image name depends on the source image's immutable ID and the preparation recipe, so a changed source image or recipe produces a new image. Workers share a build lock and reuse the finished image. Timing logs report image preparation, build time and lock waits.

Prepared images remain in Docker's local image store until explicitly removed (for example, with `docker image rm <prepared-image>`). The next run rebuilds a removed image. There is no host filesystem cache of executables; the former `~/.testplane/docker-devtools` directory is no longer read or written and can be deleted. Temporary Dockerfiles and build locks are cleaned up after preparation. CDP session preparation only waits for the native route to become ready; explicit `browserWSEndpoint` settings skip this wait.

### Logs and timings

Before deleting a Docker session, Testplane saves a snapshot of the full available Selenoid and browser container output (including the native CDP adapter output) to `<os.tmpdir()>/testplane-logs/<session_id>.log` and prints the file path. Unlike the shortened diagnostics attached to startup errors, this file is not limited to the last 100 lines or 16 KiB. It survives container cleanup and is saved for successful runs, test failures, normal interruption, and initialization failures after a session ID has been assigned. Saving errors produce a warning and do not prevent cleanup. No session file is created if session creation fails before returning an ID; SIGKILL cannot trigger log collection. These files remain until removed manually or by the operating system's temporary-file cleanup.

Docker operations print `[Docker timing][<container/session>]` messages before starting and after finishing, with duration in seconds or time until failure. Timings cover image preparation and pulls, network and Selenoid startup, WebDriver session creation, local image builds and CDP readiness, CDP connection, isolation, session preparation, calibration, browser utilities, log saving, and cleanup. Container names, grid addresses, and session IDs distinguish concurrent launches. Nested timings overlap and should not be summed.

Selenoid readiness uses `sessionRequestTimeout`, falling back to `httpTimeout`; the same value is passed to Selenoid for browser startup and session creation. Startup and session creation errors include the last Selenoid log lines and saved browser logs, collected before cleanup. If the browser service has not become ready, Testplane also reads Docker logs directly from up to four containers of the selected image in the session network (last 100 lines, capped at 16,384 characters per container). Saved browser log output is limited to four files and the last 16 KiB of each file. Docker commands have a separate 30-second timeout; image downloads have a 10-minute timeout.

The application may run on the host. Use `host.docker.internal` in URLs accessed by the browser and bind the application server to an interface reachable from Docker (usually `0.0.0.0`). Inside the browser container, `localhost` refers to that container. This mode requires a local Docker daemon; remote Docker contexts are not supported.

`gridUrl` can also be set per browser to mix Docker, remote grids, and native local browsers. `--local` overrides the Docker mode and uses a browser on the host. The standalone `launchBrowser` API accepts the same `gridUrl` and `docker` options.
