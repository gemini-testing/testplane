import type { Testplane } from "../../../testplane";
import { CliCommands } from "../../constants";
import * as logger from "../../../utils/logger";

const { INSTALL_DEPS: commandName } = CliCommands;

type BrowsersInstallPerStatus = {
    ok: Array<{ tag: string }>;
    skip: Array<{ tag: string; reason: string }>;
    error: Array<{ tag: string; reason: string }>;
};

const logResult = <T extends keyof BrowsersInstallPerStatus>(
    browsersInstallPerStatus: BrowsersInstallPerStatus,
    logType: "log" | "warn" | "error",
    status: T,
    heading: string,
    formatLine: (arg: BrowsersInstallPerStatus[T][number]) => string,
): void => {
    if (!browsersInstallPerStatus[status].length) {
        return;
    }

    logger[logType]([heading, ...browsersInstallPerStatus[status].map(formatLine), ""].join("\n"));
};

export const registerCmd = (cliTool: typeof commander, testplane: Testplane): void => {
    cliTool
        .command(commandName)
        .description("Install browsers to run locally with 'gridUrl': 'local' or '--local' cli argument")
        .option("-c, --config <path>", "path to configuration file")
        .arguments("[browsers...]")
        .action(async (browsers: string[]) => {
            const { installBrowsersWithDrivers, BrowserInstallStatus } = await import("../../../browser-installer");

            try {
                if (!browsers.length) {
                    browsers = Object.keys(testplane.config.browsers);
                }

                const browsersToInstall = browsers.map(browser => {
                    if (browser in testplane.config.browsers) {
                        const browserConfig = testplane.config.browsers[browser];
                        const { browserName, browserVersion } = browserConfig.desiredCapabilities || {};

                        return { browserName, browserVersion };
                    } else if (browser.includes("@")) {
                        const [browserName, browserVersion] = browser.split("@", 2);

                        return { browserName, browserVersion };
                    } else {
                        const lines: string[] = [];
                        lines.push(`Unknown browser argument: "${browser}".`);
                        lines.push("");
                        lines.push("Possible reasons:");
                        lines.push("  - The value is not a browserId from your Testplane config.");
                        lines.push('  - The value is not in the expected "<browserName>@<browserVersion>" format.');
                        lines.push("  - There is a typo in the browser name or version.");
                        lines.push("");
                        lines.push("What you can do:");
                        lines.push(
                            `  - Use a browserId defined in your config (e.g. one of: ${
                                Object.keys(testplane.config.browsers).join(", ") || "<none defined>"
                            }).`,
                        );
                        lines.push('  - Or use the format "<browserName>@<browserVersion>", e.g. "chrome@130".');
                        lines.push("  - Run `testplane install-deps --help` to see usage details.");
                        throw new Error(lines.join("\n"));
                    }
                });

                const browsersInstallResult = await installBrowsersWithDrivers(browsersToInstall);
                const browserTags = Object.keys(browsersInstallResult);
                const browsersInstallPerStatus: BrowsersInstallPerStatus = {
                    [BrowserInstallStatus.Ok]: [],
                    [BrowserInstallStatus.Skip]: [],
                    [BrowserInstallStatus.Error]: [],
                };

                for (const tag of browserTags) {
                    const result = browsersInstallResult[tag];
                    const bucket = browsersInstallPerStatus[result.status];

                    if ("reason" in result) {
                        bucket.push({ tag, reason: result.reason });
                    } else {
                        (bucket as { tag: string }[]).push({ tag });
                    }
                }

                logResult(
                    browsersInstallPerStatus,
                    "log",
                    BrowserInstallStatus.Ok,
                    "These browsers are downloaded successfully:",
                    ({ tag }) => `- ${tag}`,
                );

                logResult(
                    browsersInstallPerStatus,
                    "warn",
                    BrowserInstallStatus.Skip,
                    "Browser install for these browsers was skipped:",
                    ({ tag, reason }) => `- ${tag}: ${reason}`,
                );

                logResult(
                    browsersInstallPerStatus,
                    "error",
                    BrowserInstallStatus.Error,
                    "An error occured while trying to download these browsers:",
                    ({ tag, reason }) => `- ${tag}: ${reason}`,
                );
            } catch (err) {
                logger.error((err as Error).stack || err);
                process.exit(1);
            }
        });
};
