import { execFileSync } from "child_process";
import { randomUUID } from "crypto";
import { setTimeout as delay } from "timers/promises";
import { mkdtemp, writeFile, rm, mkdir, open } from "fs/promises";
import { createWriteStream, rmSync } from "fs";
import { Readable } from "stream";
import { pipeline } from "stream/promises";
import { tmpdir } from "os";
import path from "path";
import getPort from "get-port";
import { uniqBy } from "lodash";
import type { BrowserConfig } from "../../config/browser-config";
import type { DockerConfig } from "../../config/types";
import { getInstance } from "../../config/runtime-config";
import { AsyncCleanupStack } from "../../utils/async-cleanup-stack";
import { warn } from "../../utils/logger";
import {
    COMMAND_TIMEOUT,
    appendDockerOutput,
    docker,
    errorMessage,
    getPlatform,
    getSocketPath,
    prepareDockerImages,
    removeContainers,
} from "./engine";
import { CHECK_DEVTOOLS } from "./browser-image";
import { debugDocker, timeDockerOperation } from "./timing";

interface DockerEnvironment {
    isPodman: boolean;
    useSlirp: boolean;
    securityArgs: string[];
}

interface SelenoidOptions {
    timeout?: number;
}

interface SelenoidBrowser {
    default: string;
    versions: Record<string, DockerConfig>;
}

// Concurrency is controlled by Testplane's pools or the standalone caller.
const SELENOID_SESSION_LIMIT = 2 ** 31 - 1;
const exitCleanups = new Set<() => void>();

function cleanupOnExit(): void {
    for (const cleanup of exitCleanups) {
        cleanup();
    }
}

/** Owns the Selenoid container, its network and configuration, until the backend is disposed. */
export class SelenoidDockerController implements AsyncDisposable {
    // Owned containers, network and temporary directory
    private readonly _name: string;
    private readonly _configDir: string;
    private readonly _network: string;
    private readonly _cleanup = new AsyncCleanupStack();

    // Data
    private _browsers: Record<string, SelenoidBrowser> = {};
    private readonly _configPath: string;
    private readonly _socketPath: string;
    private readonly _selenoidPlatform: string | null;
    private readonly _selenoidImage: string;
    private readonly _containerFilter: string;
    private readonly _environment: DockerEnvironment;
    private readonly _options: Required<SelenoidOptions>;
    private _gridUrl: string | null = null;
    private _networkCreated = false;
    private _registration: Promise<unknown> = Promise.resolve();
    private _disposal: Promise<void> | null = null;

    private constructor(
        name: string,
        configDir: string,
        config: DockerConfig | null,
        selenoidImage: string,
        environment: DockerEnvironment,
        options: Required<SelenoidOptions>,
    ) {
        this._name = name;
        this._configDir = configDir;
        this._environment = environment;
        this._options = options;
        this._configPath = path.join(configDir, "browsers.json");
        this._socketPath = getSocketPath(config);
        this._selenoidPlatform = getPlatform(config, "selenoidPlatform");
        this._selenoidImage = selenoidImage;
        this._network = environment.useSlirp ? "slirp4netns:enable_ipv6=true" : `${name}-network`;
        this._containerFilter = environment.useSlirp
            ? `label=testplane.controller=${name}`
            : `network=${this._network}`;
    }

    get gridUrl(): string {
        this._assertRunning();

        return `${this._gridUrl}/wd/hub`;
    }

