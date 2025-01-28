import { TreeBuilder } from "./tree-builder";
import { BrowserConfig } from "../config/browser-config";
import { Config } from "../config";
export type InstructionFnArgs = {
    treeBuilder: TreeBuilder;
    browserId: string;
    config: BrowserConfig & {
        passive?: boolean;
    };
};
export type InstructionFn = (args: InstructionFnArgs) => void;
export declare class InstructionsList {
    #private;
    constructor();
    push(fn: InstructionFn, file?: string): InstructionsList;
    exec(files: string[], ctx: InstructionFnArgs): void;
}
declare function extendWithBrowserId({ treeBuilder, browserId }: InstructionFnArgs): void;
declare function extendWithBrowserVersion({ treeBuilder, config }: InstructionFnArgs): void;
declare function extendWithTimeout({ treeBuilder, config }: InstructionFnArgs): void;
declare function disableInPassiveBrowser({ treeBuilder, config }: InstructionFnArgs): void;
declare function buildGlobalSkipInstruction(config: Config): InstructionFn;
export declare const Instructions: {
    extendWithBrowserId: typeof extendWithBrowserId;
    extendWithBrowserVersion: typeof extendWithBrowserVersion;
    extendWithTimeout: typeof extendWithTimeout;
    disableInPassiveBrowser: typeof disableInPassiveBrowser;
    buildGlobalSkipInstruction: typeof buildGlobalSkipInstruction;
};
export {};
