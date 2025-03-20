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
const node_repl_1 = __importDefault(require("node:repl"));
const node_path_1 = __importDefault(require("node:path"));
const node_events_1 = require("node:events");
const chalk_1 = __importDefault(require("chalk"));
const runtime_config_1 = __importDefault(require("../../config/runtime-config"));
const logger = __importStar(require("../../utils/logger"));
const REPL_LINE_EVENT = "line";
exports.default = (browser) => {
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
        const runtimeCfg = runtime_config_1.default.getInstance();
        const { onReplMode } = browser.state;
        if (!runtimeCfg.replMode?.enabled) {
            throw new Error('Command "switchToRepl" available only in REPL mode, which can be started using cli option: "--repl", "--repl-before-test" or "--repl-on-fail"');
        }
        if (onReplMode) {
            logger.warn(chalk_1.default.yellow("Testplane is already in REPL mode"));
            return;
        }
        logger.log(chalk_1.default.yellow("You have entered to REPL mode via terminal (test execution timeout is disabled)."));
        const currCwd = process.cwd();
        const testCwd = node_path_1.default.dirname(session.executionContext.ctx.currentTest.file);
        process.chdir(testCwd);
        const replServer = node_repl_1.default.start({ prompt: "> " });
        browser.applyState({ onReplMode: true });
        runtimeCfg.extend({ replServer });
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