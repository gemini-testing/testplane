import type { Command } from "@gemini-testing/commander";
export declare const collectCliValues: (newValue: unknown, array?: unknown[]) => unknown[];
export declare const compileGrep: (grep: string) => RegExp;
export declare const handleRequires: (requires?: string[]) => Promise<void>;
export type CommonCmdOpts = {
    config?: string;
    browser?: Array<string>;
    set?: Array<string>;
    require?: Array<string>;
    grep?: RegExp;
};
export declare const withCommonCliOptions: ({ cmd, actionName }: {
    cmd: Command;
    actionName: string;
}) => Command;
