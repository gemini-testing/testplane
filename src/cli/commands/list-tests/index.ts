import path from "node:path";
import fs from "fs-extra";

import { Testplane } from "../../../testplane";
import { Formatters } from "../../../test-collection/constants";
import { validateFormatter } from "../../../test-collection";
import { CliCommands } from "../../constants";
import { withCommonCliOptions, collectCliValues, type CommonCmdOpts } from "../../../utils/cli";
import * as logger from "../../../utils/logger";

import type { ValueOf } from "../../../types/helpers";

const { LIST_TESTS: commandName } = CliCommands;

type ListTestsCmdOpts = {
    ignore?: Array<string>;
    silent?: boolean;
    outputFile?: string;
    formatter: ValueOf<typeof Formatters>;
};

export type ListTestsCmd = typeof commander & CommonCmdOpts;

export const registerCmd = (cliTool: ListTestsCmd, testplane: Testplane): void => {
    withCommonCliOptions({ cmd: cliTool.command(`${commandName}`), actionName: "list" })
        .description("Lists all tests info in one of available formats")
        .option("--ignore <file-path>", "exclude paths from tests read", collectCliValues)
        .option("--silent [type]", "flag to disable events emitting while reading tests", Boolean, false)
        .option("--output-file <file-path>", "save results to specified file")
        .option("--formatter [name]", "return tests in specified format", String, Formatters.LIST)
        .arguments("[paths...]")
        .action(async (paths: string[], options: ListTestsCmdOpts) => {
            const { grep, tag, browser: browsers, set: sets } = cliTool;
            const { ignore, silent, outputFile, formatter } = options;

            try {
                validateFormatter(formatter);

                const testCollection = await testplane.readTests(paths, {
                    browsers,
                    sets,
                    grep,
                    tag,
                    ignore,
                    silent,
                    runnableOpts: {
                        saveLocations: formatter === Formatters.TREE,
                    },
                });

                const result = testCollection.format(formatter);

                if (outputFile) {
                    await fs.ensureDir(path.dirname(outputFile));
                    await fs.writeJson(outputFile, result);
                } else {
                    console.info(JSON.stringify(result));
                }

                process.exit(0);
            } catch (err) {
                logger.error((err as Error).stack || err);
                process.exit(1);
            }
        });
};
