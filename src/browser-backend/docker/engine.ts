import { execFile, spawn } from "child_process";
import { setTimeout as delay } from "timers/promises";
import type { FileHandle } from "fs/promises";
import path from "path";
import type { DockerConfig } from "../../config/types";
import { log } from "../../utils/logger";
import { prepareDockerBrowserImage } from "./browser-image";
import {timeDockerOperation} from "./timing";

const LINUX_PLATFORM = /^linux\/[a-z0-9_]+(?:\/[a-z0-9_.-]+)?$/;
const IMAGE_PLATFORM_FORMAT = "{{.Os}}/{{.Architecture}}{{if .Variant}}/{{.Variant}}{{end}}";
export const COMMAND_TIMEOUT = 30_000;
const PULL_TIMEOUT = 10 * 60_000;
const pendingImages = new Map<string, Promise<string>>();
type DockerError = Error & { stderr?: string };
type ImageManifest = { Descriptor?: { platform?: { os: string; architecture: string; variant?: string } } };

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
    if (!containers.length) {
        return;
    }
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
            if (/no such container/i.test(message) && !/already in progress|is being removed/i.test(message)) {
                return;
            }
            throw error;
        }
    }
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
                if (code === 0) {
                    resolve();
                } else {
                    reject(new Error(`docker ${args[0]} exited with ${signal || code}`));
                }
            });
        });
    } catch (error) {
        await file.appendFile(`\nLog collection failed: ${(error as Error).message}\n`);
    }
}

export function getSocketPath(config: DockerConfig | null | undefined): string {
    const value = config?.socketPath;
    if (value === undefined) {
        return "/var/run/docker.sock";
    }
    if (typeof value !== "string" || !path.posix.isAbsolute(value) || value === "/" || /[:\p{Cc}]/u.test(value)) {
        throw new Error(
            '"docker.socketPath" must be an absolute Linux socket path without colons or control characters.',
        );
    }

    return value;
}

export function getPlatform(
    config: DockerConfig | null | undefined,
    key: "platform" | "selenoidPlatform",
): string | null {
    const value = config?.[key];
    if (value === undefined) {
        return null;
    }
    if (typeof value !== "string" || !LINUX_PLATFORM.test(value)) {
        throw new Error(`"docker.${key}" must be a Linux platform such as "linux/amd64" or "linux/arm64".`);
    }

    return value;
}

async function getDaemonPlatform(): Promise<string> {
    const platform = await docker(["version", "--format", "{{.Server.Os}}/{{.Server.Arch}}"]);
    if (!LINUX_PLATFORM.test(platform)) {
        throw new Error(
            `Invalid Docker daemon platform "${platform}"; expected a Linux platform such as "linux/amd64" or "linux/arm64".`,
        );
    }

    return platform;
}

function matchesPlatform(actual: string, expected: string): boolean {
    // An unspecified variant accepts the image's default for that architecture.
    return expected.split("/").length === 2
        ? actual.split("/").slice(0, 2).join("/") === expected
        : actual === expected;
}

async function ensureImageImpl(image: string, platformOverride: string | null): Promise<string> {
    const daemonPlatform = await getDaemonPlatform();
    let desiredPlatform = platformOverride ?? daemonPlatform;
    let platform: string;
    try {
        platform = await docker(["image", "inspect", "--format", IMAGE_PLATFORM_FORMAT, "--", image]);
        if (platformOverride === null && matchesPlatform(platform, "linux/amd64")) {
            return platform;
        }
    } catch (error) {
        if (!/no such (image|object)/i.test(errorMessage(error))) {
            throw error;
        }

        // Select a supported platform before Docker downloads any image layers.
        const manifest = JSON.parse(await docker(["manifest", "inspect", "--verbose", image]));
        const imagePlatforms = (Array.isArray(manifest) ? manifest : [manifest]).flatMap((entry: ImageManifest) => {
            const platform = entry?.Descriptor?.platform;

            return platform?.os && platform.architecture
                ? [[platform.os, platform.architecture, platform.variant].filter(Boolean).join("/")]
                : [];
        });
        const supports = (platform: string): boolean => imagePlatforms.some(actual => matchesPlatform(actual, platform));

        if (!supports(desiredPlatform) && platformOverride === null && supports("linux/amd64")) {
            desiredPlatform = "linux/amd64";
        }
        if (!supports(desiredPlatform)) {
            throw new Error(
                `Docker image "${image}" supports ${imagePlatforms.join(", ") || "no known platforms"}; requested "${desiredPlatform}".`,
            );
        }

        log(`Docker image "${image}" is not available locally. Pulling it for ${desiredPlatform}...`);
        await timeDockerOperation(image, "pull image", () =>
            docker(["pull", "--platform", desiredPlatform, "--quiet", image], { timeout: PULL_TIMEOUT }),
        );
        platform = await docker(["image", "inspect", "--format", IMAGE_PLATFORM_FORMAT, "--", image]);
    }

    if (!matchesPlatform(platform, desiredPlatform)) {
        throw new Error(
            `Docker image "${image}" targets "${platform}"; expected "${desiredPlatform}". Pull or build a matching image.`,
        );
    }

    return platform;
}

function ensureImage(image: string, platformOverride: string | null): Promise<string> {
    const key = `${image}\n${platformOverride ?? ""}`;
    if (!pendingImages.has(key)) {
        pendingImages.set(
            key,
            ensureImageImpl(image, platformOverride).finally(() => pendingImages.delete(key)),
        );
    }

    return pendingImages.get(key)!;
}

/** Prepare persistent images without starting browser sessions or Selenoid. */
export async function prepareDockerImages(
    config: DockerConfig | null,
    browserName = "",
    scope = "prepare-docker",
): Promise<{ image: string; selenoidImage: string }> {
    // Plugins can resolve images asynchronously during INIT, after config parsing.
    for (const key of ["image", "selenoidImage"] as const) {
        const image = config?.[key];
        if (typeof image !== "string" || !image.trim()) {
            throw new Error(`"docker.${key}" must be a non-empty string when "gridUrl" is "docker"`);
        }
        if (image.startsWith("-") || /\s/.test(image)) {
            throw new Error(
                `Invalid docker.${key} "${image}": expected a Docker image reference without whitespace or a leading dash.`,
            );
        }
    }

    const image = config!.image!;
    const selenoidImage = config!.selenoidImage!;

    const configuredPlatform = getPlatform(config, "platform");
    const selenoidPlatform = getPlatform(config, "selenoidPlatform");
    const platform = await timeDockerOperation(scope, `prepare browser image ${image}`, () =>
        ensureImage(image, configuredPlatform),
    );
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
