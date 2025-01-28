import { CONSOLE_METHODS } from "../constants.js";
import { BrowserEventNames } from "../types.js";
const isDOMElement = (data) => data instanceof Element;
export const wrapConsoleMethods = () => {
    const { socket } = window.__testplane__;
    for (const method of CONSOLE_METHODS) {
        const origCommand = console[method].bind(console);
        console[method] = (...args) => {
            const preparedArgs = args.map(arg => (isDOMElement(arg) ? arg.outerHTML : arg));
            socket.emit(BrowserEventNames.callConsoleMethod, { method, args: preparedArgs });
            origCommand(...args);
        };
    }
};
//# sourceMappingURL=console.js.map