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
import { prepareDockerBrowserImage } from "./docker-image";
import { timeDockerOperation } from "./docker-timing";

const PLATFORM = "linux/amd64";
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

/** Enforce a limit of 5 browser sessions per 4 Docker CPUs. */
export async function checkDockerParallelism(parallelism: number): Promise<void> {
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

async function checkImage(image: string): Promise<void> {
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
        platform = await docker(["image", "inspect", "--format", "{{.Os}}/{{.Architecture}}", "--", image]);
    } catch (error) {
        if (!/no such (image|object)/i.test(errorMessage(error))) {
            throw new Error(`Cannot inspect Docker image "${image}".\n${errorMessage(error)}`);
        }

        log(`Docker image "${image}" is not available locally. Pulling it for ${PLATFORM}...`);
        try {
            await timeDockerOperation(image, "pull image", () =>
                docker(["pull", "--platform", PLATFORM, "--quiet", image], { timeout: PULL_TIMEOUT }),
            );
        } catch (pullError) {
            throw new Error(
                `Cannot pull Docker image "${image}" for ${PLATFORM}. Check the image name, network connection and registry credentials (docker login).\n${errorMessage(
                    pullError,
                )}`,
            );
        }
        try {
            platform = await docker(["image", "inspect", "--format", "{{.Os}}/{{.Architecture}}", "--", image]);
        } catch (inspectError) {
            throw new Error(`Cannot inspect Docker image "${image}" after pulling it.\n${errorMessage(inspectError)}`);
        }
    }

    if (platform !== PLATFORM) {
        throw new Error(
            `Docker image "${image}" targets "${platform}"; expected "${PLATFORM}". Pull or build the ${PLATFORM} image.`,
        );
    }
}

async function ensureImage(image: string): Promise<void> {
    if (!pendingImages.has(image)) {
        pendingImages.set(
            image,
            checkImage(image).finally(() => pendingImages.delete(image)),
        );
    }
    await pendingImages.get(image);
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

type DockerBrowserOptions = {
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

    await timeDockerOperation(scope, `prepare browser image ${image}`, () => ensureImage(image));
    await timeDockerOperation(scope, `prepare Selenoid image ${selenoidImage}`, () => ensureImage(selenoidImage));
    const preparedImage = ["chrome", "yandex"].includes(browserName.toLowerCase())
        ? await timeDockerOperation(scope, "prepare local browser image", () =>
              prepareDockerBrowserImage(image, scope, docker),
          )
        : image;
    return { image: preparedImage, selenoidImage };
}

/** Start an isolated Selenoid environment per session; Selenoid manages the browser container. */
export async function runDockerBrowser(
    config: DockerConfig | null,
    { browserName = "", browserVersion, timeout = COMMAND_TIMEOUT }: DockerBrowserOptions,
): Promise<WdProcess> {
    const name = `testplane-${randomUUID()}`;
    const { image: preparedImage, selenoidImage } = await prepareDockerImages(config, browserName, name);
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
    const browserConfig = { ...config };
    delete browserConfig.selenoidImage;
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
            if (containers.length) {
                await docker(["rm", "--force", ...containers]);
            }
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
    const getLogs = async (): Promise<string> => {
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
                `ancestor=${preparedImage}`,
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
            const logsDir = path.join(configDir, "logs");
            await mkdir(logsDir, { recursive: true });
            await docker(["cp", `${name}:/opt/selenoid/logs/.`, logsDir]);
            const files = (await readdir(logsDir, { withFileTypes: true })).filter(file => file.isFile());
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

    const saveLogs = async (sessionId: string): Promise<string> => {
        const logsDir = path.join(tmpdir(), "testplane-logs");
        await mkdir(logsDir, { recursive: true });
        const logPath = path.join(logsDir, `${encodeURIComponent(sessionId)}.log`);
        const file = await open(logPath, "w", 0o600);
        try {
            await file.appendFile(
                `Session: ${sessionId}\nImage: ${preparedImage}\nSaved: ${new Date().toISOString()}\n`,
            );
            await appendDockerOutput(file, "Selenoid", ["logs", "--timestamps", name]);
            const containers = (
                await docker([
                    "ps",
                    "--all",
                    "--quiet",
                    "--filter",
                    `network=${network}`,
                    "--filter",
                    `ancestor=${preparedImage}`,
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

    registerCleanup(removeOnExit);

    try {
        // Version is a Selenoid routing key. An omitted version selects this image's default.
        const version = browserVersion || "default";
        await writeFile(
            configPath,
            JSON.stringify({
                [browserName]: {
                    default: version,
                    versions: {
                        [version]: {
                            port: "4444",
                            path: "/",
                            shmSize: 2 * 1024 ** 3,
                            hosts: defaultHosts,
                            ...browserConfig,
                            image: preparedImage,
                        },
                    },
                },
            }),
        );
        // Set before creation to also clean up when the CLI times out after creating the network.
        networkCreated = true;
        await timeDockerOperation(name, "create network", () => docker(["network", "create", network]));
        await timeDockerOperation(name, "create Selenoid container", () =>
            docker([
                "create",
                "--name",
                name,
                "--platform",
                PLATFORM,
                "--pull",
                "never",
                "--publish",
                "127.0.0.1::4444",
                "--network",
                network,
                // This is the socket path on the daemon's Linux host, including Docker Desktop/Colima.
                "--volume",
                "/var/run/docker.sock:/var/run/docker.sock",
                ...controllerSecurityArgs,
                selenoidImage,
                "-conf",
                "/browsers.json",
                "-container-network",
                network,
                "-limit",
                "1",
                "-retry-count",
                "1",
                "-capture-driver-logs",
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

        const prepareCdp = async (sessionId: string): Promise<void> => {
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
                    `ancestor=${preparedImage}`,
                ])
            )
                .split(/\s+/)
                .filter(Boolean);
            if (containers.length !== 1) {
                throw new Error(`Expected one browser container for CDP, found ${containers.length}.`);
            }
            const browserContainer = containers[0];
            await timeDockerOperation(sessionId, "wait for CDP readiness", async () => {
                const deadline = Date.now() + timeout;
                while (Date.now() < deadline) {
                    if (await isCdpReady()) return;
                    if ((await docker(["inspect", "--format", "{{.State.Running}}", browserContainer])) !== "true") {
                        throw new Error("The browser container exited before the CDP adapter became ready.");
                    }
                    await delay(Math.max(0, Math.min(200, deadline - Date.now())));
                }
                throw new Error(`CDP adapter did not become ready within ${timeout} ms.`);
            });
        };

        return {
            gridUrl: `${gridUrl}/wd/hub`,
            free: remove,
            kill: remove,
            getPid: () => undefined,
            getLogs,
            saveLogs,
            prepareCdp,
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
