import type { Command } from "@gemini-testing/commander";
import type { Testplane } from "../../../testplane";
import { prepareDockerImages } from "../../../browser/docker";
import { collectCliValues } from "../../../utils/cli";
import * as logger from "../../../utils/logger";
import { resolveExitCode } from "../../../utils/exit-code";
import { SetsBuilder } from "../../../test-reader/sets-builder";
import env from "../../../utils/env";
import { CliCommands } from "../../constants";

const { PREPARE_DOCKER: commandName } = CliCommands;

export const registerCmd = (cliTool: Command, testplane: Testplane): void => {
    cliTool
        .command(commandName)
        .description("Pull Docker images from the config and prepare browser images for CDP")
        .option("-c, --config <path>", "path to configuration file")
        .option("-b, --browser <browser>", "prepare only the specified browser", collectCliValues)
        .option("-s, --set <set>", "prepare browsers from the specified set", collectCliValues)
        .option("-r, --require <module>", "require module", collectCliValues)
        .action(async (options: Command) => {
            try {
                await testplane.profileCliCommand(commandName, async () => {
                    const browsers: string[] = options.browser || [];
                    const knownBrowsers = testplane.config.getBrowserIds();
                    for (const id of browsers) {
                        if (!knownBrowsers.includes(id)) {
                            throw new Error(`Unknown browser: ${id}`);
                        }
                    }
                    const envSets = env.parseCommaSeparatedValue(["TESTPLANE_SETS", "HERMIONE_SETS"]).value;
                    const browserIds = SetsBuilder.create(testplane.config.sets, { defaultPaths: [] })
                        .useSets((options.set || []).concat(envSets))
                        .useBrowsers(browsers)
                        .getBrowserIds();
                    const dockerConfigs = browserIds
                        .map(id => testplane.config.forBrowser(id))
                        .filter(config => config.gridUrl === "docker");
                    if (!dockerConfigs.length) {
                        logger.log('No browsers with gridUrl: "docker" selected.');
                        return;
                    }

                    for (const config of dockerConfigs) {
                        const { browserName = "" } = config.desiredCapabilities || {};
                        logger.log(`Preparing Docker images for "${config.id}"...`);
                        await prepareDockerImages(config.docker, browserName, config.id);
                    }
                    logger.log("Docker images are ready.");
                });
            } catch (err) {
                logger.error((err as Error).stack || err);
                process.exitCode = resolveExitCode(1);
            }
        });
};
