"use strict";
const Callstack = require("./callstack");
const cmds = require("./commands");
const { runWithHooks, normalizeCommandArgs, historyDataMap, isGroup } = require("./utils");
const shouldNotWrapCommand = commandName => ["addCommand", "overwriteCommand", "extendOptions", "setMeta", "getMeta", "runStep"].includes(commandName);
const mkHistoryNode = ({ name, args, elementScope, key, overwrite, isGroup }) => {
    const map = {
        [historyDataMap.NAME]: name,
        [historyDataMap.ARGS]: normalizeCommandArgs(name, args),
        [historyDataMap.SCOPE]: cmds.createScope(elementScope),
        [historyDataMap.KEY]: key,
    };
    if (overwrite) {
        map[historyDataMap.IS_OVERWRITTEN] = Number(overwrite);
    }
    if (isGroup) {
        map[historyDataMap.IS_GROUP] = true;
    }
    return map;
};
const runWithHistoryHooks = ({ callstack, nodeData, fn }) => {
    nodeData.key = nodeData.key || Symbol();
    return runWithHooks({
        before: () => callstack.enter(mkHistoryNode(nodeData)),
        fn,
        after: () => callstack.leave(nodeData.key),
        error: () => callstack.markError(exports.shouldPropagateFn),
    });
};
const overwriteAddCommand = (session, callstack) => session.overwriteCommand("addCommand", (origCommand, name, wrapper, elementScope) => {
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
const overwriteOverwriteCommand = (session, callstack) => session.overwriteCommand("overwriteCommand", (origCommand, name, wrapper, elementScope) => {
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
    return origCommand(name, decoratedWrapper, elementScope);
});
const overwriteCommands = ({ session, callstack, commands, elementScope }) => commands.forEach(name => {
    function decoratedWrapper(origFn, ...args) {
        return runWithHistoryHooks({
            callstack,
            nodeData: { name, args, elementScope, overwrite: false },
            fn: () => origFn(...args),
        });
    }
    session.overwriteCommand(name, decoratedWrapper, elementScope);
});
const overwriteBrowserCommands = (session, callstack) => overwriteCommands({
    session,
    callstack,
    commands: cmds.getBrowserCommands(),
    elementScope: false,
});
const overwriteElementCommands = (session, callstack) => overwriteCommands({
    session,
    callstack,
    commands: cmds.getElementCommands(),
    elementScope: true,
});
const overwriteRunStepCommand = (session, callstack) => session.overwriteCommand("runStep", (origCommand, stepName, stepCb) => {
    return exports.runGroup(callstack, stepName, () => origCommand(stepName, stepCb));
});
exports.initCommandHistory = session => {
    const callstack = new Callstack();
    overwriteAddCommand(session, callstack);
    overwriteBrowserCommands(session, callstack);
    overwriteElementCommands(session, callstack);
    overwriteOverwriteCommand(session, callstack);
    overwriteRunStepCommand(session, callstack);
    return callstack;
};
exports.runGroup = (callstack, name, fn) => {
    if (!callstack) {
        return fn();
    }
    return runWithHistoryHooks({
        callstack,
        nodeData: { name, isGroup: true },
        fn,
    });
};
exports.shouldPropagateFn = (parentNode, currentNode) => isGroup(parentNode) || isGroup(currentNode);
//# sourceMappingURL=index.js.map