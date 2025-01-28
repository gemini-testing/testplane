import { WebDriverProtocol, MJsonWProtocol, JsonWProtocol, AppiumProtocol, ChromiumProtocol, SauceLabsProtocol, SeleniumProtocol, GeckoProtocol, WebDriverBidiProtocol, } from "@wdio/protocols";
import { webdriverMonad, sessionEnvironmentDetector, devtoolsEnvironmentDetector } from "@wdio/utils";
import { getEnvironmentVars } from "webdriver";
import { SOCKET_MAX_TIMEOUT, SOCKET_TIMED_OUT_ERROR, MAX_ARGS_LENGTH } from "./constants.js";
import { BrowserEventNames } from "./types.js";
const SERVER_HANDLED_COMMANDS = ["debug", "saveScreenshot", "savePDF"];
export default class ProxyDriver {
    static newSession(params, modifier, userPrototype, commandWrapper) {
        const monad = webdriverMonad(params, modifier, getWdioPrototype(userPrototype));
        const browser = monad(window.__testplane__.sessionId, commandWrapper);
        window.__testplane__.customCommands.forEach(({ name, elementScope }) => {
            browser.addCommand(name, mockCommand(name), elementScope);
        });
        return browser;
    }
}
function getWdioPrototype(userPrototype) {
    const prototype = {
        ...userPrototype,
        ...getMockedProtocolCommands(),
        ...getEnvironmentFlags(),
    };
    return prototype;
}
function getAllProtocolCommands() {
    const protocols = [
        WebDriverProtocol,
        MJsonWProtocol,
        JsonWProtocol,
        AppiumProtocol,
        ChromiumProtocol,
        SauceLabsProtocol,
        SeleniumProtocol,
        GeckoProtocol,
        WebDriverBidiProtocol,
    ];
    const commands = new Set();
    for (const protocol of protocols) {
        for (const endpointData of Object.values(protocol)) {
            for (const { command } of Object.values(endpointData)) {
                commands.add(command);
            }
        }
    }
    return Array.from(commands);
}
function getMockedProtocolCommands() {
    return [...getAllProtocolCommands(), ...SERVER_HANDLED_COMMANDS].reduce((acc, commandName) => {
        acc[commandName] = { value: mockCommand(commandName) };
        return acc;
    }, {});
}
function mockCommand(commandName) {
    return async function (...args) {
        const { socket } = window.__testplane__;
        const timeout = getCommandTimeout(commandName);
        const element = isWdioElement(this) ? this : undefined;
        try {
            // TODO: remove type casting after https://github.com/socketio/socket.io/issues/4925
            const [error, result] = (await socket
                .timeout(timeout)
                .emitWithAck(BrowserEventNames.runBrowserCommand, { name: commandName, args, element }));
            if (error) {
                throw error;
            }
            return result;
        }
        catch (err) {
            let error = err;
            if (error.message === SOCKET_TIMED_OUT_ERROR) {
                error = new Error(`Didn't receive response from worker when executing browser command "${commandName}" with arguments "[${normalizeCommandArgs(commandName, args)}]" in ${timeout}ms`);
            }
            throw error;
        }
    };
}
function getEnvironmentFlags() {
    const { capabilities, requestedCapabilities, config } = window.__testplane__;
    const environment = config.automationProtocol === "devtools"
        ? devtoolsEnvironmentDetector(capabilities)
        : sessionEnvironmentDetector({
            capabilities,
            requestedCapabilities: requestedCapabilities,
        });
    return getEnvironmentVars(environment);
}
function getCommandTimeout(commandName) {
    const { config } = window.__testplane__;
    let timeout = config.httpTimeout;
    if (commandName === "debug" || commandName === "switchToRepl") {
        timeout = SOCKET_MAX_TIMEOUT;
    }
    if (commandName === "navigateTo" && config.urlHttpTimeout) {
        timeout = config.urlHttpTimeout;
    }
    return timeout;
}
function normalizeCommandArgs(name, args = []) {
    if (name === "execute") {
        return ["code"];
    }
    return args.map(arg => {
        if (typeof arg === "string") {
            return truncate(arg, MAX_ARGS_LENGTH);
        }
        if (arg !== null && typeof arg === "object") {
            return "obj";
        }
        return arg;
    });
}
function truncate(value, maxLen) {
    if (value.length <= maxLen) {
        return value;
    }
    return `${value.slice(0, maxLen - 3)}...`;
}
function isWdioElement(ctx) {
    return Boolean(ctx.elementId);
}
//# sourceMappingURL=driver.js.map