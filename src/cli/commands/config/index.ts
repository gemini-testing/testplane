import { Testplane } from "../../../testplane";
import { CliCommands } from "../../constants";
import * as logger from "../../../utils/logger";

const { CONFIG: commandName } = CliCommands;

export const registerCmd = (cliTool: typeof commander, testplane: Testplane): void => {
    cliTool
        .command(commandName)
        .description("Outputs Testplane config (including default and overriden by environment variables values)")
        .option("-c, --config <path>", "path to configuration file")
        .option("--space <count>", "white spaces count to insert into the JSON output", Number, 0)
        .action(async (options: typeof commander) => {
            const { space } = options;

            try {
                console.info(JSON.stringify(testplane.config, null, space));

                process.exit(0);
            } catch (err) {
                logger.error((err as Error).stack || err);
                process.exit(1);
            }
        });
};
