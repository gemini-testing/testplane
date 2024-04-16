import { CONSOLE_METHODS } from "../constants.js";
import { BrowserEventNames } from "../types.js";

export const wrapConsoleMethods = (): void => {
    const { socket } = window.__testplane__;

    for (const method of CONSOLE_METHODS) {
        const origCommand = console[method].bind(console);

        console[method] = (...args: unknown[]): void => {
            socket.emit(BrowserEventNames.callConsoleMethod, { method, args });

            origCommand(...args);
        };
    }
};
