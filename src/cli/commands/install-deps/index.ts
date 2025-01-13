import { Testplane } from "../../../testplane";
import { CliCommands } from "../../constants";
import logger from "../../../utils/logger";
import { installBrowsersWithDrivers, BrowserInstallStatus } from "../../../browser-installer";

const { INSTALL_DEPS: commandName } = CliCommands;

type BrowsersInstallPerStatus = {
    ok: Array<{ tag: string }>;
    skip: Array<{ tag: string; reason: string }>;
    error: Array<{ tag: string; reason: string }>;
};

const logResult = <T extends (typeof BrowserInstallStatus)[keyof typeof BrowserInstallStatus]>(
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
