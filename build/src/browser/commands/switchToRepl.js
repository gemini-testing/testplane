"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
const node_repl_1 = __importDefault(require("node:repl"));
const node_path_1 = __importDefault(require("node:path"));
const node_events_1 = require("node:events");
const chalk_1 = __importDefault(require("chalk"));
const runtime_config_1 = __importDefault(require("../../config/runtime-config"));
const logger_1 = __importDefault(require("../../utils/logger"));
const REPL_LINE_EVENT = "line";
module.exports = async (browser) => {
    const { publicAPI: session } = browser;
    const applyContext = (replServer, ctx = {}) => {
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
    const handleLines = (replServer) => {
        const lineEvents = (0, node_events_1.getEventListeners)(replServer, REPL_LINE_EVENT);
        replServer.removeAllListeners(REPL_LINE_EVENT);
        replServer.on(REPL_LINE_EVENT, cmd => {
            const trimmedCmd = cmd.trim();
            const newCmd = trimmedCmd.replace(/(?<=^|\s|;|\(|\{)(let |const )/g, "var ");
            for (const event of lineEvents) {
                event(newCmd);
            }
        });
    };
    session.addCommand("switchToRepl", async function (ctx = {}) {
        const { replMode } = runtime_config_1.default.getInstance();
        const { onReplMode } = browser.state;
        if (!replMode?.enabled) {
            throw new Error('Command "switchToRepl" available only in REPL mode, which can be started using cli option: "--repl", "--repl-before-test" or "--repl-on-fail"');
        }
        if (onReplMode) {
            logger_1.default.warn(chalk_1.default.yellow("Hermione is already in REPL mode"));
            return;
        }
        logger_1.default.log(chalk_1.default.yellow("You have entered REPL mode via terminal"));
        const currCwd = process.cwd();
        const testCwd = node_path_1.default.dirname(session.executionContext.ctx.currentTest.file);
        process.chdir(testCwd);
        const replServer = node_repl_1.default.start({ prompt: "> " });
        browser.applyState({ onReplMode: true });
        applyContext(replServer, ctx);
        handleLines(replServer);
        return new Promise(resolve => {
            return replServer.on("exit", () => {
                process.chdir(currCwd);
                browser.applyState({ onReplMode: false });
                resolve();
            });
        });
    });
};
//# sourceMappingURL=switchToRepl.js.map