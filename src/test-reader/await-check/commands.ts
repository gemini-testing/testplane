import * as protocols from "@testplane/wdio-protocols";
import { getBrowserCommands, getElementCommands } from "../../browser/history/commands";

export interface CommandCatalog {
    browser: Set<string>;
    element: Set<string>;
}

export const syncCommands = new Set([
    "addCommand",
    "overwriteCommand",
    "on",
    "once",
    "off",
    "emit",
    "addListener",
    "removeListener",
    "removeAllListeners",
    "prependListener",
    "prependOnceListener",
    "listeners",
    "rawListeners",
    "listenerCount",
    "eventNames",
    "getMaxListeners",
    "setMaxListeners",
]);

export const elementCommands = new Set([
    "$",
    "custom$",
    "react$",
    "shadow$",
    "parentElement",
    "nextElement",
    "previousElement",
]);
export const elementsCommands = new Set(["$$", "custom$$", "react$$", "shadow$$"]);

export function createCommandCatalog(): CommandCatalog {
    const browser = new Set([
        ...getBrowserCommands(),
        "assertView",
        "clearSession",
        "getConfig",
        "getPuppeteer",
        "setOrientation",
        "scrollIntoView",
        "openAndWait",
        "switchToRepl",
        "unstable_captureDomSnapshot",
        "waitForStaticToLoad",
        "saveState",
        "restoreState",
        "getState",
        "unstable_getCdp",
        "getMeta",
        "setMeta",
        "addTag",
        "extendOptions",
        "runStep",
    ]);
    const element = new Set([...getElementCommands(), "assertView", "moveCursorTo", "unstable_captureDomSnapshot"]);
    const visit = (value: unknown): void => {
        if (!value || typeof value !== "object") return;
        const record = value as Record<string, unknown>;
        if (typeof record.command === "string") browser.add(record.command);
        Object.values(record).forEach(visit);
    };
    Object.values(protocols).forEach(visit);
    return { browser, element };
}
