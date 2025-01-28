"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TestRunner = void 0;
const node_crypto_1 = __importDefault(require("node:crypto"));
const bluebird_1 = __importDefault(require("bluebird"));
const lodash_1 = __importDefault(require("lodash"));
const socket_io_client_1 = require("socket.io-client");
const url_join_1 = __importDefault(require("url-join"));
const test_runner_1 = __importDefault(require("../../../runner/test-runner"));
const execution_thread_1 = require("./execution-thread");
const types_1 = require("./types");
const constants_1 = require("./constants");
const constants_2 = require("../../../../runner/browser-env/vite/constants");
const logger_1 = __importDefault(require("../../../../utils/logger"));
const runtime_config_1 = __importDefault(require("../../../../config/runtime-config"));
const abort_on_reconnect_error_1 = require("../../../../errors/abort-on-reconnect-error");
const types_2 = require("../../../../runner/browser-env/vite/types");
const prepareData = (data) => {
    return JSON.parse(JSON.stringify(data, Object.getOwnPropertyNames(data)));
};
class TestRunner extends test_runner_1.default {
    constructor(opts) {
        super(opts);
        this._runUuid = node_crypto_1.default.randomUUID();
        this._isReconnected = false;
        this._broInitResOnReconnect = null;
        this._socket = (0, socket_io_client_1.io)(runtime_config_1.default.getInstance().viteBaseUrl, {
            transports: ["websocket"],
            auth: {
                runUuid: this._runUuid,
                type: constants_1.WORKER_EVENT_PREFIX,
            },
        });
        this._socket.on("connect_error", err => {
            if (!this._socket.active) {
                logger_1.default.warn(`Worker with pid=${process.pid} and runUuid=${this._runUuid} was disconnected from the Vite server:`, err);
            }
        });
    }
    async run(opts) {
        this._runOpts = opts;
        let error;
        try {
            await super.prepareToRun(this._runOpts);
            error = await this._runWithAbort(throwIfAborted => {
                const ExecutionThreadCls = (0, execution_thread_1.wrapExecutionThread)(this._socket, throwIfAborted);
                return super.runRunnables(ExecutionThreadCls);
            });
        }
        catch (err) {
            error = err;
        }
        while (error instanceof abort_on_reconnect_error_1.AbortOnReconnectError) {
            error = null;
            try {
                await this._waitBroInitOnReconnect();
                error = await this._runWithAbort(throwIfAborted => {
                    const ExecutionThreadCls = (0, execution_thread_1.wrapExecutionThread)(this._socket, throwIfAborted);
                    return super.runRunnables(ExecutionThreadCls);
                });
            }
            catch (err) {
                error = err;
            }
        }
        const results = await super.finishRun(error);
        this._socket.emit(types_1.WorkerEventNames.finalize);
        if (error) {
            throw error;
        }
        return results;
    }
    _runWithAbort(cb) {
        const controller = new AbortController();
        const { signal } = controller;
        let isAborted = signal.aborted;
        signal.addEventListener("abort", () => {
            isAborted = true;
        });
        const throwIfAborted = () => {
            if (isAborted) {
                throw new abort_on_reconnect_error_1.AbortOnReconnectError();
            }
        };
        this._socket.once(types_2.BrowserEventNames.reconnect, () => {
            this._broInitResOnReconnect = null;
            this._socket.once(types_2.BrowserEventNames.initialize, errors => {
                this._broInitResOnReconnect = errors;
            });
            if (this._browser.state.onReplMode) {
                runtime_config_1.default.getInstance().replServer.close();
            }
            this._isReconnected = true;
            controller.abort();
        });
        return cb(throwIfAborted);
    }
    _waitBroInitOnReconnect() {
        let intervalId = null;
        return new bluebird_1.default((resolve, reject) => {
            intervalId = setInterval(() => {
                if (lodash_1.default.isNull(this._broInitResOnReconnect)) {
                    return;
                }
                if (intervalId) {
                    clearInterval(intervalId);
                }
                if (lodash_1.default.isEmpty(this._broInitResOnReconnect)) {
                    resolve();
                }
                else {
                    reject(this._broInitResOnReconnect[0]);
                }
            }, constants_1.BRO_INIT_INTERVAL_ON_RECONNECT).unref();
        })
            .timeout(constants_1.BRO_INIT_TIMEOUT_ON_RECONNECT, `Browser didn't connect to the Vite server after reconnect in ${constants_1.BRO_INIT_TIMEOUT_ON_RECONNECT}ms`)
            .catch(err => {
            if (intervalId) {
                clearInterval(intervalId);
            }
            throw err;
        });
    }
    _getPreparePageActions(browser, history) {
        if (this._isReconnected) {
            return super._getPreparePageActions(browser, history);
        }
        return [
            async () => {
                const { default: expectMatchers } = await Promise.resolve().then(() => __importStar(require("expect-webdriverio/lib/matchers")));
                this._socket.on(types_2.BrowserEventNames.callConsoleMethod, payload => {
                    console[payload.method](...(payload.args || []));
                });
                this._socket.on(types_2.BrowserEventNames.runBrowserCommand, this._handleRunBrowserCommand(browser));
                this._socket.on(types_2.BrowserEventNames.runExpectMatcher, this._handleRunExpectMatcher(browser, expectMatchers));
                this._socket.emit(types_1.WorkerEventNames.initialize, {
                    file: this._file,
                    sessionId: this._runOpts.sessionId,
                    capabilities: this._runOpts.sessionCaps,
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    requestedCapabilities: this._runOpts.sessionOpts.capabilities,
                    customCommands: browser.customCommands,
                    config: this._config,
                    expectMatchers: Object.getOwnPropertyNames(expectMatchers),
                });
                await history.runGroup(browser.callstackHistory, "openVite", async () => {
                    await this._openViteUrl(browser);
                });
            },
            ...super._getPreparePageActions(browser, history),
        ];
    }
    _handleRunBrowserCommand(browser) {
        const { publicAPI: session } = browser;
        return async (payload, cb) => {
            const { name, args, element } = payload;
            const wdioInstance = await getWdioInstance(session, element);
            const wdioInstanceName = element ? "element" : "browser";
            const cmdName = name;
            if (typeof wdioInstance[cmdName] !== "function") {
                cb([
                    prepareData(new Error(`"${wdioInstanceName}.${name}" does not exists in ${wdioInstanceName} instance`)),
                ]);
                return;
            }
            try {
                const result = await wdioInstance[cmdName](...args);
                if (lodash_1.default.isError(result)) {
                    return cb([prepareData(result)]);
                }
                if (lodash_1.default.isArray(result)) {
                    return cb([null, result.map(prepareData)]);
                }
                cb([null, lodash_1.default.isObject(result) ? prepareData(result) : result]);
            }
            catch (err) {
                cb([prepareData(err)]);
            }
        };
    }
    _handleRunExpectMatcher(browser, expectMatchers) {
        const { publicAPI: session } = browser;
        return async (payload, cb) => {
            if (typeof expect === "undefined") {
                return cb([{ pass: false, message: "Couldn't find expect module" }]);
            }
            const matcher = expectMatchers[payload.name];
            if (!matcher) {
                return cb([{ pass: false, message: `Couldn't find expect matcher with name "${payload.name}"` }]);
            }
            try {
                let context = payload.context || session;
                if (payload.element) {
                    if (lodash_1.default.isArray(payload.element)) {
                        context = await session.$$(payload.element);
                    }
                    else if (payload.element.elementId) {
                        context = await session.$(payload.element);
                        context.selector = payload.element.selector;
                    }
                    else {
                        context = await session.$(payload.element.selector);
                    }
                }
                const result = await matcher.apply(payload.scope, [context, ...payload.args.map(transformExpectArg)]);
                cb([{ pass: result.pass, message: result.message() }]);
            }
            catch (err) {
                cb([{ pass: false, message: `Failed to execute expect command "${payload.name}": ${err}` }]);
            }
        };
    }
    async _openViteUrl(browser) {
        const browserInitialize = new bluebird_1.default((resolve, reject) => {
            this._socket.once(types_2.BrowserEventNames.initialize, errors => {
                lodash_1.default.isEmpty(errors) ? resolve() : reject(errors[0]);
            });
        });
        const timeout = this._config.urlHttpTimeout || this._config.httpTimeout;
        const uri = (0, url_join_1.default)(this._config.baseUrl, constants_2.VITE_RUN_UUID_ROUTE, this._runUuid);
        await Promise.all([
            browserInitialize.timeout(timeout, `Browser didn't connect to the Vite server in ${timeout}ms`),
            browser.publicAPI.url(uri),
        ]);
    }
}
exports.TestRunner = TestRunner;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function transformExpectArg(arg) {
    if (typeof arg === "object" &&
        "$$typeof" in arg &&
        Object.keys(constants_1.SUPPORTED_ASYMMETRIC_MATCHER).includes(arg.$$typeof)) {
        const matcherKey = constants_1.SUPPORTED_ASYMMETRIC_MATCHER[arg.$$typeof];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const matcher = arg.inverse ? expect[matcherKey] : expect[matcherKey];
        if (!matcher) {
            throw new Error(`Matcher "${matcherKey}" is not supported by expect-webdriverio`);
        }
        return matcher(arg.sample);
    }
    return arg;
}
async function getWdioInstance(session, element) {
    const wdioInstance = element ? await session.$(element) : session;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (isWdioElement(wdioInstance) && !wdioInstance.selector) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        wdioInstance.selector = element?.selector;
    }
    return wdioInstance;
}
function isWdioElement(ctx) {
    return Boolean(ctx.elementId);
}
//# sourceMappingURL=index.js.map