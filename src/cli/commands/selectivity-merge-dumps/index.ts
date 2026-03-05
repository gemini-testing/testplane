import { Testplane } from "../../../testplane";
import { CliCommands } from "../../constants";
import * as logger from "../../../utils/logger";

const { SELECTIVITY_MERGE_DUMPS: commandName } = CliCommands;

export const registerCmd = (cliTool: typeof commander, testplane: Testplane): void => {
    cliTool
        .command(`${commandName} [paths...]`)
        .description("Merges selectivity dumps from multiple chunks into one directory")
        .option("-c, --config <path>", "path to configuration file")
        .option("-d, --destination <destination>", "path to directory with merged dump")
        .action(async (sourcePaths: string[], options: typeof commander) => {
            try {
                const destPath = options.destination || testplane.config.selectivity.testDependenciesPath;

                const { mergeSelectivityDumps } = await import("../../../browser/cdp/selectivity/merge-dumps");

                await mergeSelectivityDumps(destPath, sourcePaths, testplane.config.selectivity.compression);

                process.exit(0);
            } catch (err) {
                logger.error((err as Error).stack || err);
                process.exit(1);
            }
        });
};
