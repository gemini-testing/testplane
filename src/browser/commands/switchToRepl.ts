import repl from "node:repl";
import path from "node:path";
import { getEventListeners } from "node:events";
import chalk from "chalk";
import * as RuntimeConfig from "../../config/runtime-config.js";
import logger from "../../utils/logger.js";
import type { Browser } from "../types.js";

const REPL_LINE_EVENT = "line";
// const chalk = chalkPkg.default ? chalkPkg.default : chalkPkg;

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

    session.addCommand("switchToRepl", async function (ctx: Record<string, unknown> = {}) {
        const { replMode } = RuntimeConfig.getInstance();
        const { onReplMode } = browser.state;

        if (!replMode?.enabled) {
            throw new Error(
                'Command "switchToRepl" available only in REPL mode, which can be started using cli option: "--repl", "--repl-before-test" or "--repl-on-fail"',
            );
        }

        if (onReplMode) {
            logger.warn(chalk.default.yellow("Hermione is already in REPL mode"));
            return;
        }

        logger.log(chalk.default.yellow("You have entered to REPL mode via terminal (test execution timeout is disabled)."));

        const currCwd = process.cwd();
        const testCwd = path.dirname(session.executionContext.ctx.currentTest.file!);
        process.chdir(testCwd);

        const replServer = repl.start({ prompt: "> " });
        browser.applyState({ onReplMode: true });

        applyContext(replServer, ctx);
        handleLines(replServer);

        return new Promise<void>(resolve => {
            return replServer.on("exit", () => {
                process.chdir(currCwd);
                browser.applyState({ onReplMode: false });
                resolve();
            });
        });
    });
};
