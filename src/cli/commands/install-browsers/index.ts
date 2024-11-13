import { Testplane } from "../../../testplane";
import { CliCommands } from "../../constants";
import logger from "../../../utils/logger";
import { installBrowsersWithDrivers, BrowserInstallStatus } from "../../../browser-installer";

const { INSTALL_BROWSERS: commandName } = CliCommands;

export const registerCmd = (cliTool: typeof commander, testplane: Testplane): void => {
    cliTool
        .command(commandName)
        .description("Install browsers to run locally with 'gridUrl': 'local' or '--local' cli argument")
        .arguments("[browsers...]")
        .action(async (browsers: string[]) => {
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
                        throw new Error(
                            [
                                `Unknown browser: ${browser}.`,
                                `Expected config's <browserId> or '<browserName>@<browserVersion>' (example: "chrome@130")`,
                            ].join("\n"),
                        );
                    }
                });

                const browsersInstallResult = await installBrowsersWithDrivers(browsersToInstall);
                const browserTags = Object.keys(browsersInstallResult);
                const browsersInstallPerStatus = {
                    [BrowserInstallStatus.Ok]: [] as { tag: string }[],
                    [BrowserInstallStatus.Skip]: [] as { tag: string; reason: string }[],
                    [BrowserInstallStatus.Error]: [] as { tag: string; reason: string }[],
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

                const logResult = <T extends (typeof BrowserInstallStatus)[keyof typeof BrowserInstallStatus]>(
                    logType: "log" | "warn" | "error",
                    status: T,
                    heading: string,
                    formatLine: (arg: (typeof browsersInstallPerStatus)[T][number]) => string,
                ): void => {
                    if (!browsersInstallPerStatus[status].length) {
                        return;
                    }

                    logger[logType]([heading, ...browsersInstallPerStatus[status].map(formatLine), ""].join("\n"));
                };

                logResult(
                    "log",
                    BrowserInstallStatus.Ok,
                    "These browsers are downloaded successfully:",
                    ({ tag }) => `- ${tag}`,
                );

                logResult(
                    "warn",
                    BrowserInstallStatus.Skip,
                    "Browser install for these browsers was skipped:",
                    ({ tag, reason }) => `- ${tag}: ${reason}`,
                );

                logResult(
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
