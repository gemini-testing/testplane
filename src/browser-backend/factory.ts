import type { Config } from "../config";
import type { BrowserConfig } from "../config/browser-config";
import { getInstance } from "../config/runtime-config";
import { LOCAL_GRID_URL, DOCKER_GRID_URL } from "../constants/config";
import type { BrowserBackend } from "./index";

export function getBackendKey(config: BrowserConfig): string {
    if (getInstance().local || config.gridUrl === LOCAL_GRID_URL) return "local";
    if (config.gridUrl === DOCKER_GRID_URL) {
        const docker = config.docker;
        return `docker:${JSON.stringify([
            docker?.socketPath ?? "/var/run/docker.sock",
            docker?.selenoidImage ?? null,
            docker?.selenoidPlatform ?? "linux/amd64",
        ])}`;
    }
    return `remote:${config.gridUrl}`;
}

/** Only selected browser configs are considered when preparing shared infrastructure. */
export async function createBackend(
    config: Config,
    browserIds: string[],
    parallelism: number | null = null,
): Promise<BrowserBackend> {
    const browsers = browserIds.map(id => config.forBrowser(id));
    const key = getBackendKey(browsers[0]);
    if (key === "local") {
        const { LocalBrowserBackend } = await import("./local");
        return new LocalBrowserBackend(config);
    }
    if (key.startsWith("docker:")) {
        const { DockerBrowserBackend } = await import("./docker");
        const compatible = browsers.filter(browser => getBackendKey(browser) === key);
        const limit =
            parallelism ??
            Math.min(
                compatible.reduce((total, browser) => total + browser.sessionsPerBrowser, 0),
                config.system.parallelLimit,
            );
        // Separate controllers still share the Docker daemon's CPU budget.
        const totalParallelism =
            parallelism ??
            Math.min(
                browsers.reduce(
                    (total, browser) =>
                        total + (getBackendKey(browser).startsWith("docker:") ? browser.sessionsPerBrowser : 0),
                    0,
                ),
                config.system.parallelLimit,
            );
        return DockerBrowserBackend.create(compatible, limit, totalParallelism);
    }
    const { RemoteBrowserBackend } = await import("./remote");
    return new RemoteBrowserBackend(browsers[0].gridUrl);
}
