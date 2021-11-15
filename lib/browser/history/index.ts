import Callstack from './callstack';
import * as cmds from './commands';
import { runWithHooks, normalizeCommandArgs, historyDataMap } from './utils';

import type { Browser as Session } from 'webdriverio';
import type BrowserCommands from 'webdriverio/build/commands/browser';
import type ElementCommands from 'webdriverio/build/commands/element';
import type { Node } from './callstack'; 

const shouldNotWrapCommand = (commandName: string): boolean => [
    'addCommand',
    'overwriteCommand',
    'extendOptions',
    'setMeta',
    'getMeta'
].includes(commandName);

type MkNodeDataOpts = {
    name: string;
    args: Array<any>;
    elementScope: boolean;
    overwrite: boolean;
};

const mkNodeData = ({name, args, elementScope, overwrite}: MkNodeDataOpts): Partial<Node> => {
    const map: Partial<Node> = {
        [historyDataMap.NAME]: name,
        [historyDataMap.ARGS]: normalizeCommandArgs(name, args),
        [historyDataMap.SCOPE]: cmds.createScope(elementScope)
    };

    if (overwrite) {
        map[historyDataMap.IS_OVERWRITTEN] = Number(overwrite);
    }

    return map;
};

const overwriteAddCommand = (session: Session<'async'>, callstack: Callstack): void => session
    .overwriteCommand('addCommand', (origCommand, name, wrapper, elementScope) => {
        if (shouldNotWrapCommand(name)) {
            return origCommand(name, wrapper, elementScope);
        }

        const decoratedWrapper = (...args: Array<any>) => runWithHooks({
            before: () => callstack.enter(mkNodeData({name, args, elementScope, overwrite: false})),
            fn: () => wrapper.apply(session, args),
            after: () => callstack.leave()
        });

        return origCommand(name, decoratedWrapper, elementScope);
    });

const overwriteOverwriteCommand = (session: Session<'async'>, callstack: Callstack): void => session
    .overwriteCommand('overwriteCommand', (origCommand, name, wrapper, elementScope) => {
        if (shouldNotWrapCommand(name)) {
            return origCommand(name, wrapper, elementScope);
        }

        const decoratedWrapper = (origFn: Function, ...args: Array<any>) => runWithHooks({
            before: () => callstack.enter(mkNodeData({name, args, elementScope, overwrite: true})),
            fn: () => wrapper.apply(session, [origFn, ...args]),
            after: () => callstack.leave()
        });

        return origCommand(name, decoratedWrapper, elementScope);
    });

type OverwriteCommandsOpts = {
    session: Session<'async'>;
    callstack: Callstack;
    commands: Array<keyof typeof BrowserCommands | keyof typeof ElementCommands>;
    elementScope: boolean;
};

const overwriteCommands = ({session, callstack, commands, elementScope}: OverwriteCommandsOpts): void => commands.forEach((name) => {
    session.overwriteCommand(name, (origFn, ...args) => runWithHooks({
        before: () => callstack.enter(mkNodeData({name, args, elementScope, overwrite: false})),
        fn: () => origFn(...args),
        after: () => callstack.leave()
    }), elementScope);
});

const overwriteBrowserCommands = (session: Session<'async'>, callstack: Callstack): void => overwriteCommands({
    session,
    callstack,
    commands: cmds.getBrowserCommands(),
    elementScope: false
});

const overwriteElementCommands = (session: Session<'async'>, callstack: Callstack): void => overwriteCommands({
    session,
    callstack,
    commands: cmds.getElementCommands(),
    elementScope: true
});

export const initCommandHistory = (session: Session<'async'>): Callstack => {
    const callstack = new Callstack();

    overwriteAddCommand(session, callstack);
    overwriteBrowserCommands(session, callstack);
    overwriteElementCommands(session, callstack);
    overwriteOverwriteCommand(session, callstack);

    return callstack;
};