    static async create(
        configs: BrowserConfig[],
        { timeout = COMMAND_TIMEOUT }: SelenoidOptions = {},
    ): Promise<SelenoidDockerController> {
        if (!configs.length) {
            throw new Error("A Selenoid controller requires at least one browser.");
        }

        configs = uniqBy(configs, "id");
        const config = configs[0].docker;

        // Validate the controller choice before pulling or building anything.
        const selenoidPlatform = getPlatform(config, "selenoidPlatform");
        const socketPath = getSocketPath(config);
        for (const { docker } of configs) {
            if (docker?.selenoidImage !== config?.selenoidImage) {
                throw new Error("All Docker browsers in one controller must use the same docker.selenoidImage.");
            }
            getPlatform(docker, "platform");
            if (getPlatform(docker, "selenoidPlatform") !== selenoidPlatform) {
                throw new Error("All Docker browsers in one controller must use the same docker.selenoidPlatform.");
            }
            if (getSocketPath(docker) !== socketPath) {
                throw new Error("All Docker browsers in one controller must use the same docker.socketPath.");
            }
        }

        const name = `testplane-${randomUUID()}`;
        const prepared = await Promise.all(
            configs.map(config =>
                prepareDockerImages(config.docker, config.desiredCapabilities?.browserName ?? "", name),
            ),
        );
        const environment = await this._detectEnvironment(name);

        await using cleanup = new AsyncCleanupStack();
        const configDir = await mkdtemp(path.join(tmpdir(), "testplane-selenoid-"));
        let controller: SelenoidDockerController | null = null;
        let transferred = false;
        cleanup.defer(async () => {
            if (!transferred) {
                await (controller
                    ? controller[Symbol.asyncDispose]()
                    : rm(configDir, { recursive: true, force: true }));
            }
        });

        controller = new SelenoidDockerController(name, configDir, config, prepared[0].selenoidImage, environment, {
            timeout,
        });
        controller._cleanup.defer(() => rm(configDir, { recursive: true, force: true }));
        controller._browsers = Object.fromEntries(
            configs.map((config, index) => [config.id, controller!._getBrowserConfig(config, prepared[index].image)]),
        );
        controller._registerExitCleanup();

        try {
            controller._gridUrl = await controller._start();
            transferred = true;

            return controller;
        } catch (error) {
            const logs = await controller.getLogs().catch(() => "");

            throw new Error(
                `Cannot start Selenoid for Docker browser "${config?.image}".\n${errorMessage(error)}${
                    logs ? `\nContainer logs:\n${logs}` : ""
                }`,
            );
        }
    }

    private static async _detectEnvironment(name: string): Promise<DockerEnvironment> {
        const securityOptions = JSON.parse(
            await timeDockerOperation(name, "check container security options", () =>
                docker(["info", "--format", "{{json .SecurityOptions}}"]),
            ),
        ) as string[] | null;
        const components = JSON.parse(
            await timeDockerOperation(name, "detect container engine", () =>
                docker(["version", "--format", "{{json .Server.Components}}"]),
            ),
        ) as { Name: string }[] | null;
        const isPodman = components?.some(component => component.Name === "Podman Engine") ?? false;

        return {
            isPodman,
            // VMs need a published controller port forwarded by Docker/Podman machine.
            useSlirp: isPodman && Boolean(securityOptions?.includes("name=rootless")) && process.platform === "linux",
            // SELinux otherwise prevents access to the mounted engine socket.
            securityArgs: securityOptions?.includes("name=selinux") ? ["--security-opt", "label=disable"] : [],
        };
    }

    private async _start(): Promise<string> {
        const { useSlirp, isPodman, securityArgs } = this._environment;
        const { timeout } = this._options;

        await writeFile(this._configPath, JSON.stringify(this._browsers));

        let port: string | null = null;
        if (useSlirp) {
            port = String(await getPort({ host: "127.0.0.1" }));
        } else {
            await this._createNetwork();
        }

        // Register before creation: the CLI can time out after the daemon creates the container.
        // LIFO cleanup stops Selenoid before discovering children, so it cannot start another session.
        this._cleanup.defer(async () => removeContainers(await this._findContainers()));
        this._cleanup.defer(() => removeContainers([this._name]));
        await timeDockerOperation(this._name, "create Selenoid container", () =>
            docker([
                "create",
                "--name",
                this._name,
                ...(this._selenoidPlatform !== null ? ["--platform", this._selenoidPlatform] : []),
                "--pull",
                "never",
                ...(useSlirp ? ["--network", "host"] : ["--publish", "127.0.0.1::4444", "--network", this._network]),
                // This is the socket on the daemon's Linux host, including Docker Desktop/Colima.
                "--volume",
                `${this._socketPath}:/var/run/docker.sock`,
                ...securityArgs,
                this._selenoidImage,
                "-conf",
                "/browsers.json",
                ...(useSlirp ? ["-listen", `127.0.0.1:${port}`] : []),
                "-container-network",
                this._network,
                "-limit",
                String(SELENOID_SESSION_LIMIT),
                "-retry-count",
                "1",
                "-log-output-dir",
                "/opt/selenoid/logs",
                "-save-all-logs",
                "-disable-privileged",
                "-service-startup-timeout",
                `${timeout}ms`,
                "-session-attempt-timeout",
                `${timeout}ms`,
            ]),
        );

        // macOS temporary paths may not be shared with the VM; copy instead of mounting.
        await timeDockerOperation(this._name, "copy Selenoid config", () =>
            docker(["cp", this._configPath, `${this._name}:/browsers.json`]),
        );
        if (isPodman && !useSlirp) {
            // Selenoid needs this marker to choose browser network IPs instead of its loopback.
            await timeDockerOperation(this._name, "enable Selenoid container detection", async () => {
                const marker = path.join(this._configDir, ".dockerenv");
                await writeFile(marker, "");
                await docker(["cp", marker, `${this._name}:/.dockerenv`]);
            });
        }

        await timeDockerOperation(this._name, "start Selenoid container", () => docker(["start", this._name]));

        // Host networking uses browser ports published on loopback; leave /.dockerenv absent.
        if (!useSlirp) {
            const ports = JSON.parse(
                await docker(["inspect", "--format", "{{json .NetworkSettings.Ports}}", this._name]),
            ) as Record<string, { HostIp: string; HostPort: string }[] | null>;
            port = ports["4444/tcp"]?.find(binding => binding.HostIp === "127.0.0.1")?.HostPort ?? null;
        }

        if (!port || !/^\d+$/.test(port)) {
            throw new Error("Docker did not publish WebDriver port 4444 on 127.0.0.1.");
        }

        const gridUrl = `http://127.0.0.1:${port}`;
        await timeDockerOperation(this._name, `wait for Selenoid at ${gridUrl}`, () => this._waitUntilReady(gridUrl));

        return gridUrl;
    }

