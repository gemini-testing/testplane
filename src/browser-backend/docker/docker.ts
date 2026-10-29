import { execFile, spawn } from "child_process";
import { setTimeout as delay } from "timers/promises";
import type { FileHandle } from "fs/promises";
import path from "path";
import type { DockerConfig } from "../../config/types";
import { log } from "../../utils/logger";
import { prepareDockerBrowserImage } from "./docker-image";
import { timeDockerOperation } from "./docker-timing";

const DEFAULT_PLATFORM = "linux/amd64";
const IMAGE_PLATFORM = "{{.Os}}/{{.Architecture}}{{if .Variant}}/{{.Variant}}{{end}}";
export const COMMAND_TIMEOUT = 30_000;
const PULL_TIMEOUT = 10 * 60_000;
const pendingImages = new Map<string, Promise<void>>();
type DockerError = Error & { code?: string; stderr?: string };

export function docker(args: string[], { includeStderr = false, timeout = COMMAND_TIMEOUT } = {}): Promise<string> {
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

export function errorMessage(error: unknown): string {
    return (error as DockerError).stderr?.trim() || (error as Error).message;
}

/** Selenoid may still be removing a container after DELETE /session returns. */
export async function removeContainers(containers: string[]): Promise<void> {
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
export async function appendDockerOutput(file: FileHandle, title: string, args: string[]): Promise<void> {
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

export function getSocketPath(config: DockerConfig | null | undefined): string {
    const value = config?.socketPath;
    if (value === undefined) return "/var/run/docker.sock";
    if (typeof value !== "string" || !path.posix.isAbsolute(value) || value === "/" || /[:\p{Cc}]/u.test(value)) {
        throw new Error(
            '"docker.socketPath" must be an absolute Linux socket path without colons or control characters.',
        );
    }
    return value;
}

export function getPlatform(config: DockerConfig | null | undefined, key: "platform" | "selenoidPlatform"): string {
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
