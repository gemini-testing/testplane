import { io } from "socket.io-client";
import { BrowserError } from "./errors/index.js";
import { BROWSER_EVENT_PREFIX } from "./constants.js";
import type { BrowserViteSocket } from "./types.js";

const connectToSocket = (): BrowserViteSocket => {
    const socket = io({
        auth: {
            runUuid: window.__testplane__.runUuid,
            type: BROWSER_EVENT_PREFIX,
        },
    }) as BrowserViteSocket;

    socket.on("connect_error", err => {
        const { runUuid, sessionId, file } = window.__testplane__;

        console.error(
            `Couldn't connect to the server with "runUuid=${runUuid}", "sessionId=${sessionId} and "file=${file}" due to an error: ${err}`,
        );
    });

    return socket;
};

const proxyTool = (): void => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const proxyHandler: ProxyHandler<any> = {
        get(target, prop) {
            return prop in target ? target[prop] : new Proxy(() => {}, this);
        },
        apply() {
            return new Proxy(() => {}, this);
        },
    };

    window.testplane = new Proxy(window.testplane || {}, proxyHandler);
    window.hermione = new Proxy(window.hermione || {}, proxyHandler);
};

const subscribeOnBrowserErrors = (): void => {
    addEventListener("error", e =>
        window.__testplane__.errors.push(
            BrowserError.create({
                message: e.message,
                stack: e.error.stack,
                file: e.filename,
            }),
        ),
    );
};

const mockDialog =
    <T>({ name, value }: { name: string; value: T }) =>
    (...params: unknown[]): T => {
        const formatedParams = params.map(p => JSON.stringify(p)).join(", ");

        console.warn(
            `Testplane encountered a \`${name}(${formatedParams})\` call that would block the web page and won't allow the test to continue, so it was mocked and \`${value}\` was returned instead.`,
        );

        return value;
    };

const mockBlockingDialogs = (): void => {
    window.alert = mockDialog({ name: "alert", value: undefined });
    window.confirm = mockDialog({ name: "confirm", value: false });
    window.prompt = mockDialog({ name: "prompt", value: null });
};

const mockBuiltInNodeJsModules = (): void => {
    window.process = window.process || {
        platform: "browser",
        env: {},
        stdout: {},
        stderr: {},
        cwd: () => "",
    };
};

window.__testplane__.errors = [];
window.__testplane__.socket = connectToSocket();

proxyTool();
subscribeOnBrowserErrors();
mockBlockingDialogs();
mockBuiltInNodeJsModules();
