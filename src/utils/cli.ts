import type { Command } from "@gemini-testing/commander";
import logger from "./logger";
import { requireModule } from "./module";

// used from https://github.com/sindresorhus/escape-string-regexp/blob/main/index.js
const escapeRe = (str: string): string => {
    // Escape characters with special meaning either inside or outside character sets.
    // Use a simple backslash escape when it’s always valid, and a `\xnn` escape when the simpler form would be disallowed by Unicode patterns’ stricter grammar.
    return str.replace(/[|\\{}()[\]^$+*?.]/g, "\\$&").replace(/-/g, "\\x2d");
};

export const collectCliValues = (newValue: unknown, array = [] as unknown[]): unknown[] => {
    return array.concat(newValue);
};

export const compileGrep = (grep: string): RegExp => {
    try {
        return new RegExp(`(${grep})|(${escapeRe(grep)})`);
    } catch (error) {
        logger.warn(`Invalid regexp provided to grep, searching by its string representation. ${error}`);
        return new RegExp(escapeRe(grep));
    }
};

export const handleRequires = async (requires: string[] = []): Promise<void> => {
    for (const modulePath of requires) {
        await requireModule(modulePath);
    }
};

export type CommonCmdOpts = {
    config?: string;
    browser?: Array<string>;
    set?: Array<string>;
    require?: Array<string>;
    grep?: RegExp;
};

export const withCommonCliOptions = ({ cmd, actionName = "run" }: { cmd: Command; actionName: string }): Command => {
    const isMainCmd = ["testplane", "hermione"].includes(cmd.name());

    if (!isMainCmd) {
        cmd.option("-c, --config <path>", "path to configuration file");
    }

    return cmd
        .option("-b, --browser <browser>", `${actionName} tests only in specified browser`, collectCliValues)
        .option("-s, --set <set>", `${actionName} tests only in the specified set`, collectCliValues)
        .option("-r, --require <module>", "require module", collectCliValues)
        .option("--grep <grep>", `${actionName} only tests matching the pattern`, compileGrep);
};
