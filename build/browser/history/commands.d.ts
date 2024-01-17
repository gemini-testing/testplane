declare enum Scopes {
    BROWSER = "b",
    ELEMENT = "e"
}
export declare const getBrowserCommands: () => string[];
export declare const getElementCommands: () => string[];
export declare const createScope: (elementScope: boolean) => `${Scopes}`;
export {};
