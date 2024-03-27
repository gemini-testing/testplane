// import { commands } from 'virtual:hermione';
import { webdriverMonad, sessionEnvironmentDetector } from '@wdio/utils';
// import { webdriverMonad } from '@wdio/utils';
import { getEnvironmentVars } from 'webdriver';
import { BrowserEventNames, WorkerEventNames, type WorkerCommandResultMessage } from "./types.js";

// console.log('webdriverMonad:', webdriverMonad);
// console.log('sessionEnvironmentDetector:', sessionEnvironmentDetector);

// import { MESSAGE_TYPES, type Workers } from '@wdio/types'
// import { browser } from '@wdio/globals'

// import { getCID, sanitizeConsoleArgs } from './utils.js'
// import { WDIO_EVENT_NAME } from '../constants.js'

const COMMAND_TIMEOUT = 30 * 1000; // 30s
// const CONSOLE_METHODS = ['log', 'info', 'warn', 'error', 'debug'] as const
// interface CommandMessagePromise {
//     resolve: (value: unknown) => void
//     reject: (err: Error) => void
//     commandName: string
//     commandTimeout?: NodeJS.Timeout
// }

// const HIDE_REPORTER_FOR_COMMANDS = ['saveScreenshot', 'savePDF']
// const mochaFramework = document.querySelector('mocha-framework')
// let id = 0

import {
    WebDriverProtocol, MJsonWProtocol, JsonWProtocol, AppiumProtocol,
    ChromiumProtocol, SauceLabsProtocol, SeleniumProtocol, GeckoProtocol,
    WebDriverBidiProtocol
} from "@wdio/protocols";

// const commands = merge(
const commands = {
    ...WebDriverProtocol,
    ...MJsonWProtocol,
    ...JsonWProtocol,
    ...AppiumProtocol,
    ...ChromiumProtocol,
    ...SauceLabsProtocol,
    ...SeleniumProtocol,
    ...GeckoProtocol,
    ...WebDriverBidiProtocol
 } as Record<string, Record<string, {command: string}>>;

const protocolCommandList = Object.values(commands).map(
    (endpoint) => Object.values(endpoint).map(
        ({ command }) => command
    )
).flat();

console.log('protocolCommandList:', protocolCommandList);
console.log('commands:', commands);

interface CommandMessagePromise {
    resolve: (value: unknown) => void
    reject: (err: Error) => void
    commandTimeout?: NodeJS.Timeout
}

export default class ProxyDriver {
    static #communicator = window.__hermione__.communicator;
    static #cmdResultMessages = new Map<string, CommandMessagePromise>();

    constructor(...args: unknown[]) {
        console.log('DRIVER args:', args);
    }
    // static #commandMessages = new Map<number, CommandMessagePromise>()

    // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
    static newSession (
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        params: any,
        modifier: never,
        userPrototype: Record<string, PropertyDescriptor>,
        commandWrapper: VoidFunction | undefined,
    ) {
        console.log('params:', params);
        console.log('modifier:', modifier);
        console.log('userPrototype:', userPrototype);
        console.log('commandWrapper:', commandWrapper);

        this.#communicator.subscribeOnMessage<WorkerEventNames.commandResult>(
            WorkerEventNames.commandResult,
            this.#handleCommandResultMessage.bind(this)
        );


        // const cid = getCID()
        // if (!cid) {
        //     throw new Error('"cid" query parameter is missing')
        // }

        /**
         * log all console events once connected
         */
        // this.#wrapConsolePrototype(cid)

        // /**
        //  * listen on socket events from testrunner
        //  */
        // import.meta.hot?.on(WDIO_EVENT_NAME, this.#handleServerMessage.bind(this))
        // import.meta.hot?.send(WDIO_EVENT_NAME, {
        //     type: MESSAGE_TYPES.initiateBrowserStateRequest,
        //     value: { cid }
        // })
        const { capabilities, requestedCapabilities } = window.__hermione__;