    private async _createNetwork(): Promise<void> {
        // Also clean up if the CLI times out after creating the network.
        this._networkCreated = true;
        this._cleanup.defer(async () => {
            await docker(["network", "rm", this._network]).catch(error => {
                if (!/not found|no such network/i.test(errorMessage(error))) {
                    throw error;
                }
            });
        });
        await timeDockerOperation(this._name, "create network", async () => {
            try {
                await docker(["network", "create", "--ipv6", this._network]);
            } catch (error) {
                try {
                    await docker(["network", "inspect", this._network]);

                    return;
                } catch (inspectError) {
                    if (!/no such network|network .+ not found/i.test(errorMessage(inspectError))) {
                        throw inspectError;
                    }
                }
                debugDocker(
                    `Cannot create a dual-stack Docker network; falling back to IPv4. Error: ${errorMessage(error)}`,
                );
                await docker(["network", "create", this._network]);
            }
        });
    }

    private async _waitUntilReady(gridUrl: string): Promise<void> {
        const deadline = Date.now() + this._options.timeout;
        while (Date.now() < deadline) {
            if ((await docker(["inspect", "--format", "{{.State.Running}}", this._name])) !== "true") {
                throw new Error("The Selenoid container exited before becoming ready.");
            }
            try {
                const response = await fetch(`${gridUrl}/status`, {
                    signal: AbortSignal.timeout(Math.max(1, Math.min(1000, deadline - Date.now()))),
                });
                const status = (await response.json()) as { total?: number; browsers?: object };
                if (response.ok && typeof status.total === "number" && status.total > 0 && status.browsers) {
                    return;
                }
            } catch {
                // Selenoid may not yet be listening while its entrypoint starts it.
            }
            await delay(Math.max(0, Math.min(200, deadline - Date.now())));
        }
        throw new Error(
            `Selenoid did not become ready within ${this._options.timeout} ms. Adjust sessionRequestTimeout if startup needs more time.`,
        );
    }

    ensureBrowser(config: BrowserConfig): Promise<void> {
        const pending = this._registration.then(async () => {
            this._assertRunning();

            if (!Object.hasOwn(this._browsers, config.id)) {
                await this._addBrowser(config);
            }
        });
        this._registration = pending.catch(() => null);

        return pending;
    }

