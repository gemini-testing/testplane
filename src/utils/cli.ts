import _ from "lodash";
import type { Command } from "@gemini-testing/commander";
import * as logger from "./logger";
import { requireModule } from "./module";

export const collectCliValues = (newValue: unknown, array = [] as unknown[]): unknown[] => {
    return array.concat(newValue);
};

export type TagFilter = (tags: Map<string, boolean>) => boolean;

export const compileTagFilter = (filter: string): TagFilter => {
    const normalizedFilter = filter.replace(/\s+/g, "").toLowerCase();

    function compileOrExpression(expr: string): string {
        const parts = expr.split("|");
        if (parts.length === 1) {
            return compileAndExpression(parts[0]);
        }
        return `(${parts.map(part => compileAndExpression(part)).join(" || ")})`;
    }

    function compileAndExpression(expr: string): string {
        const parts = expr.split("&");
        if (parts.length === 1) {
            return compileSingleTag(parts[0]);
        }
        return `(${parts.map(part => compileSingleTag(part)).join(" && ")})`;
    }

    function compileSingleTag(tag: string): string {
        if (tag.startsWith("!")) {
            return `!tags.has("${tag.substring(1)}")`;
        }
        return `tags.has("${tag}")`;
    }

    const compiledCode = compileOrExpression(normalizedFilter);

    return new Function("tags", `return ${compiledCode};`) as (tags: Map<string, boolean>) => boolean;
};

export const compileGrep = (grep: string): RegExp => {
    try {
        return new RegExp(`(${grep})|(${_.escapeRegExp(grep)})`);
    } catch (error) {
        logger.warn(`Invalid regexp provided to grep, searching by its string representation. ${error}`);
        return new RegExp(_.escapeRegExp(grep));
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
        .option("--grep <grep>", `${actionName} only tests matching the pattern`, compileGrep)
        .option("--tag <tag>", `${actionName} only tests matching the pattern`, compileTagFilter);
};
