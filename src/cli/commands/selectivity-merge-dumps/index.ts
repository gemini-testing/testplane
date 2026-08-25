import { Testplane } from "../../../testplane";
import { CliCommands } from "../../constants";
import * as logger from "../../../utils/logger";
import { resolveExitCode } from "../../../utils/exit-code";

const { SELECTIVITY_MERGE_DUMPS: commandName } = CliCommands;

export const registerCmd = (cliTool: typeof commander, testplane: Testplane): void => {
    cliTool
        .command(`${commandName} [paths...]`)
        .description("Merges selectivity dumps from multiple chunks into one directory")
        .option("-c, --config <path>", "path to configuration file")
        .option("-d, --destination <destination>", "path to directory with merged dump")
        .action(async (sourcePaths: string[], options: typeof commander) => {
            let exitCode = 0;
            try {
                const action = async (): Promise<void> => {
                    const destPath = options.destination || testplane.config.selectivity.testDependenciesPath;

                    const { mergeSelectivityDumps } = await import("../../../browser/cdp/selectivity/merge-dumps");

                    await mergeSelectivityDumps(destPath, sourcePaths, testplane.config.selectivity.compression);
                };
                await (typeof testplane.profileCliCommand === "function"
                    ? testplane.profileCliCommand(commandName, action)
                    : action());
            } catch (err) {
                logger.error((err as Error).stack || err);
                exitCode = 1;
            }
            process.exit(resolveExitCode(exitCode));
        });
};
