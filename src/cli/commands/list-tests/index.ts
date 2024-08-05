import path from "node:path";
import fs from "fs-extra";
import { ValueOf } from "type-fest";

import { Testplane } from "../../../testplane";
import { Formatters, AVAILABLE_FORMATTERS } from "./constants";
import { CliCommands } from "../../constants";
import { withCommonCliOptions, collectCliValues, handleRequires, type CommonCmdOpts } from "../../../utils/cli";
import logger from "../../../utils/logger";

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
            const { grep, browser: browsers, set: sets, require: requireModules } = cliTool;
            const { ignore, silent, outputFile, formatter } = options;

            try {
                validateFormatters(formatter);
                handleRequires(requireModules);

                const testCollection = await testplane.readTests(paths, {
                    browsers,
                    sets,
                    grep,
                    ignore,
                    silent,
                    runnableOpts: {
                        saveLocations: formatter === Formatters.TREE,
                    },
                });

                // eslint-disable-next-line @typescript-eslint/no-var-requires
                const { format } = require(path.resolve(__dirname, "./formatters", formatter));
                const result = format(testCollection);

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

function validateFormatters(formatter: ValueOf<typeof Formatters>): void {
    if (!AVAILABLE_FORMATTERS.includes(formatter)) {
        throw new Error(`"formatter" option must be one of: ${AVAILABLE_FORMATTERS.join(", ")}`);
    }
}