    private async _addBrowser(config: BrowserConfig): Promise<void> {
        this._assertRunning();

        if (getSocketPath(config.docker) !== this._socketPath) {
            throw new Error("All Docker browsers in one controller must use the same docker.socketPath.");
        }
        if (config.docker?.selenoidImage !== this._selenoidImage) {
            throw new Error("All Docker browsers in one controller must use the same docker.selenoidImage.");
        }
        if (getPlatform(config.docker, "selenoidPlatform") !== this._selenoidPlatform) {
            throw new Error("All Docker browsers in one controller must use the same docker.selenoidPlatform.");
        }

        const { image } = await prepareDockerImages(
            config.docker,
            config.desiredCapabilities?.browserName ?? "",
            this._name,
        );
        const browser = this._getBrowserConfig(config, image);
        const browsers = { ...this._browsers, [config.id]: browser };
        await writeFile(this._configPath, JSON.stringify(browsers));

        // Never expose a partially copied config to Selenoid.
        await docker(["cp", this._configPath, `${this._name}:/browsers.next.json`]);
        await docker(["exec", this._name, "mv", "/browsers.next.json", "/browsers.json"]);
        await docker(["kill", "--signal", "HUP", this._name]);

        const deadline = Date.now() + this._options.timeout;
        while (Date.now() < deadline) {
            const response = await fetch(`${this._gridUrl}/status`, { signal: AbortSignal.timeout(1000) });
            const status = (await response.json()) as { browsers?: Record<string, Record<string, unknown>> };
            if (response.ok && status.browsers?.[config.id]?.[browser.default]) {
                this._browsers = browsers;

                return;
            }
            await delay(50);
        }

        throw new Error("Selenoid did not reload the browser configuration in time.");
    }

    private _getBrowserConfig(config: BrowserConfig, image: string): SelenoidBrowser {
        const browserConfig = { ...config.docker };
        delete browserConfig.selenoidImage;
        delete browserConfig.selenoidPlatform;
        delete browserConfig.socketPath;
        delete browserConfig.platform;

        const capabilities = config.desiredCapabilities;
        const version =
            capabilities?.browserVersion || (capabilities as { version?: string } | null)?.version || "default";

        return {
            default: version,
            versions: {
                [version]: {
                    port: "4444",
                    path: "/",
                    shmSize: 2 * 1024 ** 3,
                    // Podman supplies host.docker.internal itself.
                    hosts: this._environment.isPodman ? [] : ["host.docker.internal:host-gateway"],
                    ...browserConfig,
                    image,
                    labels: {
                        ...(browserConfig.labels as Record<string, string> | null),
                        "testplane.controller": this._name,
                    },
                },
            },
        };
    }

    extendCapabilities(
        capabilities: WebdriverIO.Capabilities,
        config: BrowserConfig,
        label: string,
    ): WebdriverIO.Capabilities {
        this._assertRunning();

        const original = capabilities["selenoid:options"];

        return {
            ...capabilities,
            "selenoid:options": {
                ...original,
                // Selenoid selects the config by ID; the driver receives the original browserName and version.
                browserName: config.id,
                version: this._browsers[config.id].default,
                labels: {
                    ...(original?.labels instanceof Map ? Object.fromEntries(original.labels) : original?.labels),
                    "testplane.session": label,
                    "testplane.controller": this._name,
                },
            } as unknown as WebdriverIO.Capabilities["selenoid:options"],
        };
    }

    async prepareCdp(sessionId: string, label: string, timeout: number): Promise<boolean> {
        const protocolUrl = `${this._gridUrl}/devtools/${encodeURIComponent(sessionId)}/json/protocol`;
        const isCdpReady = async (): Promise<boolean> => {
            try {
                const response = await fetch(protocolUrl, { signal: AbortSignal.timeout(1000) });
                const protocol = (await response.json()) as { domains?: unknown[] };

                return response.ok && Array.isArray(protocol.domains);
            } catch {
                return false;
            }
        };

        // Healthy images already provide Selenoid's CDP adapter.
        if (await timeDockerOperation(sessionId, "check native CDP route", isCdpReady)) {
            return true;
        }

        const containers = await this._findContainers(`label=testplane.session=${label}`, false);
        if (containers.length !== 1) {
            throw new Error(`Expected one browser container for CDP, found ${containers.length}.`);
        }

        const container = containers[0];
        const adapter = await docker(["exec", "--user", "0", container, "/bin/sh", "-ec", CHECK_DEVTOOLS]);
        if (adapter.trim() === "absent") {
            debugDocker(
                `Docker browser session ${sessionId} has no /usr/bin/devtools adapter; continuing without CDP.`,
            );

            return false;
        }
        if (adapter.trim() !== "present") {
            throw new Error(`Cannot check CDP adapter in container ${container}`);
        }

        await timeDockerOperation(sessionId, "wait for CDP readiness", async () => {
            const deadline = Date.now() + timeout;
            while (Date.now() < deadline) {
                if (await isCdpReady()) {
                    return;
                }
                if ((await docker(["inspect", "--format", "{{.State.Running}}", container])) !== "true") {
                    throw new Error("The browser container exited before the CDP adapter became ready.");
                }
                await delay(Math.max(0, Math.min(200, deadline - Date.now())));
            }
            throw new Error(`CDP adapter did not become ready within ${timeout} ms.`);
        });

        return true;
    }

