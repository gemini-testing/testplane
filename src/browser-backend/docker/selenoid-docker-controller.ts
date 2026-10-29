import { execFileSync } from "child_process";
import { randomUUID } from "crypto";
import { setTimeout as delay } from "timers/promises";
import { mkdtemp, writeFile, rm, mkdir, readdir, open } from "fs/promises";
import { rmSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import getPort from "get-port";
import type { DockerConfig } from "../../config/types";
import { AsyncCleanupStack } from "../../utils/async-cleanup-stack";
import { log, warn } from "../../utils/logger";
import type { DockerBrowserEntry, DockerController, DockerSession } from "./controller";
import {
    COMMAND_TIMEOUT,
    appendDockerOutput,
    docker,
    errorMessage,
    getPlatform,
    getSocketPath,
    prepareDockerImages,
    removeContainers,
} from "./docker";
import { CHECK_DEVTOOLS } from "./docker-image";
import { timeDockerOperation } from "./docker-timing";

interface PreparedBrowser extends DockerBrowserEntry {
    image: string;
    selenoidImage: string;
}

interface DockerEnvironment {
    isPodman: boolean;
    useSlirp: boolean;
    securityArgs: string[];
}

interface SelenoidOptions {
    timeout?: number;
    limit?: number;
}

const exitCleanups = new Set<() => void>();

function cleanupOnExit(): void {
    for (const cleanup of exitCleanups) cleanup();
}

export class SelenoidDockerController implements DockerController {
    private readonly browsers: Record<string, { default: string; versions: Record<string, DockerConfig> }> = {};
    private readonly configPath: string;
    private readonly socketPath: string;
    private readonly selenoidPlatform: string;
    private readonly selenoidImage: string;
    private readonly preparedImage: string;
    private readonly network: string;
    private readonly containerFilter: string;
    private gridUrl!: string;
    private networkCreated = false;
    private shared = false;
    private closed = false;
    private removal: Promise<void> | null = null;
    private stopping: Promise<void> | null = null;
    private cleanup = new AsyncCleanupStack();

    private constructor(
        private readonly name: string,
        private readonly configDir: string,
        prepared: PreparedBrowser[],
        private readonly environment: DockerEnvironment,
        private readonly options: Required<SelenoidOptions>,
    ) {
        const first = prepared[0];
        this.configPath = path.join(configDir, "browsers.json");
        this.socketPath = getSocketPath(first.config);
        this.selenoidPlatform = getPlatform(first.config, "selenoidPlatform");
        this.selenoidImage = first.selenoidImage;
        this.preparedImage = first.image;
        this.network = environment.useSlirp ? "slirp4netns:enable_ipv6=true" : `${name}-network`;
        this.containerFilter = environment.useSlirp ? `label=testplane.controller=${name}` : `network=${this.network}`;
        prepared.forEach(entry => this.addEntry(entry, entry.image));
    }

    static async create(
        entries: DockerBrowserEntry[],
        { timeout = COMMAND_TIMEOUT, limit = 1 }: SelenoidOptions = {},
    ): Promise<SelenoidDockerController> {
        if (!entries.length) throw new Error("A Selenoid controller requires at least one browser.");
        const config = entries[0].config;
        // Validate the controller choice before pulling or building anything.
        const selenoidPlatform = getPlatform(config, "selenoidPlatform");
        const socketPath = getSocketPath(config);
        for (const entry of entries) {
            if (entry.config?.selenoidImage !== config?.selenoidImage) {
                throw new Error("All Docker browsers in one controller must use the same docker.selenoidImage.");
            }
            getPlatform(entry.config, "platform");
            if (getPlatform(entry.config, "selenoidPlatform") !== selenoidPlatform) {
                throw new Error("All Docker browsers in one controller must use the same docker.selenoidPlatform.");
            }
            if (getSocketPath(entry.config) !== socketPath) {
                throw new Error("All Docker browsers in one controller must use the same docker.socketPath.");
            }
        }

        const name = `testplane-${randomUUID()}`;
        const prepared = await Promise.all(
            entries.map(async entry => ({
                ...entry,
                ...(await prepareDockerImages(entry.config, entry.browserName, name)),
            })),
        );
        const environment = await this.detectEnvironment(name);
        await using cleanup = new AsyncCleanupStack();
        const configDir = await mkdtemp(path.join(tmpdir(), "testplane-selenoid-"));
        let controller: SelenoidDockerController | null = null;
        cleanup.defer(() => (controller ? controller.remove() : rm(configDir, { recursive: true, force: true })));
        controller = new SelenoidDockerController(name, configDir, prepared, environment, { timeout, limit });
        controller.registerExitCleanup();
        try {
            await controller.start();
            controller.cleanup = cleanup.move();
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

    private static async detectEnvironment(name: string): Promise<DockerEnvironment> {
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

    private async start(): Promise<void> {
        const { useSlirp, isPodman, securityArgs } = this.environment;
        const { timeout, limit } = this.options;
        await writeFile(this.configPath, JSON.stringify(this.browsers));
        let port: string | null = null;
        if (useSlirp) {
            port = String(await getPort({ host: "127.0.0.1" }));
        } else {
            await this.createNetwork();
        }
        await timeDockerOperation(this.name, "create Selenoid container", () =>
            docker([
                "create",
                "--name",
                this.name,
                "--platform",
                this.selenoidPlatform,
                "--pull",
                "never",
                ...(useSlirp ? ["--network", "host"] : ["--publish", "127.0.0.1::4444", "--network", this.network]),
                // This is the socket on the daemon's Linux host, including Docker Desktop/Colima.
                "--volume",
                `${this.socketPath}:/var/run/docker.sock`,
                ...securityArgs,
                this.selenoidImage,
                "-conf",
                "/browsers.json",
                ...(useSlirp ? ["-listen", `127.0.0.1:${port}`] : []),
                "-container-network",
                this.network,
                "-limit",
                String(limit),
                "-retry-count",
                "1",
                "-capture-driver-logs",
                "-disable-privileged",
                "-service-startup-timeout",
                `${timeout}ms`,
                "-session-attempt-timeout",
                `${timeout}ms`,
            ]),
        );
        // macOS temporary paths may not be shared with the VM; copy instead of mounting.
        await timeDockerOperation(this.name, "copy Selenoid config", () =>
            docker(["cp", this.configPath, `${this.name}:/browsers.json`]),
        );
        if (isPodman && !useSlirp) {
            // Selenoid needs this marker to choose browser network IPs instead of its loopback.
            await timeDockerOperation(this.name, "enable Selenoid container detection", async () => {
                const marker = path.join(this.configDir, ".dockerenv");
                await writeFile(marker, "");
                await docker(["cp", marker, `${this.name}:/.dockerenv`]);
            });
        }
        await timeDockerOperation(this.name, "start Selenoid container", () => docker(["start", this.name]));

        // Host networking uses browser ports published on loopback; leave /.dockerenv absent.
        if (!useSlirp) {
            const ports = JSON.parse(
                await docker(["inspect", "--format", "{{json .NetworkSettings.Ports}}", this.name]),
            ) as Record<string, { HostIp: string; HostPort: string }[] | null>;
            port = ports["4444/tcp"]?.find(binding => binding.HostIp === "127.0.0.1")?.HostPort ?? null;
        }
        if (!port || !/^\d+$/.test(port)) {
            throw new Error("Docker did not publish WebDriver port 4444 on 127.0.0.1.");
        }
        this.gridUrl = `http://127.0.0.1:${port}`;
        await timeDockerOperation(this.name, `wait for Selenoid at ${this.gridUrl}`, () => this.waitUntilReady());
    }

    private async createNetwork(): Promise<void> {
        // Also clean up if the CLI times out after creating the network.
        this.networkCreated = true;
        await timeDockerOperation(this.name, "create network", async () => {
            try {
                await docker(["network", "create", "--ipv6", this.network]);
            } catch (error) {
                try {
                    await docker(["network", "inspect", this.network]);
                    return;
                } catch (inspectError) {
                    if (!/no such network|network .+ not found/i.test(errorMessage(inspectError))) throw inspectError;
                }
                warn(`Cannot create a dual-stack Docker network; falling back to IPv4.\n${errorMessage(error)}`);
                await docker(["network", "create", this.network]);
            }
        });
    }

    private async waitUntilReady(): Promise<void> {
        const deadline = Date.now() + this.options.timeout;
        while (Date.now() < deadline) {
            if ((await docker(["inspect", "--format", "{{.State.Running}}", this.name])) !== "true") {
                throw new Error("The Selenoid container exited before becoming ready.");
            }
            try {
                const response = await fetch(`${this.gridUrl}/status`, {
                    signal: AbortSignal.timeout(Math.max(1, Math.min(1000, deadline - Date.now()))),
                });
                const status = (await response.json()) as { total?: number; browsers?: object };
                if (response.ok && typeof status.total === "number" && status.total > 0 && status.browsers) return;
            } catch {
                // Selenoid may not yet be listening while its entrypoint starts it.
            }
            await delay(Math.max(0, Math.min(200, deadline - Date.now())));
        }
        throw new Error(
            `Selenoid did not become ready within ${this.options.timeout} ms. Adjust sessionRequestTimeout if startup needs more time.`,
        );
    }

    async addBrowser(entry: DockerBrowserEntry): Promise<void> {
        this.assertRunning();
        if (getSocketPath(entry.config) !== this.socketPath) {
            throw new Error("All Docker browsers in one controller must use the same docker.socketPath.");
        }
        if (entry.config?.selenoidImage !== this.selenoidImage) {
            throw new Error("All Docker browsers in one controller must use the same docker.selenoidImage.");
        }
        if (getPlatform(entry.config, "selenoidPlatform") !== this.selenoidPlatform) {
            throw new Error("All Docker browsers in one controller must use the same docker.selenoidPlatform.");
        }
        const { image } = await prepareDockerImages(entry.config, entry.browserName, this.name);
        this.addEntry(entry, image);
        await writeFile(this.configPath, JSON.stringify(this.browsers));
        // Never expose a partially copied config to Selenoid.
        await docker(["cp", this.configPath, `${this.name}:/browsers.next.json`]);
        await docker(["exec", this.name, "mv", "/browsers.next.json", "/browsers.json"]);
        await docker(["kill", "--signal", "HUP", this.name]);
        const deadline = Date.now() + this.options.timeout;
        while (Date.now() < deadline) {
            const response = await fetch(`${this.gridUrl}/status`, { signal: AbortSignal.timeout(1000) });
            const status = (await response.json()) as { browsers?: Record<string, Record<string, unknown>> };
            if (response.ok && status.browsers?.[entry.browserName]?.[entry.browserVersion]) return;
            await delay(50);
        }
        throw new Error("Selenoid did not reload the browser configuration in time.");
    }

    private addEntry(entry: DockerBrowserEntry, image: string): void {
        const browserConfig = { ...entry.config };
        delete browserConfig.selenoidImage;
        delete browserConfig.selenoidPlatform;
        delete browserConfig.socketPath;
        delete browserConfig.platform;
        this.browsers[entry.browserName] ??= { default: entry.browserVersion, versions: {} };
        this.browsers[entry.browserName].versions[entry.browserVersion] = {
            port: "4444",
            path: "/",
            shmSize: 2 * 1024 ** 3,
            // Podman supplies host.docker.internal itself.
            hosts: this.environment.isPodman ? [] : ["host.docker.internal:host-gateway"],
            ...browserConfig,
            image,
        };
        if (this.environment.useSlirp) {
            this.browsers[entry.browserName].versions[entry.browserVersion].labels = {
                ...(browserConfig.labels as Record<string, string> | null),
                "testplane.controller": this.name,
            };
        }
    }

    allocateSession(version: string, timeout: number): DockerSession {
        this.assertRunning();
        this.shared = true;
        const image = Object.values(this.browsers)
            .map(browser => browser.versions[version]?.image)
            .find(Boolean);
        if (!image) throw new Error(`Unknown Docker browser route: ${version}`);
        const label = randomUUID();
        let sessionId: string | null = null;
        let released: Promise<void> | null = null;
        return {
            gridUrl: `${this.gridUrl}/wd/hub`,
            [Symbol.asyncDispose]: (): Promise<void> => {
                released ??= this.releaseSession(sessionId, label).catch(error => {
                    released = null;
                    throw error;
                });
                return released;
            },
            setSessionId: (id): void => {
                sessionId = id;
            },
            extendCapabilities: (capabilities): WebdriverIO.Capabilities => {
                const original = capabilities["selenoid:options"];
                return {
                    ...capabilities,
                    "selenoid:options": {
                        ...original,
                        version,
                        logName: `${label}.log`,
                        labels: {
                            ...(original?.labels instanceof Map
                                ? Object.fromEntries(original.labels)
                                : original?.labels),
                            "testplane.session": label,
                        },
                    } as unknown as WebdriverIO.Capabilities["selenoid:options"],
                };
            },
            getLogs: () => this.getLogs(label),
            saveLogs: id => this.saveLogs(id, label, image),
            prepareCdp: id => this.prepareCdp(id, label, timeout),
        };
    }

    private async releaseSession(sessionId: string | null, label: string): Promise<void> {
        // A failed client DELETE must not leave Selenoid's slot occupied.
        if (sessionId) {
            await fetch(`${this.gridUrl}/wd/hub/session/${encodeURIComponent(sessionId)}`, {
                method: "DELETE",
                signal: AbortSignal.timeout(COMMAND_TIMEOUT),
            })
                .then(response => {
                    if (!response.ok && response.status !== 404) {
                        throw new Error(`Selenoid session deletion returned ${response.status}`);
                    }
                })
                .catch(error => warn(errorMessage(error)));
        }
        const containers = (
            await docker([
                "ps",
                "--all",
                "--quiet",
                "--filter",
                this.containerFilter,
                "--filter",
                `label=testplane.session=${label}`,
            ])
        )
            .split(/\s+/)
            .filter(Boolean);
        await removeContainers(containers);
    }

    private async prepareCdp(sessionId: string, label: string, timeout: number): Promise<boolean | void> {
        const protocolUrl = `${this.gridUrl}/devtools/${encodeURIComponent(sessionId)}/json/protocol`;
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
        if (await timeDockerOperation(sessionId, "check native CDP route", isCdpReady)) return;
        const containers = (
            await docker([
                "ps",
                "--quiet",
                "--filter",
                this.containerFilter,
                "--filter",
                `label=testplane.session=${label}`,
            ])
        )
            .split(/\s+/)
            .filter(Boolean);
        if (containers.length !== 1) {
            throw new Error(`Expected one browser container for CDP, found ${containers.length}.`);
        }
        const container = containers[0];
        const adapter = await docker(["exec", "--user", "0", container, "/bin/sh", "-ec", CHECK_DEVTOOLS]);
        if (adapter.trim() === "absent") {
            warn(`Docker browser session ${sessionId} has no /usr/bin/devtools adapter; continuing without CDP.`);
            return false;
        }
        if (adapter.trim() !== "present") throw new Error(`Cannot check CDP adapter in container ${container}`);
        await timeDockerOperation(sessionId, "wait for CDP readiness", async () => {
            const deadline = Date.now() + timeout;
            while (Date.now() < deadline) {
                if (await isCdpReady()) return;
                if ((await docker(["inspect", "--format", "{{.State.Running}}", container])) !== "true") {
                    throw new Error("The browser container exited before the CDP adapter became ready.");
                }
                await delay(Math.max(0, Math.min(200, deadline - Date.now())));
            }
            throw new Error(`CDP adapter did not become ready within ${timeout} ms.`);
        });
    }

    private async getLogs(label: string | null = null): Promise<string> {
        const controllerLogs = await docker(["logs", "--tail", "100", this.name], { includeStderr: true }).catch(
            () => "",
        );
        const driverLogs: string[] = [];
        if (this.environment.useSlirp || this.networkCreated) {
            const containers = await docker([
                "ps",
                "--all",
                "--quiet",
                "--filter",
                this.containerFilter,
                "--filter",
                label ? `label=testplane.session=${label}` : `ancestor=${this.preparedImage}`,
            ]).catch(() => "");
            for (const container of containers.split(/\s+/).filter(Boolean).slice(0, 4)) {
                const logs = await docker(["logs", "--tail", "100", container], { includeStderr: true }).catch(
                    () => "",
                );
                if (logs) driverLogs.push(`Browser container log (${container}):\n${logs.slice(-16384)}`);
            }
        }
        try {
            const logsDir = path.join(this.configDir, "logs", label || "controller");
            await mkdir(logsDir, { recursive: true });
            await docker(["cp", `${this.name}:/opt/selenoid/logs/${label ? `${label}.log` : "."}`, logsDir]);
            const files = (await readdir(logsDir, { withFileTypes: true })).filter(
                file => file.isFile() && (!label || file.name === `${label}.log`),
            );
            for (const file of files.slice(-4)) {
                await using handle = await open(path.join(logsDir, file.name), "r");
                const { size } = await handle.stat();
                const buffer = Buffer.alloc(Math.min(size, 16384));
                const { bytesRead } = await handle.read(buffer, 0, buffer.length, Math.max(0, size - buffer.length));
                driverLogs.push(`Browser log (${file.name}):\n${buffer.subarray(0, bytesRead).toString()}`);
            }
        } catch {
            // Startup can fail before Selenoid creates any browser logs.
        }
        return [controllerLogs, ...driverLogs].filter(Boolean).join("\n");
    }

    private async saveLogs(sessionId: string, label: string, image: string): Promise<string> {
        const logsDir = path.join(tmpdir(), "testplane-logs");
        await mkdir(logsDir, { recursive: true });
        const logPath = path.join(logsDir, `${encodeURIComponent(sessionId)}.log`);
        await using file = await open(logPath, "w", 0o600);
        await file.appendFile(`Session: ${sessionId}\nImage: ${image}\nSaved: ${new Date().toISOString()}\n`);
        await file.appendFile(`Selenoid log: ${path.join(logsDir, `${this.name}.log`)}\n`);
        const containers = (
            await docker([
                "ps",
                "--all",
                "--quiet",
                "--filter",
                this.containerFilter,
                "--filter",
                `label=testplane.session=${label}`,
            ])
        )
            .split(/\s+/)
            .filter(Boolean);
        for (const container of containers) {
            await appendDockerOutput(file, `Browser container ${container}`, ["logs", "--timestamps", container]);
        }
        return logPath;
    }

    private async saveControllerLogs(): Promise<void> {
        const logsDir = path.join(tmpdir(), "testplane-logs");
        await mkdir(logsDir, { recursive: true });
        const logPath = path.join(logsDir, `${this.name}.log`);
        await using file = await open(logPath, "w", 0o600);
        await appendDockerOutput(file, "Selenoid", ["logs", "--timestamps", this.name]);
        log(`Docker Selenoid log: ${logPath}`);
    }

    [Symbol.asyncDispose](): Promise<void> {
        this.closed = true;
        this.stopping ??= (async (): Promise<void> => {
            if (this.shared) await this.saveControllerLogs().catch(error => warn(errorMessage(error)));
            // Disposal consumes the stack even on failure; retry the removal itself next time.
            if (this.cleanup.disposed) await this.remove();
            else await this.cleanup.disposeAsync();
        })().catch(error => {
            this.stopping = null;
            throw error;
        });
        return this.stopping;
    }

    private assertRunning(): void {
        if (this.closed) throw new Error("The Selenoid controller is disposed.");
    }

    private remove(): Promise<void> {
        this.removal ??= timeDockerOperation(this.name, "remove containers and network", () =>
            this.removeResources(),
        ).catch(error => {
            this.removal = null;
            throw new Error(`Cannot remove Docker environment "${this.name}".\n${errorMessage(error)}`);
        });
        return this.removal;
    }

    private async removeResources(): Promise<void> {
        // Stop Selenoid before looking for children, so it cannot start another session.
        await docker(["rm", "--force", this.name]).catch(error => {
            if (!/no such container/i.test(errorMessage(error))) throw error;
        });
        if (this.environment.useSlirp || this.networkCreated) {
            const containers = (await docker(["ps", "--all", "--quiet", "--filter", this.containerFilter]))
                .split(/\s+/)
                .filter(Boolean);
            await removeContainers(containers);
        }
        if (this.networkCreated) {
            await docker(["network", "rm", this.network]).catch(error => {
                if (!/not found|no such network/i.test(errorMessage(error))) throw error;
            });
        }
        await rm(this.configDir, { recursive: true, force: true });
        exitCleanups.delete(this.removeOnExit);
        if (!exitCleanups.size) process.off("exit", cleanupOnExit);
    }

    private registerExitCleanup(): void {
        if (!exitCleanups.size) process.once("exit", cleanupOnExit);
        exitCleanups.add(this.removeOnExit);
    }

    private readonly removeOnExit = (): void => {
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
        run(["rm", "--force", this.name]);
        if (this.environment.useSlirp || this.networkCreated) {
            const containers = run(["ps", "--all", "--quiet", "--filter", this.containerFilter])
                .split(/\s+/)
                .filter(Boolean);
            if (containers.length) run(["rm", "--force", ...containers]);
        }
        if (this.networkCreated) run(["network", "rm", this.network]);
        try {
            rmSync(this.configDir, { recursive: true, force: true });
        } catch {
            // Best effort on synchronous process exit.
        }
    };
}
