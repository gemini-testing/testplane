import _ from "lodash";
import { Testplane } from "../../../testplane";
import { CliCommands } from "../../constants";
import logger from "../../../utils/logger";

const { LIST_BROWSERS: commandName } = CliCommands;

const BrowsersListOutputType = {
    IDS: "ids",
    TAGS: "tags",
};

const BrowsersListOutputFormat = {
    JSON: "json",
    PLAIN: "plain",
};

const validateOption = (availableOptions: Record<string, string>, value: string, optionName: string): void => {
    const optionsArray = Object.values(availableOptions);

    if (!optionsArray.includes(value)) {
        const optionsList = optionsArray.map(value => `"${value}"`).join(", ");

        throw new Error(`"${optionName}" option must be one of: ${optionsList}, but got "${value}"`);
    }
};

const extractBrowserIds = (testplaneConfig: Testplane["config"]): string[] => {
    const browsersArray = Object.keys(testplaneConfig.browsers);

    return _.uniq(browsersArray).filter(Boolean).sort();
};

const extractBrowserTags = (
    testplaneConfig: Testplane["config"],
    format: (typeof BrowsersListOutputFormat)[keyof typeof BrowsersListOutputFormat],
): { browserName: string; browserVersion?: string }[] | string[] => {
    const browserConfigs = Object.values(testplaneConfig.browsers).filter(browserConfig => {
        return Boolean(browserConfig.desiredCapabilities?.browserName);
    });

    if (format === BrowsersListOutputFormat.PLAIN) {
        const browsersArray = browserConfigs.map(browserConfig => {
            const { browserName, browserVersion } = browserConfig.desiredCapabilities || {};

            return browserVersion ? `${browserName}@${browserVersion}` : (browserName as string);
        });

        return _.uniq(browsersArray).sort();
    }

    const browsersArray = browserConfigs.map(browserConfig => {
        const { browserName, browserVersion } = browserConfig.desiredCapabilities || {};

        return { browserName: browserName as string, browserVersion };
    });

    return _(browsersArray).uniq().sortBy(["browserName", "browserVersion"]).value();
};

export const registerCmd = (cliTool: typeof commander, testplane: Testplane): void => {
    cliTool
        .command(commandName)
        .description("Lists all browsers from the config")
        .option(
            "--type [type]",
            "return browsers in specified type ('tags': browserName and browserVersion, 'ids': browserId from config)",
            String,
            BrowsersListOutputType.TAGS,
        )
        .option(
            "--format [format]",
            "return browsers in specified format ('json' / 'plain')",
            String,
            BrowsersListOutputFormat.JSON,
        )
        .action(async (options: typeof commander) => {
            const { type, format } = options;

            try {
                validateOption(BrowsersListOutputType, type, "type");
                validateOption(BrowsersListOutputFormat, format, "format");

                const browsersSorted =
                    type === BrowsersListOutputType.IDS
                        ? extractBrowserIds(testplane.config)
                        : extractBrowserTags(testplane.config, format);

                const outputResult =
                    format === BrowsersListOutputFormat.PLAIN
                        ? browsersSorted.join(" ")
                        : JSON.stringify(browsersSorted);

                console.info(outputResult);

                process.exit(0);
            } catch (err) {
                logger.error((err as Error).stack || err);
                process.exit(1);
            }
        });
};