    getLogs(): Promise<string> {
        return docker(["logs", "--tail", "100", this._name], { includeStderr: true });
    }

    async saveSessionLogs(sessionId: string, logName: string | null = null): Promise<string> {
        const url = `${this._gridUrl}/logs/${encodeURIComponent(logName || `${sessionId}.log`)}`;
        const signal = AbortSignal.timeout(COMMAND_TIMEOUT);

        // DELETE returns before Selenoid finishes saving and renaming the log file.
        const ATTEMPTS_LIMIT = 50;
        for (let attempt = 0; attempt < ATTEMPTS_LIMIT; attempt++) {
            const response = await fetch(url, { signal });
            if (response.ok && response.body) {
                const logsDir = path.join(tmpdir(), "testplane-logs");
                await mkdir(logsDir, { recursive: true });
                const logPath = path.join(logsDir, `${encodeURIComponent(sessionId)}.log`);
                await pipeline(Readable.fromWeb(response.body as never), createWriteStream(logPath, { mode: 0o600 }), {
                    signal,
                });

                return logPath;
            }
            await response.body?.cancel();
            if (response.status !== 404) {
                throw new Error(`Cannot download Selenoid session log: HTTP ${response.status}`);
            }
            await delay(100, null, { signal });
        }

        throw new Error(`Failed to download Selenoid session log after ${ATTEMPTS_LIMIT} attempts.`);
    }

    private async _saveControllerLogs(): Promise<void> {
        const logsDir = path.join(tmpdir(), "testplane-logs");
        await mkdir(logsDir, { recursive: true });
        const logPath = path.join(logsDir, `${this._name}.log`);
        await using file = await open(logPath, "w", 0o600);
        await appendDockerOutput(file, "Selenoid", ["logs", "--timestamps", this._name]);
        debugDocker(`Docker Selenoid log: ${logPath}`);
    }

    [Symbol.asyncDispose](): Promise<void> {
        this._disposal ??= this._dispose();

        return this._disposal;
    }

    private async _dispose(): Promise<void> {
        await this._registration;

        if (this._gridUrl) {
            await this._saveControllerLogs().catch(error => warn(errorMessage(error)));
        }

        await timeDockerOperation(this._name, "remove containers and network", () => this._cleanup.disposeAsync());
        exitCleanups.delete(this._removeOnExit);
        if (!exitCleanups.size) {
            process.off("exit", cleanupOnExit);
        }
    }

    private _assertRunning(): void {
        if (!this._gridUrl || this._disposal) {
            throw new Error("The Selenoid controller is not running.");
        }
    }

    private async _findContainers(filter: string | null = null, all = true): Promise<string[]> {
        const output = await docker([
            "ps",
            ...(all ? ["--all"] : []),
            "--quiet",
            "--filter",
            this._containerFilter,
            ...(filter ? ["--filter", filter] : []),
        ]);

        return output.split(/\s+/).filter(Boolean);
    }

    private _registerExitCleanup(): void {
        if (!exitCleanups.size) {
            process.once("exit", cleanupOnExit);
        }
        exitCleanups.add(this._removeOnExit);
    }

    private readonly _removeOnExit = (): void => {
        // Normal pool disposal already removed controllers without retained sessions.
        // Keep the remaining ones alive when the CLI exits, but retry failed disposal.
        if (getInstance().keepBrowserMode?.enabled && !this._disposal) {
            return;
        }

        const run = (args: string[]): string => {
            try {
                return execFileSync("docker", args, {
                    encoding: "utf8",
                    stdio: ["ignore", "pipe", "ignore"],
                    timeout: 5000,
                    windowsHide: true,
                }).trim();
            } catch {
                return "";
            }
        };
        run(["rm", "--force", this._name]);
        if (this._environment.useSlirp || this._networkCreated) {
            const containers = run(["ps", "--all", "--quiet", "--filter", this._containerFilter])
                .split(/\s+/)
                .filter(Boolean);
            if (containers.length) {
                run(["rm", "--force", ...containers]);
            }
        }
        if (this._networkCreated) {
            run(["network", "rm", this._network]);
        }

        try {
            rmSync(this._configDir, { recursive: true, force: true });
        } catch {
            // Best effort on synchronous process exit.
        }
    };
}
