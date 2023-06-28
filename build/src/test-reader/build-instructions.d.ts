export class InstructionsList {
    push(fn: any, file: any): InstructionsList;
    exec(files: any, ctx?: {}): void;
    #private;
}
declare function extendWithBrowserId({ treeBuilder, browserId }: {
    treeBuilder: any;
    browserId: any;
}): void;
declare function extendWithBrowserVersion({ treeBuilder, config }: {
    treeBuilder: any;
    config: any;
}): void;
declare function extendWithTimeout({ treeBuilder, config }: {
    treeBuilder: any;
    config: any;
}): void;
declare function buildGlobalSkipInstruction(config: any): ({ treeBuilder, browserId }: {
    treeBuilder: any;
    browserId: any;
}) => void;
export declare namespace Instructions {
    export { extendWithBrowserId };
    export { extendWithBrowserVersion };
    export { extendWithTimeout };
    export { buildGlobalSkipInstruction };
}
export {};
