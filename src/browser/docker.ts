import { execFile, execFileSync, spawn } from "child_process";
import { randomUUID } from "crypto";
import { setTimeout as delay } from "timers/promises";
import { mkdtemp, writeFile, rm, mkdir, readdir, open, type FileHandle } from "fs/promises";
import { rmSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import type { WdProcess } from "../browser-pool/webdriver-pool";
import type { DockerConfig } from "../config/types";
import { log, warn } from "../utils/logger";
import { CHECK_DEVTOOLS, prepareDockerBrowserImage } from "./docker-image";
import { timeDockerOperation } from "./docker-timing";

const DEFAULT_PLATFORM = "linux/amd64";
const IMAGE_PLATFORM = "{{.Os}}/{{.Architecture}}{{if .Variant}}/{{.Variant}}{{end}}";
const COMMAND_TIMEOUT = 30_000;
const PULL_TIMEOUT = 10 * 60_000;
const pendingImages = new Map<string, Promise<void>>();
const exitCleanups = new Set<() => void>();

function cleanupOnExit(): void {
    for (const cleanup of exitCleanups) {
        cleanup();
    }
}

function registerCleanup(cleanup: () => void): void {
    if (exitCleanups.size === 0) {
        process.once("exit", cleanupOnExit);
    }
    exitCleanups.add(cleanup);
}

function unregisterCleanup(cleanup: () => void): void {
    exitCleanups.delete(cleanup);
    if (exitCleanups.size === 0) {
        process.off("exit", cleanupOnExit);
    }
}

type DockerError = Error & { code?: string; stderr?: string };

function docker(args: string[], { includeStderr = false, timeout = COMMAND_TIMEOUT } = {}): Promise<string> {
    return new Promise((resolve, reject) => {
        execFile("docker", args, { encoding: "utf8", timeout, windowsHide: true }, (error, stdout, stderr) => {
            if (error) {
                reject(Object.assign(error, { stdout, stderr }));
            } else {
                resolve((includeStderr ? stdout + stderr : stdout).trim());
            }
        });
    });
}

function errorMessage(error: unknown): string {
    return (error as DockerError).stderr?.trim() || (error as Error).message;
}

/** Selenoid may still be removing a container after DELETE /session returns. */
async function removeContainers(containers: string[]): Promise<void> {
    if (!containers.length) return;
    const deadline = Date.now() + COMMAND_TIMEOUT;
    for (;;) {
        try {
            await docker(["rm", "--force", ...containers]);
            return;
        } catch (error) {
            const message = errorMessage(error);
            if (/already in progress|is being removed/i.test(message) && Date.now() < deadline) {
                await delay(100);
                continue;
            }
            if (/no such container/i.test(message) && !/already in progress|is being removed/i.test(message)) return;
            throw error;
        }
    }
}

/** Enforce a limit of 5 browser sessions per 4 Docker CPUs. */
export async function checkDockerParallelism(parallelism: number): Promise<number> {
    let cpus: number;
    try {
        cpus = Number(
            await timeDockerOperation("daemon", "check CPU count", () => docker(["info", "--format", "{{.NCPU}}"])),
        );
    } catch (error) {
        throw new Error(`Cannot check Docker browser parallelism: ${errorMessage(error)}`);
    }
    if (!Number.isInteger(cpus) || cpus <= 0) {
        throw new Error(`Invalid Docker CPU count: ${cpus}`);
    }

    const limit = Math.floor((cpus * 5) / 4);
    if (parallelism > limit) {
        throw new Error(
            `Docker browser parallelism is ${parallelism}, but Docker has ${cpus} CPUs. ` +
                `The maximum allowed is ${limit} concurrent browsers (5 browsers per 4 CPUs). ` +
                `Reduce sessionsPerBrowser or system.parallelLimit, or allocate more CPUs to Docker.`,
        );
    }
    return limit;
}

/** Stream complete output to disk without execFile's in-memory buffer limit. */
async function appendDockerOutput(file: FileHandle, title: string, args: string[]): Promise<void> {
    await file.appendFile(`\n=== ${title} ===\n`);
    try {
        await new Promise<void>((resolve, reject) => {
            const child = spawn("docker", args, {
                stdio: ["ignore", file.fd, file.fd],
                timeout: COMMAND_TIMEOUT,
                windowsHide: true,
            });
            child.once("error", reject);
            child.once("close", (code, signal) => {
                if (code === 0) resolve();
                else reject(new Error(`docker ${args[0]} exited with ${signal || code}`));
            });
        });
    } catch (error) {
        await file.appendFile(`\nLog collection failed: ${(error as Error).message}\n`);
    }
}

function getSocketPath(config: DockerConfig | null | undefined): string {
    const value = config?.socketPath;
    if (value === undefined) return "/var/run/docker.sock";
    if (typeof value !== "string" || !path.posix.isAbsolute(value) || value === "/" || /[:\p{Cc}]/u.test(value)) {
        throw new Error(
            '"docker.socketPath" must be an absolute Linux socket path without colons or control characters.',
        );
    }
    return value;
}

function getPlatform(config: DockerConfig | null | undefined, key: "platform" | "selenoidPlatform"): string {
    const value = config?.[key];
    if (value === undefined) return DEFAULT_PLATFORM;
    if (typeof value !== "string" || !/^linux\/[a-z0-9_]+(?:\/[a-z0-9_.-]+)?$/.test(value)) {
        throw new Error(`"docker.${key}" must be a Linux platform such as "linux/amd64" or "linux/arm64".`);
    }
    return value;
}

function matchesPlatform(actual: string, expected: string): boolean {
    // An unspecified variant accepts the image's default for that architecture.
    return expected.split("/").length === 2
        ? actual.split("/").slice(0, 2).join("/") === expected
        : actual === expected;
}

async function checkImage(image: string, expectedPlatform: string): Promise<void> {
    try {
        await docker(["info", "--format", "{{.OSType}}"]);
    } catch (error) {
        if ((error as DockerError).code === "ENOENT") {
            throw new Error('Docker is not installed or is not on PATH. Install Docker to use gridUrl: "docker".');
        }
        throw new Error(
            `Docker daemon is unavailable. Start Docker and check access with "docker info".\n${errorMessage(error)}`,
        );
    }

    let platform: string;
    try {
        platform = await docker(["image", "inspect", "--format", IMAGE_PLATFORM, "--", image]);
    } catch (error) {
        if (!/no such (image|object)/i.test(errorMessage(error))) {
            throw new Error(`Cannot inspect Docker image "${image}".\n${errorMessage(error)}`);
        }

        log(`Docker image "${image}" is not available locally. Pulling it for ${expectedPlatform}...`);
        try {
            await timeDockerOperation(image, "pull image", () =>
                docker(["pull", "--platform", expectedPlatform, "--quiet", image], { timeout: PULL_TIMEOUT }),
            );
        } catch (pullError) {
            throw new Error(
                `Cannot pull Docker image "${image}" for ${expectedPlatform}. Check the image name, network connection and registry credentials (docker login).\n${errorMessage(
                    pullError,
                )}`,
            );
        }
        try {
            platform = await docker(["image", "inspect", "--format", IMAGE_PLATFORM, "--", image]);
        } catch (inspectError) {
            throw new Error(`Cannot inspect Docker image "${image}" after pulling it.\n${errorMessage(inspectError)}`);
        }
    }

    if (!matchesPlatform(platform, expectedPlatform)) {
        throw new Error(
            `Docker image "${image}" targets "${platform}"; expected "${expectedPlatform}". Pull or build the ${expectedPlatform} image.`,
        );
    }
}

async function ensureImage(image: string, platform: string): Promise<void> {
    const key = `${image}\n${platform}`;
    if (!pendingImages.has(key)) {
        pendingImages.set(
            key,
            checkImage(image, platform).finally(() => pendingImages.delete(key)),
        );
    }
    await pendingImages.get(key);
}

async function waitForSelenoid(name: string, gridUrl: string, timeout: number): Promise<void> {
    const deadline = Date.now() + timeout;

    while (Date.now() < deadline) {
        if ((await docker(["inspect", "--format", "{{.State.Running}}", name])) !== "true") {
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
            // Selenoid may not be listening yet while its entrypoint is starting it.
        }

        await delay(Math.max(0, Math.min(200, deadline - Date.now())));
    }

    throw new Error(
        `Selenoid did not become ready within ${timeout} ms. Adjust sessionRequestTimeout if startup needs more time.`,
    );
}

export type DockerBrowserOptions = {
    browserName?: string;
    browserVersion?: string;
    timeout?: number;
};

/** Prepare persistent images without starting browser sessions or Selenoid. */
export async function prepareDockerImages(
    config: DockerConfig | null,
    browserName = "",
    scope = "prepare-docker",
): Promise<{ image: string; selenoidImage: string }> {
    const image = config?.image;
    if (typeof image !== "string" || !image.trim()) {
        throw new Error('"docker.image" must be a non-empty string when "gridUrl" is "docker"');
    }
    if (image.startsWith("-") || /\s/.test(image)) {
        throw new Error(
            `Invalid docker.image "${image}": expected a Docker image reference without whitespace or a leading dash.`,
        );
    }

    const { selenoidImage } = config || {};
    if (typeof selenoidImage !== "string" || !selenoidImage.trim()) {
        throw new Error(
            '"docker.selenoidImage" must be a non-empty string when "gridUrl" is "docker". ' +
                "Set it in the browser's docker config or in the top-level docker config.",
        );
    }
    if (selenoidImage.startsWith("-") || /\s/.test(selenoidImage)) {
        throw new Error(
            `Invalid docker.selenoidImage "${selenoidImage}": expected a Docker image reference without whitespace or a leading dash.`,
        );
    }

    const platform = getPlatform(config, "platform");
    const selenoidPlatform = getPlatform(config, "selenoidPlatform");
    await timeDockerOperation(scope, `prepare browser image ${image}`, () => ensureImage(image, platform));
    await timeDockerOperation(scope, `prepare Selenoid image ${selenoidImage}`, () =>
        ensureImage(selenoidImage, selenoidPlatform),
    );
    const preparedImage = ["chrome", "yandex"].includes(browserName.toLowerCase())
        ? await timeDockerOperation(scope, "prepare local browser image", () =>
              prepareDockerBrowserImage(image, scope, docker, platform),
          )
        : image;
    return { image: preparedImage, selenoidImage };
}

export type DockerBrowserEntry = {
    config: DockerConfig | null;
    browserName: string;
    browserVersion: string;
};

export type DockerController = WdProcess & {
    addBrowser: (entry: DockerBrowserEntry) => Promise<void>;
    createSession: (version: string, timeout: number) => WdProcess;
};

/** The owner stops this controller only after all of its sessions have finished. */
export async function startDockerController(
    config: DockerConfig | null,
    { browserName = "", browserVersion, timeout = COMMAND_TIMEOUT }: DockerBrowserOptions,
    entries: DockerBrowserEntry[] = [{ config, browserName, browserVersion: browserVersion || "default" }],
    limit = 1,
): Promise<DockerController> {
    const name = `testplane-${randomUUID()}`;
    // Validate the controller choice before pulling or building anything.
    if (entries.some(entry => entry.config?.selenoidImage !== config?.selenoidImage)) {
        throw new Error("All Docker browsers in one run must use the same docker.selenoidImage.");
    }
    const selenoidPlatform = getPlatform(config, "selenoidPlatform");
    for (const entry of entries) {
        getPlatform(entry.config, "platform");
        if (getPlatform(entry.config, "selenoidPlatform") !== selenoidPlatform) {
            throw new Error("All Docker browsers in one run must use the same docker.selenoidPlatform.");
        }
    }
    const socketPath = getSocketPath(config);
    if (entries.some(entry => getSocketPath(entry.config) !== socketPath)) {
        throw new Error("All Docker browsers in one run must use the same docker.socketPath.");
    }
    const prepared = await Promise.all(
        entries.map(async entry => ({
            ...entry,
            ...(await prepareDockerImages(entry.config, entry.browserName, name)),
        })),
    );
    const { image: preparedImage, selenoidImage } = prepared[0];
    const securityOptions = JSON.parse(
        await timeDockerOperation(name, "check container security options", () =>
            docker(["info", "--format", "{{json .SecurityOptions}}"]),
        ),
    ) as string[] | null;
    // SELinux otherwise prevents the controller from accessing the mounted engine socket.
    const controllerSecurityArgs = securityOptions?.includes("name=selinux") ? ["--security-opt", "label=disable"] : [];
    const serverComponents = JSON.parse(
        await timeDockerOperation(name, "detect container engine", () =>
            docker(["version", "--format", "{{json .Server.Components}}"]),
        ),
    ) as { Name: string }[] | null;
    // Podman supplies host.docker.internal itself; host-gateway may be unavailable in podman machine.
    const isPodman = serverComponents?.some(component => component.Name === "Podman Engine") ?? false;
    const defaultHosts = isPodman ? [] : ["host.docker.internal:host-gateway"];
    const network = `${name}-network`;
    const configDir = await mkdtemp(path.join(tmpdir(), "testplane-selenoid-"));
    const configPath = path.join(configDir, "browsers.json");
    let networkCreated = false;
    let removal: Promise<void> | undefined;
    const removeOnExit = (): void => {
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
        run(["rm", "--force", name]);
        if (networkCreated) {
            const containers = run(["ps", "--all", "--quiet", "--filter", `network=${network}`])
                .split(/\s+/)
                .filter(Boolean);
            if (containers.length) {
                run(["rm", "--force", ...containers]);
            }
            run(["network", "rm", network]);
        }
        try {
            rmSync(configDir, { recursive: true, force: true });
        } catch {
            // Best effort on synchronous process exit.
        }
    };
    const cleanup = async (): Promise<void> => {
        // Stop the controller before looking for its children, so it cannot start another session.
        await docker(["rm", "--force", name]).catch(error => {
            if (!/no such container/i.test(errorMessage(error))) {
                throw error;
            }
        });
        if (networkCreated) {
            const containers = (await docker(["ps", "--all", "--quiet", "--filter", `network=${network}`]))
                .split(/\s+/)
                .filter(Boolean);
            await removeContainers(containers);
            await docker(["network", "rm", network]).catch(error => {
                if (!/not found|no such network/i.test(errorMessage(error))) {
                    throw error;
                }
            });
        }
        await rm(configDir, { recursive: true, force: true });
        unregisterCleanup(removeOnExit);
    };
    const remove = (): Promise<void> => {
        removal ??= timeDockerOperation(name, "remove containers and network", cleanup).catch(error => {
            removal = undefined;
            throw new Error(`Cannot remove Docker environment "${name}".\n${errorMessage(error)}`);
        });

        return removal;
    };
    const getLogs = async (label?: string): Promise<string> => {
        const controllerLogs = await docker(["logs", "--tail", "100", name], { includeStderr: true }).catch(() => "");
        const driverLogs: string[] = [];
        if (networkCreated) {
            // Selenoid may not save driver logs until the service becomes ready.
            const containers = await docker([
                "ps",
                "--all",
                "--quiet",
                "--filter",
                `network=${network}`,
                "--filter",
                label ? `label=testplane.session=${label}` : `ancestor=${preparedImage}`,
            ]).catch(() => "");
            for (const container of containers.split(/\s+/).filter(Boolean).slice(0, 4)) {
                const logs = await docker(["logs", "--tail", "100", container], { includeStderr: true }).catch(
                    () => "",
                );
                if (logs) {
                    driverLogs.push(`Browser container log (${container}):\n${logs.slice(-16384)}`);
                }
            }
        }
        try {
            const logsDir = path.join(configDir, "logs", label || "controller");
            await mkdir(logsDir, { recursive: true });
            await docker(["cp", `${name}:/opt/selenoid/logs/${label ? `${label}.log` : "."}`, logsDir]);
            const files = (await readdir(logsDir, { withFileTypes: true })).filter(
                file => file.isFile() && (!label || file.name === `${label}.log`),
            );
            for (const file of files.slice(-4)) {
                const handle = await open(path.join(logsDir, file.name), "r");
                try {
                    const { size } = await handle.stat();
                    const buffer = Buffer.alloc(Math.min(size, 16384));
                    const { bytesRead } = await handle.read(
                        buffer,
                        0,
                        buffer.length,
                        Math.max(0, size - buffer.length),
                    );
                    driverLogs.push(`Browser log (${file.name}):\n${buffer.subarray(0, bytesRead).toString()}`);
                } finally {
                    await handle.close();
                }
            }
        } catch {
            // Startup can fail before Selenoid creates any browser logs.
        }
        return [controllerLogs, ...driverLogs].filter(Boolean).join("\n");
    };

    const saveLogs = async (sessionId: string, label?: string, image = preparedImage): Promise<string> => {
        const logsDir = path.join(tmpdir(), "testplane-logs");
        await mkdir(logsDir, { recursive: true });
        const logPath = path.join(logsDir, `${encodeURIComponent(sessionId)}.log`);
        const file = await open(logPath, "w", 0o600);
        try {
            await file.appendFile(`Session: ${sessionId}\nImage: ${image}\nSaved: ${new Date().toISOString()}\n`);
            if (label) {
                await file.appendFile(`Selenoid log: ${path.join(logsDir, `${name}.log`)}\n`);
            } else {
                await appendDockerOutput(file, "Selenoid", ["logs", "--timestamps", name]);
            }
            const containers = (
                await docker([
                    "ps",
                    "--all",
                    "--quiet",
                    "--filter",
                    `network=${network}`,
                    "--filter",
                    label ? `label=testplane.session=${label}` : `ancestor=${preparedImage}`,
                ])
            )
                .split(/\s+/)
                .filter(Boolean);
            for (const container of containers) {
                await appendDockerOutput(file, `Browser container ${container}`, ["logs", "--timestamps", container]);
            }
        } finally {
            await file.close();
        }
        return logPath;
    };

    const browsers: Record<string, { default: string; versions: Record<string, DockerConfig> }> = {};
    const addEntry = (entry: DockerBrowserEntry, image: string): void => {
        const browserConfig = { ...entry.config };
        delete browserConfig.selenoidImage;
        delete browserConfig.selenoidPlatform;
        delete browserConfig.socketPath;
        delete browserConfig.platform;
        browsers[entry.browserName] ??= { default: entry.browserVersion, versions: {} };
        browsers[entry.browserName].versions[entry.browserVersion] = {
            port: "4444",
            path: "/",
            shmSize: 2 * 1024 ** 3,
            hosts: defaultHosts,
            ...browserConfig,
            image,
        };
    };
    prepared.forEach(entry => addEntry(entry, entry.image));

    const saveControllerLogs = async (): Promise<void> => {
        const logsDir = path.join(tmpdir(), "testplane-logs");
        await mkdir(logsDir, { recursive: true });
        const logPath = path.join(logsDir, `${name}.log`);
        const file = await open(logPath, "w", 0o600);
        try {
            await appendDockerOutput(file, "Selenoid", ["logs", "--timestamps", name]);
            log(`Docker Selenoid log: ${logPath}`);
        } finally {
            await file.close();
        }
    };

    registerCleanup(removeOnExit);

    try {
        await writeFile(configPath, JSON.stringify(browsers));
        // Set before creation to also clean up when the CLI times out after creating the network.
        networkCreated = true;
        await timeDockerOperation(name, "create network", async () => {
            try {
                await docker(["network", "create", "--ipv6", network]);
            } catch (error) {
                try {
                    await docker(["network", "inspect", network]);
                    return;
                } catch (inspectError) {
                    if (!/no such network|network .+ not found/i.test(errorMessage(inspectError))) throw inspectError;
                }
                warn(`Cannot create a dual-stack Docker network; falling back to IPv4.\n${errorMessage(error)}`);
                await docker(["network", "create", network]);
            }
        });
        await timeDockerOperation(name, "create Selenoid container", () =>
            docker([
                "create",
                "--name",
                name,
                "--platform",
                selenoidPlatform,
                "--pull",
                "never",
                "--publish",
                "127.0.0.1::4444",
                "--network",
                network,
                // This is the socket path on the daemon's Linux host, including Docker Desktop/Colima.
                "--volume",
                `${socketPath}:/var/run/docker.sock`,
                ...controllerSecurityArgs,
                selenoidImage,
                "-conf",
                "/browsers.json",
                "-container-network",
                network,
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
        // Copy instead of a host bind mount: macOS temporary paths may not be shared with the VM.
        await timeDockerOperation(name, "copy Selenoid config", () =>
            docker(["cp", configPath, `${name}:/browsers.json`]),
        );
        if (isPodman) {
            // Selenoid detects container execution using this Docker marker. Without it,
            // it connects to published ports on its own loopback instead of the browser's network IP.
            await timeDockerOperation(name, "enable Selenoid container detection", async () => {
                const marker = path.join(configDir, ".dockerenv");
                await writeFile(marker, "");
                await docker(["cp", marker, `${name}:/.dockerenv`]);
            });
        }
        await timeDockerOperation(name, "start Selenoid container", () => docker(["start", name]));

        const ports = JSON.parse(
            await docker(["inspect", "--format", "{{json .NetworkSettings.Ports}}", name]),
        ) as Record<string, { HostIp: string; HostPort: string }[] | null>;
        const port = ports["4444/tcp"]?.find(binding => binding.HostIp === "127.0.0.1")?.HostPort;
        if (!port || !/^\d+$/.test(port)) {
            throw new Error("Docker did not publish WebDriver port 4444 on 127.0.0.1.");
        }

        const gridUrl = `http://127.0.0.1:${port}`;
        await timeDockerOperation(name, `wait for Selenoid at ${gridUrl}`, () =>
            waitForSelenoid(name, gridUrl, timeout),
        );

        const prepareCdp = async (sessionId: string, label?: string, cdpTimeout = timeout): Promise<boolean | void> => {
            const protocolUrl = `${gridUrl}/devtools/${encodeURIComponent(sessionId)}/json/protocol`;
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
                    `network=${network}`,
                    "--filter",
                    label ? `label=testplane.session=${label}` : `ancestor=${preparedImage}`,
                ])
            )
                .split(/\s+/)
                .filter(Boolean);
            if (containers.length !== 1) {
                throw new Error(`Expected one browser container for CDP, found ${containers.length}.`);
            }
            const browserContainer = containers[0];
            const adapter = await docker(["exec", "--user", "0", browserContainer, "/bin/sh", "-ec", CHECK_DEVTOOLS]);
            if (adapter.trim() === "absent") {
                warn(`Docker browser session ${sessionId} has no /usr/bin/devtools adapter; continuing without CDP.`);
                return false;
            }
            if (adapter.trim() !== "present")
                throw new Error(`Cannot check CDP adapter in container ${browserContainer}`);
            await timeDockerOperation(sessionId, "wait for CDP readiness", async () => {
                const deadline = Date.now() + cdpTimeout;
                while (Date.now() < deadline) {
                    if (await isCdpReady()) return;
                    if ((await docker(["inspect", "--format", "{{.State.Running}}", browserContainer])) !== "true") {
                        throw new Error("The browser container exited before the CDP adapter became ready.");
                    }
                    await delay(Math.max(0, Math.min(200, deadline - Date.now())));
                }
                throw new Error(`CDP adapter did not become ready within ${cdpTimeout} ms.`);
            });
        };

        let shared = false;
        let stopping: Promise<void> | undefined;
        const stop = (): Promise<void> => {
            stopping ??= (async (): Promise<void> => {
                if (shared) await saveControllerLogs().catch(error => warn(errorMessage(error)));
                await remove();
            })().catch(error => {
                stopping = undefined;
                throw error;
            });
            return stopping;
        };
        return {
            gridUrl: `${gridUrl}/wd/hub`,
            free: stop,
            kill: stop,
            getPid: () => undefined,
            getLogs,
            saveLogs,
            prepareCdp,
            addBrowser: async (entry): Promise<void> => {
                if (getSocketPath(entry.config) !== socketPath) {
                    throw new Error("All Docker browsers in one run must use the same docker.socketPath.");
                }
                if (entry.config?.selenoidImage !== selenoidImage) {
                    throw new Error("All Docker browsers in one run must use the same docker.selenoidImage.");
                }
                if (getPlatform(entry.config, "selenoidPlatform") !== selenoidPlatform) {
                    throw new Error("All Docker browsers in one run must use the same docker.selenoidPlatform.");
                }
                const { image } = await prepareDockerImages(entry.config, entry.browserName, name);
                addEntry(entry, image);
                await writeFile(configPath, JSON.stringify(browsers));
                // Never expose a partially copied config to Selenoid.
                await docker(["cp", configPath, `${name}:/browsers.next.json`]);
                await docker(["exec", name, "mv", "/browsers.next.json", "/browsers.json"]);
                await docker(["kill", "--signal", "HUP", name]);
                const deadline = Date.now() + timeout;
                while (Date.now() < deadline) {
                    const response = await fetch(`${gridUrl}/status`, { signal: AbortSignal.timeout(1000) });
                    const status = (await response.json()) as { browsers?: Record<string, Record<string, unknown>> };
                    if (response.ok && status.browsers?.[entry.browserName]?.[entry.browserVersion]) return;
                    await delay(50);
                }
                throw new Error("Selenoid did not reload the browser configuration in time.");
            },
            createSession: (version, sessionTimeout): WdProcess => {
                shared = true;
                const image = Object.values(browsers)
                    .map(browser => browser.versions[version]?.image)
                    .find(Boolean);
                if (!image) throw new Error(`Unknown Docker browser route: ${version}`);
                const label = randomUUID();
                let sessionId: string | undefined;
                let released: Promise<void> | undefined;
                const release = (): Promise<void> => {
                    released ??= (async (): Promise<void> => {
                        // A failed client DELETE must not leave Selenoid's slot occupied.
                        if (sessionId) {
                            await fetch(`${gridUrl}/wd/hub/session/${encodeURIComponent(sessionId)}`, {
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
                                `network=${network}`,
                                "--filter",
                                `label=testplane.session=${label}`,
                            ])
                        )
                            .split(/\s+/)
                            .filter(Boolean);
                        await removeContainers(containers);
                    })().catch(error => {
                        released = undefined;
                        throw error;
                    });
                    return released;
                };
                return {
                    gridUrl: `${gridUrl}/wd/hub`,
                    free: release,
                    kill: release,
                    getPid: () => undefined,
                    setSessionId: (id): void => {
                        sessionId = id;
                    },
                    selenoidOptions: { version, labels: { "testplane.session": label }, logName: `${label}.log` },
                    getLogs: () => getLogs(label),
                    saveLogs: sessionId => saveLogs(sessionId, label, image),
                    prepareCdp: sessionId => prepareCdp(sessionId, label, sessionTimeout),
                };
            },
        };
    } catch (error) {
        const logs = await getLogs().catch(() => "");
        await remove().catch(cleanupError => warn((cleanupError as Error).message));
        throw new Error(
            `Cannot start Selenoid for Docker browser "${config?.image}".\n${errorMessage(error)}${
                logs ? `\nContainer logs:\n${logs}` : ""
            }`,
        );
    }
}
