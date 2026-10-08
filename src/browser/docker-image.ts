import { createHash } from "crypto";
import { mkdir, mkdtemp, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import lockfile from "proper-lockfile";
import { log, warn } from "../utils/logger";
import { timeDockerOperation } from "./docker-timing";

const BUILD_TIMEOUT = 10 * 60_000;
// Runs only while building the image. The original entrypoint starts devtools normally afterwards.
const PREPARE_DEVTOOLS = `
if [ -f /usr/bin/devtools ]; then
    if head -c 1024 /usr/bin/devtools | grep -q 'UPX!'; then
        if ! command -v upx-ucl >/dev/null 2>&1; then
            apt-get update -qq
            DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends upx-ucl
            rm -rf /var/lib/apt/lists/*
        fi
        upx-ucl -d /usr/bin/devtools
    fi
    /usr/bin/devtools -help
fi
`;
const RECIPE = `USER 0\nRUN ${JSON.stringify(["/bin/sh", "-ec", PREPARE_DEVTOOLS])}\n`;

type Docker = (args: string[], options?: { timeout: number }) => Promise<string>;

async function imageExists(image: string, docker: Docker): Promise<boolean> {
    try {
        await docker(["image", "inspect", "--format", "{{.Id}}", image]);
        return true;
    } catch (error) {
        const failure = error as Error & { stderr?: string };
        if (/no such (image|object)/i.test(failure.stderr || failure.message)) return false;
        throw error;
    }
}

/** Persist the repaired adapter in Docker's image store, never in a host binary cache. */
export async function prepareDockerBrowserImage(source: string, scope: string, docker: Docker): Promise<string> {
    const [metadata] = JSON.parse(await docker(["image", "inspect", source])) as {
        Id: string;
        Config: { User?: string };
    }[];
    const user = metadata.Config.User || "0";
    if (!/^sha256:[a-f0-9]{64}$/.test(metadata.Id) || /[\r\n]/.test(user)) {
        throw new Error(`Invalid Docker image metadata for "${source}"`);
    }
    const recipe = `${RECIPE}USER ${user}\n`;
    const key = createHash("sha256").update(`${metadata.Id}\n${recipe}`).digest("hex");
    const image = `testplane-browser:${key}`;
    if (await imageExists(image, docker)) {
        log(`[Docker timing][${scope}] prepared browser image: ${image}`);
        return image;
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
        if (await imageExists(image, docker)) return image;
        const directory = await mkdtemp(path.join(tmpdir(), "testplane-docker-image-"));
        const base = `testplane-browser-base:${key}`;
        try {
            // Pin FROM to the inspected image even if the original tag changes during the build.
            await docker(["image", "tag", metadata.Id, base]);
            await writeFile(path.join(directory, "Dockerfile"), `FROM ${base}\n${recipe}`);
            await timeDockerOperation(scope, `build browser image ${image}`, () =>
                docker(["build", "--platform", "linux/amd64", "--pull=false", "--tag", image, directory], {
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
            // This removes only our temporary tag, not the source image or the prepared image.
            await docker(["image", "rm", base]).catch(error => warn((error as Error).message));
            await rm(directory, { recursive: true, force: true });
        }
    } finally {
        await release();
    }
}
