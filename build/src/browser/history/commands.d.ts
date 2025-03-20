declare enum Scopes {
    BROWSER = "b",
    ELEMENT = "e"
}
declare const wdioBrowserCommands: string[];
declare const wdioElementCommands: string[];
export declare const getBrowserCommands: () => typeof wdioBrowserCommands;
export declare const getElementCommands: () => typeof wdioElementCommands;
export declare const createScope: (elementScope: boolean) => `${Scopes}`;
export {};
