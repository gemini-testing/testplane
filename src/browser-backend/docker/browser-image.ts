import { createHash } from "crypto";
import { mkdir, mkdtemp, rm, writeFile } from "fs/promises";
import { arch, platform as hostPlatform, tmpdir } from "os";
import path from "path";
import lockfile from "proper-lockfile";
import { warn } from "../../utils/logger";
import { debugDocker, timeDockerOperation } from "./timing";

const BUILD_TIMEOUT = 10 * 60_000;
// See https://github.com/gemini-testing/images/tree/master/static/chrome/devtools
const DEVTOOLS_IMAGE = "ghcr.io/gemini-testing/devtools-proxy:latest";
const RECIPE = "COPY --from=devtools /usr/bin/devtools /usr/bin/devtools\n";

export const CHECK_DEVTOOLS = "if [ -f /usr/bin/devtools ]; then echo present; else echo absent; fi";

type Docker = (args: string[], options?: { timeout: number }) => Promise<string>;

async function imageExists(image: string, docker: Docker): Promise<boolean> {
    try {
        await docker(["image", "inspect", "--format", "{{.Id}}", image]);

        return true;
    } catch (error) {
        const failure = error as Error & { stderr?: string };
        if (/no such (image|object)/i.test(failure.stderr || failure.message)) {
            return false;
        }
        throw error;
    }
}

/** Persist the repaired adapter in Docker's image store, never in a host binary cache. */
export async function prepareDockerBrowserImage(
    source: string,
    scope: string,
    docker: Docker,
    platform: string,
): Promise<string> {
    // Replace the packed CDP adapter for AMD64 browsers running from Apple Silicon.
    if (hostPlatform() !== "darwin" || arch() !== "arm64" || platform.split("/")[1] !== "amd64") {
        return source;
    }

    const [metadata] = JSON.parse(await docker(["image", "inspect", source])) as {
        Id: string;
    }[];
    if (!/^sha256:[a-f0-9]{64}$/.test(metadata.Id)) {
        throw new Error(`Invalid Docker image metadata for "${source}"`);
    }
    const key = createHash("sha256").update(`${metadata.Id}\n${platform}\n${DEVTOOLS_IMAGE}\n${RECIPE}`).digest("hex");
    const image = `testplane-browser:${key}`;
    if (await imageExists(image, docker)) {
        debugDocker(`[Docker timing][${scope}] prepared browser image: ${image}`);

        return image;
    }

    const adapter = await timeDockerOperation(scope, "check browser image CDP adapter", () =>
        docker([
            "run",
            "--rm",
            "--platform",
            platform,
            "--network",
            "none",
            "--user",
            "0",
            "--entrypoint",
            "/bin/sh",
            metadata.Id,
            "-ec",
            CHECK_DEVTOOLS,
        ]),
    );
    if (adapter.trim() === "absent") {
        debugDocker(`[Docker timing][${scope}] no CDP adapter in ${source}; using the original image`);

        return source;
    }
    if (adapter.trim() !== "present") {
        throw new Error(`Cannot check CDP adapter in Docker image "${source}"`);
    }

    // Only lock files live on the host. proper-lockfile removes the lock when released.
    const locks = path.join(tmpdir(), "testplane-docker-image-locks");
    await mkdir(locks, { recursive: true });
    const release = await timeDockerOperation(scope, "wait for browser image build lock", () =>
        lockfile.lock(path.join(locks, key), {
            realpath: false,
            stale: 30_000,
            update: 5_000,
            retries: { retries: 660, minTimeout: 1000, maxTimeout: 1000, factor: 1 },
        }),
    );
    try {
        // Another worker may have finished the build while we were waiting.
        if (await imageExists(image, docker)) {
            return image;
        }
        const directory = await mkdtemp(path.join(tmpdir(), "testplane-docker-image-"));
        const base = `testplane-browser-base:${key}`;
        try {
            // Pin FROM to the inspected image even if the original tag changes during the build.
            await docker(["image", "tag", metadata.Id, base]);
            await writeFile(
                path.join(directory, "Dockerfile"),
                `FROM ${DEVTOOLS_IMAGE} AS devtools\nFROM ${base}\n${RECIPE}`,
            );
            await timeDockerOperation(scope, `build browser image ${image}`, () =>
                docker(["build", "--platform", platform, "--pull=false", "--tag", image, directory], {
                    timeout: BUILD_TIMEOUT,
                }),
            );

            return image;
        } catch (error) {
            const failure = error as Error & { stdout?: string; stderr?: string };
            throw new Error(
                `Cannot prepare Docker browser image "${source}".\n` +
                    [failure.message, failure.stdout?.trim(), failure.stderr?.trim()].filter(Boolean).join("\n"),
            );
        } finally {
            await docker(["image", "rm", base]).catch(error => warn((error as Error).message));
            await rm(directory, { recursive: true, force: true });
        }
    } finally {
        await release();
    }
}
