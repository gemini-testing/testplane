"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerCmd = void 0;
const constants_1 = require("../../constants");
const logger_1 = __importDefault(require("../../../utils/logger"));
const browser_installer_1 = require("../../../browser-installer");
const { INSTALL_DEPS: commandName } = constants_1.CliCommands;
const logResult = (browsersInstallPerStatus, logType, status, heading, formatLine) => {
    if (!browsersInstallPerStatus[status].length) {
        return;
    }
    logger_1.default[logType]([heading, ...browsersInstallPerStatus[status].map(formatLine), ""].join("\n"));
};
const registerCmd = (cliTool, testplane) => {
    cliTool
        .command(commandName)
        .description("Install browsers to run locally with 'gridUrl': 'local' or '--local' cli argument")
        .option("-c, --config <path>", "path to configuration file")
        .arguments("[browsers...]")
        .action(async (browsers) => {
        try {
            if (!browsers.length) {
                browsers = Object.keys(testplane.config.browsers);
            }
            const browsersToInstall = browsers.map(browser => {
                if (browser in testplane.config.browsers) {
                    const browserConfig = testplane.config.browsers[browser];
                    const { browserName, browserVersion } = browserConfig.desiredCapabilities || {};
                    return { browserName, browserVersion };
                }
                else if (browser.includes("@")) {
                    const [browserName, browserVersion] = browser.split("@", 2);
                    return { browserName, browserVersion };
                }
                else {
                    throw new Error([
                        `Unknown browser: ${browser}.`,
                        `Expected config's <browserId> or '<browserName>@<browserVersion>' (example: "chrome@130")`,
                    ].join("\n"));
                }
            });
            const browsersInstallResult = await (0, browser_installer_1.installBrowsersWithDrivers)(browsersToInstall);
            const browserTags = Object.keys(browsersInstallResult);
            const browsersInstallPerStatus = {
                [browser_installer_1.BrowserInstallStatus.Ok]: [],
                [browser_installer_1.BrowserInstallStatus.Skip]: [],
                [browser_installer_1.BrowserInstallStatus.Error]: [],
            };
            for (const tag of browserTags) {
                const result = browsersInstallResult[tag];
                const bucket = browsersInstallPerStatus[result.status];
                if ("reason" in result) {
                    bucket.push({ tag, reason: result.reason });
                }
                else {
                    bucket.push({ tag });
                }
            }
            logResult(browsersInstallPerStatus, "log", browser_installer_1.BrowserInstallStatus.Ok, "These browsers are downloaded successfully:", ({ tag }) => `- ${tag}`);
            logResult(browsersInstallPerStatus, "warn", browser_installer_1.BrowserInstallStatus.Skip, "Browser install for these browsers was skipped:", ({ tag, reason }) => `- ${tag}: ${reason}`);
            logResult(browsersInstallPerStatus, "error", browser_installer_1.BrowserInstallStatus.Error, "An error occured while trying to download these browsers:", ({ tag, reason }) => `- ${tag}: ${reason}`);
        }
        catch (err) {
            logger_1.default.error(err.stack || err);
            process.exit(1);
        }
    });
};
exports.registerCmd = registerCmd;
//# sourceMappingURL=index.js.map