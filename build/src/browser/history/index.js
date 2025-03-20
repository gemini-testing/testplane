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
Object.defineProperty(exports, "__esModule", { value: true });
exports.initCommandHistory = exports.runGroup = exports.shouldPropagateFn = void 0;
const callstack_1 = require("./callstack");
const cmds = __importStar(require("./commands"));
const utils_1 = require("./utils");
const types_1 = require("../../types");
const shouldNotWrapCommand = (commandName) => ["addCommand", "overwriteCommand", "extendOptions", "setMeta", "getMeta", "runStep"].includes(commandName);
const shouldPropagateFn = (parentNode, currentNode) => (0, utils_1.isGroup)(parentNode) || (0, utils_1.isGroup)(currentNode);
exports.shouldPropagateFn = shouldPropagateFn;
const mkHistoryNode = ({ name, args, elementScope, key, overwrite, isGroup }) => {
    const map = {
        [types_1.TestStepKey.Name]: name,
        [types_1.TestStepKey.Args]: (0, utils_1.normalizeCommandArgs)(name, args),
        [types_1.TestStepKey.Scope]: cmds.createScope(elementScope),
        [types_1.TestStepKey.Key]: key ?? Symbol(),
    };
    if (overwrite) {
        map[types_1.TestStepKey.IsOverwritten] = Boolean(overwrite);
    }
    if (isGroup) {
        map[types_1.TestStepKey.IsGroup] = true;
    }
    return map;
};
const runWithHistoryHooks = ({ callstack, nodeData, fn }) => {
    nodeData.key = nodeData.key ?? Symbol();
    return (0, utils_1.runWithHooks)({
        before: () => callstack.enter(mkHistoryNode(nodeData)),
        fn,
        after: () => callstack.leave(nodeData.key),
        error: () => callstack.markError(exports.shouldPropagateFn),
    });
};
const overwriteAddCommand = (session, callstack) => {
    session.overwriteCommand("addCommand", (origCommand, name, wrapper, elementScope) => {
        if (shouldNotWrapCommand(name)) {
            return origCommand(name, wrapper, elementScope);
        }
        function decoratedWrapper(...args) {
            return runWithHistoryHooks({
                callstack,
                nodeData: { name, args, elementScope, overwrite: false },
                fn: () => wrapper.apply(this, args),
            });
        }
        return origCommand(name, decoratedWrapper, elementScope);
    });
};
const overwriteOverwriteCommand = (session, callstack) => {
    session.overwriteCommand("overwriteCommand", (origCommand, name, wrapper, elementScope) => {
        if (shouldNotWrapCommand(name)) {
            return origCommand(name, wrapper, elementScope);
        }
        function decoratedWrapper(origFn, ...args) {
            return runWithHistoryHooks({
                callstack,
                nodeData: { name, args, elementScope, overwrite: true },
                fn: () => wrapper.apply(this, [origFn, ...args]),
            });
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return origCommand(name, decoratedWrapper, elementScope);
    });
};
const overwriteCommands = ({ session, callstack, commands, elementScope }) => {
    commands.forEach(name => {
        function decoratedWrapper(origFn, ...args) {
            return runWithHistoryHooks({
                callstack,
                nodeData: { name, args, elementScope, overwrite: false },
                fn: () => origFn(...args),
            });
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        session.overwriteCommand(name, decoratedWrapper, elementScope);
    });
};
const overwriteBrowserCommands = (session, callstack) => overwriteCommands({
    session,
    callstack,
    commands: cmds.getBrowserCommands().filter(cmd => !shouldNotWrapCommand(cmd)),
    elementScope: false,
});
const overwriteElementCommands = (session, callstack) => overwriteCommands({
    session,
    callstack,
    commands: cmds.getElementCommands(),
    elementScope: true,
});
const runGroup = (callstack, name, fn) => {
    if (!callstack) {
        return fn();
    }
    return runWithHistoryHooks({
        callstack,
        nodeData: { name, args: [], isGroup: true },
        fn,
    });
};
exports.runGroup = runGroup;
const overwriteRunStepCommand = (session, callstack) => {
    session.overwriteCommand("runStep", (origCommand, stepName, stepCb) => {
        return (0, exports.runGroup)(callstack, stepName, () => origCommand(stepName, stepCb));
    });
};
const initCommandHistory = (session) => {
    const callstack = new callstack_1.Callstack();
    overwriteAddCommand(session, callstack);
    overwriteBrowserCommands(session, callstack);
    overwriteElementCommands(session, callstack);
    overwriteOverwriteCommand(session, callstack);
    overwriteRunStepCommand(session, callstack);
    return callstack;
};
exports.initCommandHistory = initCommandHistory;
//# sourceMappingURL=index.js.map