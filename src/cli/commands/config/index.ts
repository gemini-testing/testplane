import { Testplane } from "../../../testplane";
import { CliCommands } from "../../constants";
import * as logger from "../../../utils/logger";
import { resolveExitCode } from "../../../utils/exit-code";

const { CONFIG: commandName } = CliCommands;

export const registerCmd = (cliTool: typeof commander, testplane: Testplane): void => {
    cliTool
        .command(commandName)
        .description("Outputs Testplane config (including default and overriden by environment variables values)")
        .option("-c, --config <path>", "path to configuration file")
        .option("--space <count>", "white spaces count to insert into the JSON output", Number, 0)
        .action(async (options: typeof commander) => {
            const { space } = options;
            let exitCode = 0;

            try {
                await testplane.profileCliCommand(commandName, () => {
                    console.info(JSON.stringify(testplane.config, null, space));
                });
            } catch (err) {
                logger.error((err as Error).stack || err);
                exitCode = 1;
            }
            process.exit(resolveExitCode(exitCode));
        });
};
