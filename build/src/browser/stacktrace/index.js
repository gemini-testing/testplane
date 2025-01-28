"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.enhanceStacktraces = exports.runWithStacktraceHooks = void 0;
const utils_1 = require("./utils");
const commands_1 = require("../history/commands");
const utils_2 = require("../history/utils");
const runWithStacktraceHooks = ({ stackFrames, fn, stackFilterFunc, }) => {
    const frames = (0, utils_1.captureRawStackFrames)(stackFilterFunc || exports.runWithStacktraceHooks);
    if (stackFrames.areInternal(frames)) {
        return fn();
    }
    const key = stackFrames.getKey();
    return (0, utils_2.runWithHooks)({
        before: () => stackFrames.enter(key, frames),
        fn,
        after: () => stackFrames.leave(key),
        error: (err) => (0, utils_1.applyStackTraceIfBetter)(err, frames),
    });
};
exports.runWithStacktraceHooks = runWithStacktraceHooks;
const overwriteAddCommand = (session, stackFrames) => session.overwriteCommand("addCommand", function (origCommand, name, wrapper, elementScope) {
    function decoratedWrapper(...args) {
        return (0, exports.runWithStacktraceHooks)({
            stackFrames,
            fn: () => wrapper.apply(this, args),
            stackFilterFunc: decoratedWrapper,
        });
    }
    return origCommand.call(this, name, decoratedWrapper, elementScope);
});
const overwriteOverwriteCommand = (session, stackFrames) => session.overwriteCommand("overwriteCommand", 
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function (origCommand, name, wrapper, elementScope) {
    function decoratedWrapper(origFn, ...args) {
        return (0, exports.runWithStacktraceHooks)({
            stackFrames,
            fn: () => wrapper.call(this, origFn, ...args),
            stackFilterFunc: decoratedWrapper,
        });
    }
    return origCommand.call(this, name, decoratedWrapper, elementScope);
});
const overwriteCommands = ({ session, stackFrames, commands, elementScope, }) => commands.forEach(name => {
    function decoratedWrapper(origFn, ...args) {
        return (0, exports.runWithStacktraceHooks)({
            stackFrames,
            fn: () => origFn.apply(this, args),
            stackFilterFunc: decoratedWrapper,
        });
    }
    session.overwriteCommand(name, decoratedWrapper, elementScope);
});
const overwriteBrowserCommands = (session, stackFrames) => overwriteCommands({
    session,
    stackFrames,
    commands: (0, commands_1.getBrowserCommands)(),
    elementScope: false,
});
const overwriteElementCommands = (session, stackFrames) => overwriteCommands({
    session,
    stackFrames,
    commands: (0, commands_1.getElementCommands)(),
    elementScope: true,
});
const enhanceStacktraces = (session) => {
    const stackFrames = new utils_1.ShallowStackFrames();
    overwriteAddCommand(session, stackFrames);
    overwriteBrowserCommands(session, stackFrames);
    overwriteElementCommands(session, stackFrames);
    overwriteOverwriteCommand(session, stackFrames);
};
exports.enhanceStacktraces = enhanceStacktraces;
//# sourceMappingURL=index.js.map