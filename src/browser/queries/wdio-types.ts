/// <reference types="@testplane/webdriverio" />
/*
eslint-disable @typescript-eslint/no-explicit-any
*/

export type SelectorsBase = {
    $: WebdriverIO.Browser["$"];
    $$: WebdriverIO.Browser["$$"];
};

export type BaseWithExecute = {
    execute<T>(script: string | ((...args: any[]) => T), ...args: any[]): Promise<T>;

    execute<T>(script: string | ((...args: any[]) => T), ...args: any[]): T;

    executeAsync(script: string | ((...args: any[]) => void), ...args: any[]): any;
};

export type ElementBase = SelectorsBase & {
    parent: ElementBase | BaseWithExecute;
    selector?: string;
};

export type BrowserBase = SelectorsBase & {
    addCommand<T extends boolean>(
        queryName: string,
        commandFn: (this: T extends true ? ElementBase : BrowserBase, ...args: any[]) => void,
        isElementCommand?: T,
    ): any;
};
