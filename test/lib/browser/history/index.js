'use strict';

const P = require('bluebird');
const cmds = require('../../../../lib/browser/history/commands');
const Callstack = require('../../../../lib/browser/history/callstack');
const {mkSessionStub_} = require('../utils');
const {initCommandHistory} = require('../../../../lib/browser/history');

describe('commands-history', () => {
    beforeEach(() => {
        sinon.stub(cmds, 'getBrowserCommands').returns([]);
        sinon.stub(cmds, 'getElementCommands').returns([]);
    });

    afterEach(() => {
        cmds.getBrowserCommands.restore();
        cmds.getElementCommands.restore();
    });

    describe('initCommandHistory', () => {
        it('should return an instance of callstack', () => {
            const session = mkSessionStub_();
            const stack = initCommandHistory(session);

            assert.instanceOf(stack, Callstack);
        });

        it('should wrap "addCommand" command', async () => {
            const session = mkSessionStub_();
            const stack = initCommandHistory(session);

            session.addCommand('foo', (a1, a2) => P.resolve(a1, a2));

            await session.foo('arg1', 'arg2');

            const [node] = stack.flush();

            assert.propertyVal(node, 'n', 'foo');
            assert.propertyVal(node, 's', 'b');
            assert.notProperty(node, 'o', 0);
            assert.deepPropertyVal(node, 'a', ['arg1', 'arg2']);
        });

        it('should wrap "overwriteCommand" command', async () => {
            const session = mkSessionStub_();
            const stack = initCommandHistory(session);

            session.overwriteCommand('url', (a1, a2) => P.resolve(a1, a2));

            await session.url('site.com');

            const [node] = stack.flush();

            assert.propertyVal(node, 'n', 'url');
            assert.propertyVal(node, 's', 'b');
            assert.propertyVal(node, 'o', 1);
            assert.deepPropertyVal(node, 'a', ['site.com']);
        });

        it('should save context while wrapping for "addCommand"', async () => {
            const session = mkSessionStub_();

            initCommandHistory(session);
            session.addCommand('foo', function() {
                return this;
            });

            const resultContest = await session.foo();

            assert.equal(resultContest, session);
        });

        it('should wrap browser commands', async () => {
            cmds.getBrowserCommands.returns(['url']);

            const session = mkSessionStub_();
            const stack = initCommandHistory(session);

            await session.url('site.com');
            await session.execute();

            const [urlNode] = stack.flush();

            assert.propertyVal(urlNode, 'n', 'url');
            assert.propertyVal(urlNode, 's', 'b');
            assert.notProperty(urlNode, 'o');
            assert.deepPropertyVal(urlNode, 'c', []);
            assert.deepPropertyVal(urlNode, 'a', ['site.com']);
        });

        it('should wrap element commands', async () => {
            cmds.getElementCommands.returns(['click']);

            const session = mkSessionStub_();
            const stack = initCommandHistory(session);

            const element = await session.$();

            await element.click('arg1');

            const [clickNode] = stack.flush();

            assert.propertyVal(clickNode, 'n', 'click');
            assert.propertyVal(clickNode, 's', 'e');
            assert.notProperty(clickNode, 'o');
            assert.deepPropertyVal(clickNode, 'c', []);
            assert.deepPropertyVal(clickNode, 'a', ['arg1']);
        });
    });
});
