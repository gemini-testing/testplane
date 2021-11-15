import wdioBrowserCommands from 'webdriverio/build/commands/browser';
import wdioElementCommands from 'webdriverio/build/commands/element';

export enum scopes {
    BROWSER = 'b',
    ELEMENT = 'e'
}

export const getBrowserCommands = (): Array<keyof typeof wdioBrowserCommands> => {
    return Object.keys(wdioBrowserCommands) as Array<keyof typeof wdioBrowserCommands>;
};
export const getElementCommands = (): Array<keyof typeof wdioElementCommands> => {
    return Object.keys(wdioElementCommands) as Array<keyof typeof wdioElementCommands>;
};
export const createScope = (elementScope: boolean): scopes => elementScope
    ? scopes.ELEMENT
    : scopes.BROWSER;
