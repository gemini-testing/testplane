import path from "node:path";
import type repl from "node:repl";
import net from "node:net";
import { Writable, Readable } from "node:stream";
import { getEventListeners } from "node:events";
import chalk from "chalk";
import RuntimeConfig from "../../config/runtime-config";
import * as logger from "../../utils/logger";
import type { Browser } from "../types";

const REPL_LINE_EVENT = "line";

export default (browser: Browser): void => {
    const { publicAPI: session } = browser;

    const applyContext = (replServer: repl.REPLServer, ctx: Record<string, unknown> = {}): void => {
        if (!ctx.browser) {
            ctx.browser = session;
        }

        for (const [key, value] of Object.entries(ctx)) {
            Object.defineProperty(replServer.context, key, {
                configurable: false,
                enumerable: true,
                value,
            });
        }
    };

    const handleLines = (replServer: repl.REPLServer): void => {
        const lineEvents = getEventListeners(replServer, REPL_LINE_EVENT);
        replServer.removeAllListeners(REPL_LINE_EVENT);

        replServer.on(REPL_LINE_EVENT, cmd => {
            const trimmedCmd = cmd.trim();
            const newCmd = trimmedCmd.replace(/(?<=^|\s|;|\(|\{)(let |const )/g, "var ");

            for (const event of lineEvents) {
                event(newCmd);
            }
        });
    };

    const broadcastMessage = (message: string, sockets: net.Socket[]): void => {
        for (const s of sockets) {
            s.write(message);
        }
    };

    session.addCommand("switchToRepl", async function (ctx: Record<string, unknown> = {}) {
        const runtimeCfg = RuntimeConfig.getInstance();
        const { onReplMode } = browser.state;

        if (!runtimeCfg.replMode || !runtimeCfg.replMode.enabled) {
            throw new Error(
                'Command "switchToRepl" available only in REPL mode, which can be started using cli option: "--repl", "--repl-before-test" or "--repl-on-fail"',
            );
        }

        if (onReplMode) {
            logger.warn(chalk.yellow("Testplane is already in REPL mode"));
            return;
        }

        logger.log(
            chalk.yellow(
                `You have entered to REPL mode via terminal (test execution timeout is disabled). Port to connect to REPL from other terminals: ${runtimeCfg.replMode.port}`,
            ),
        );

        const currCwd = process.cwd();
        const testCwd = path.dirname(session.executionContext.ctx.currentTest.file!);
        process.chdir(testCwd);

        let allSockets: net.Socket[] = [];

        const input = new Readable({ read(): void {} });
        const output = new Writable({
            write(chunk, _, callback): void {
                broadcastMessage(chunk.toString(), [...allSockets, process.stdout]);
                callback();
            },
        });

        const replServer = await import("node:repl").then(repl => repl.start({ prompt: "> ", input, output }));

        const netServer = net
            .createServer(socket => {
                allSockets.push(socket);

                socket.on("data", data => {
                    broadcastMessage(data.toString(), [...allSockets.filter(s => s !== socket), process.stdout]);
                    input.push(data);
                });

                socket.on("close", () => {
                    allSockets = allSockets.filter(s => s !== socket);
                });
            })
            .listen(runtimeCfg.replMode.port);

        process.stdin.on("data", data => {
            broadcastMessage(data.toString(), allSockets);
            input.push(data);
        });

        browser.applyState({ onReplMode: true });
        runtimeCfg.extend({ replServer });

        applyContext(replServer, ctx);
        handleLines(replServer);

        return new Promise<void>(resolve => {
            return replServer.on("exit", () => {
                netServer.close();

                for (const socket of allSockets) {
                    socket.end("The server was closed after the REPL was exited");
                }

                process.chdir(currCwd);
                browser.applyState({ onReplMode: false });
                resolve();
            });
        });
    });
};