        const environment = sessionEnvironmentDetector({ capabilities, requestedCapabilities: requestedCapabilities as WebdriverIO.Capabilities });
        const environmentPrototype: Record<string, PropertyDescriptor> = getEnvironmentVars(environment);
        // // have debug command
        const commandsProcessedInNodeWorld = [...protocolCommandList, 'debug', 'saveScreenshot', 'savePDF', ...window.__hermione__.customCommands];
        const protocolCommands = commandsProcessedInNodeWorld.reduce((prev, commandName) => {
            prev[commandName] = {
                value: this.#getMockedCommand(commandName)
            }
            return prev
        }, {} as Record<string, { value: VoidFunction }>)

        // /**
        //  * handle certain commands on the server side
        //  */
        // delete userPrototype.debug
        // delete userPrototype.saveScreenshot
        // delete userPrototype.savePDF

        console.log('protocolCommands:', protocolCommands);
        console.log('environmentPrototype:', environmentPrototype);
        console.log('userPrototype:', userPrototype);

        const prototype = {
            /**
             * custom protocol commands that communicate with Vite
             */
            ...protocolCommands,
            /**
             * environment flags
             */
            ...environmentPrototype,
            /**
             * unmodified WebdriverIO commands
             */
            ...userPrototype
        }
        prototype.emit = { writable: true, value: (): void => {} }
        prototype.on = { writable: true, value: (): void => {} }

