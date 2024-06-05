import { CONSOLE_METHODS } from "../constants.js";
import { BrowserEventNames } from "../types.js";

const isDOMElement = (data: unknown): data is Element => data instanceof Element;

export const wrapConsoleMethods = (): void => {
    const { socket } = window.__testplane__;

    for (const method of CONSOLE_METHODS) {
        const origCommand = console[method].bind(console);

        console[method] = (...args: unknown[]): void => {
            const preparedArgs = args.map(arg => (isDOMElement(arg) ? arg.outerHTML : arg));

            socket.emit(BrowserEventNames.callConsoleMethod, { method, args: preparedArgs });

            origCommand(...args);
        };
    }
};
