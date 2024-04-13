import {
    WebDriverProtocol,
    MJsonWProtocol,
    JsonWProtocol,
    AppiumProtocol,
    ChromiumProtocol,
    SauceLabsProtocol,
    SeleniumProtocol,
    GeckoProtocol,
    WebDriverBidiProtocol,
} from "@wdio/protocols";
import { webdriverMonad, sessionEnvironmentDetector, devtoolsEnvironmentDetector } from "@wdio/utils";
import { getEnvironmentVars } from "webdriver";
import { SOCKET_MAX_TIMEOUT, SOCKET_TIMED_OUT_ERROR, MAX_ARGS_LENGTH } from "./constants.js";
import { BrowserEventNames } from "./types.js";

type ProtocolCommandFn = (...args: unknown[]) => Promise<unknown>;
type PropertiesObject = Record<string, PropertyDescriptor>;

export default class ProxyDriver {
    static newSession(
        params: Record<string, unknown>,
        modifier: never,
        userPrototype: Record<string, PropertyDescriptor>,
        commandWrapper: VoidFunction | undefined,
    ): unknown {
        const monad = webdriverMonad(params, modifier, getWdioPrototype(userPrototype));
        return monad(window.__testplane__.sessionId, commandWrapper);
    }
}

function getWdioPrototype(userPrototype: Record<string, PropertyDescriptor>): PropertiesObject {
    const prototype = {
        ...userPrototype,
        ...getMockedProtocolCommands(),
        ...getEnvironmentFlags(),
    };

    return prototype;
}

function getAllProtocolCommands(): string[] {
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
    const commands = new Set<string>();

    for (const protocol of protocols) {
        for (const endpointData of Object.values(protocol)) {
            for (const { command } of Object.values<{ command: string }>(endpointData)) {
                commands.add(command);
            }
        }
    }

    return Array.from(commands);
}

function getMockedProtocolCommands(): PropertiesObject {
    return [...getAllProtocolCommands(), ...window.__testplane__.customCommands].reduce((acc, commandName) => {
        acc[commandName] = { value: mockCommand(commandName) };
        return acc;
    }, {} as PropertiesObject);
}

function mockCommand(commandName: string): ProtocolCommandFn {
    return async (...args: unknown[]): Promise<unknown> => {
        const { socket } = window.__testplane__;
        const timeout = getCommandTimeout(commandName);

        try {
            // TODO: remove type casting after https://github.com/socketio/socket.io/issues/4925
            const [error, result] = (await socket
                .timeout(timeout)
                .emitWithAck(BrowserEventNames.runBrowserCommand, { name: commandName, args })) as [
                err: null | Error,
                result?: unknown,
            ];

            if (error) {
                throw error;
            }

            return result;
        } catch (err) {
            let error = err as Error;

            if (error.message === SOCKET_TIMED_OUT_ERROR) {
                error = new Error(
                    `Didn't receive response from worker when executing browser command "${commandName}" with arguments "[${normalizeCommandArgs(
                        commandName,
                        args,
                    )}]" in ${timeout}ms`,
                );
            }

            throw error;
        }
    };
}

function getEnvironmentFlags(): Record<string, PropertyDescriptor> {
    const { capabilities, requestedCapabilities, config } = window.__testplane__;

    const environment =
        config.automationProtocol === "devtools"
            ? devtoolsEnvironmentDetector(capabilities as WebdriverIO.Capabilities)
            : sessionEnvironmentDetector({
                  capabilities,
                  requestedCapabilities: requestedCapabilities as WebdriverIO.Capabilities,
              });

    return getEnvironmentVars(environment);
}

function getCommandTimeout(commandName: string): number {
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

function normalizeCommandArgs(name: string, args: unknown[] = []): unknown[] {
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

function truncate(value: string, maxLen: number): string {
    if (value.length <= maxLen) {
        return value;
    }

    return `${value.slice(0, maxLen - 3)}...`;
}