        const monad = webdriverMonad(params, modifier, prototype)
        return monad("window.__wdioEnv__.sessionId", commandWrapper);
    }

    static #getMockedCommand(commandName: string) {
        // const isDebugCommand = commandName === 'debug'
        return async (...args: unknown[]): Promise<unknown> => {
            console.log(`call command: ${commandName} with args: ${args}`);

            // if (!import.meta.hot) {
            //     throw new Error('Could not connect to testrunner')
            // }

            // id++

            // /**
            //  * print information which command is executed (except for debug commands)
            //  */
            // console.log(...(isDebugCommand
            //     ? ['[WDIO] %cDebug Mode Enabled', 'background: #ea5906; color: #fff; padding: 3px; border-radius: 5px;']
            //     : [`[WDIO] ${(new Date()).toISOString()} - id: ${id} - COMMAND: ${commandName}(${args.join(', ')})`]
            // ))

            // if (HIDE_REPORTER_FOR_COMMANDS.includes(commandName) && mochaFramework) {
            //     mochaFramework.setAttribute('style', 'display: none')
            // }

            const cmdUuid = crypto.randomUUID();

            this.#communicator.sendMessage(BrowserEventNames.runCommand, {
                cmdUuid,
                command: {
                    name: commandName,
                    args
                }
            });

            // try {
                // TODO: should use httpTimeout and urlHttpTimeout
            // const {result, error} = await communicator.waitMessage<WorkerEventNames.commandResult>({cmdUuid});
            // console.log('browser get result:', result);
            // console.log('browser get error:', error);

            // if (!error) {
            //     return result;
            // } else {
            //     throw error;
            // }

            // } catch (error) {
            // }


            // import.meta.hot.send(WDIO_EVENT_NAME, this.#commandRequest({
            //     commandName,
            //     cid,
            //     id,
            //     args
            // }))

            return new Promise((resolve, reject) => {
                // setTimeout(() => {
                //     resolve();
                // }, 1000);

                // TODO: should not specify timeout for `debug` or `switchToRepl` command ???

                // let commandTimeout;
                // if (!isDebugCommand) {
                const commandTimeout = setTimeout(
                    () => reject(new Error(`Command "${commandName}" timed out`)),
                    COMMAND_TIMEOUT
                )
                // }

                this.#cmdResultMessages.set(cmdUuid, { resolve, reject, commandTimeout })
            })
        }
    }

    static async #handleCommandResultMessage(msg: WorkerCommandResultMessage) {
        console.log("browser got cmd result response:", msg);

        if (!msg.cmdUuid) {
            return console.error(`Got message from worker without cmdUuid: ${JSON.stringify(msg)}`);
        }

        const cmdMessage = this.#cmdResultMessages.get(msg.cmdUuid);
        if (!cmdMessage) {
            return console.error(`Command with cmdUuid "${msg.cmdUuid}" does not found`);
        }

        const { result, error } = msg;

        if (error) {
            return cmdMessage.reject(error);
        }

        if (cmdMessage.commandTimeout) {
            clearTimeout(cmdMessage.commandTimeout);
        }

        cmdMessage.resolve(result);
        this.#cmdResultMessages.delete(msg.cmdUuid);
    }

    // static #handleServerMessage (payload: Workers.SocketMessage) {
    //     if (payload.type === MESSAGE_TYPES.commandResponseMessage) {
    //         return this.#handleCommandResponse(payload.value)
    //     }
    //     if (payload.type === MESSAGE_TYPES.initiateBrowserStateResponse) {
    //         return this.#handleBrowserInitiation(payload.value)
    //     }
    // }

    // static #handleCommandResponse (value: Workers.CommandResponseEvent) {
    //     if (!value.id) {
    //         return console.error(`Message without id: ${JSON.stringify(value)}`)
    //     }

    //     const commandMessage = this.#commandMessages.get(value.id)
    //     if (!commandMessage) {
    //         return console.error(`Unknown command id "${value.id}"`)
    //     }

    //     if (HIDE_REPORTER_FOR_COMMANDS.includes(commandMessage.commandName) && mochaFramework) {
    //         mochaFramework.removeAttribute('style')
    //     }

    //     if (value.error) {
    //         console.log(`[WDIO] ${(new Date()).toISOString()} - id: ${value.id} - ERROR: ${JSON.stringify(value.error.message)}`)
    //         return commandMessage.reject(new Error(value.error.message || 'unknown error'))
    //     }
    //     if (commandMessage.commandTimeout) {
    //         clearTimeout(commandMessage.commandTimeout)
    //     }
    //     console.log(`[WDIO] ${(new Date()).toISOString()} - id: ${value.id} - RESULT: ${JSON.stringify(value.result)}`)
    //     commandMessage.resolve(value.result)
    //     this.#commandMessages.delete(value.id)
    // }

    // /**
    //  * Initiate browser states even in case page loads happen. This is necessary so we can
    //  * add a custom command that was added in the Node.js environment to the browser scope
    //  * within the browser so the instance is aware of it and can translate the command
    //  * request back to the worker process
    //  */
    // static #handleBrowserInitiation (value: Workers.BrowserState) {
    //     const cid = getCID()
    //     if (!cid) {
    //         return
    //     }
    //     for (const commandName of value.customCommands) {
    //         browser.addCommand(commandName, this.#getMockedCommand(cid, commandName))
    //     }
    // }

    // static #wrapConsolePrototype (cid: string) {
    //     for (const method of CONSOLE_METHODS) {
    //         const origCommand = console[method].bind(console)
    //         console[method] = (...args: unknown[]) => {
    //             import.meta.hot?.send(WDIO_EVENT_NAME, this.#consoleMessage({
    //                 name: 'consoleEvent',
    //                 type: method,
    //                 args: sanitizeConsoleArgs(args),
    //                 cid
    //             }))
    //             origCommand(...args)
    //         }
    //     }
    // }

    // static #commandRequest (value: Workers.CommandRequestEvent): Workers.SocketMessage {
    //     return {
    //         type: MESSAGE_TYPES.commandRequestMessage,
    //         value
    //     }
    // }

    // static #consoleMessage (value: Workers.ConsoleEvent): Workers.SocketMessage {
    //     return {
    //         type: MESSAGE_TYPES.consoleMessage,
    //         value
    //     }
    // }
}
