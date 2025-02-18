import { format } from "util";
import chalk from "chalk";
import _ from "lodash";
import * as logger from "./utils/logger";

export const validateUnknownBrowsers = (browsers: string[], configBrowsers: string[]): void => {
    const unknownBrowsers = getUnknownBrowsers(browsers, configBrowsers);

    if (_.isEmpty(unknownBrowsers)) {
        return;
    }

    logger.warn(
        format(
            "%s Unknown browser ids: %s. Use one of the browser ids specified in the config file: %s",
            chalk.yellow("WARNING:"),
            unknownBrowsers.join(", "),
            configBrowsers.join(", "),
        ),
    );
};

function getUnknownBrowsers(browsers: string[], configBrowsers: string[]): string[] {
    return _(browsers).compact().uniq().difference(configBrowsers).value();
}
