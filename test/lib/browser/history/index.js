'use strict';

const P = require('bluebird');
const webdriverio = require('webdriverio');
const cmds = require('../../../../lib/browser/history/commands');
const Callstack = require('../../../../lib/browser/history/callstack');
const {initCommandHistory} = require('../../../../lib/browser/history');
const {mkNewBrowser_, mkExistingBrowser_, mkSessionStub_} = require('../utils');

describe('commands-history', () => {
    const sandbox = sinon.sandbox.create();

    beforeEach(() => {
        sinon.stub(cmds, 'getBrowserCommands').returns([]);
        sinon.stub(cmds, 'getElementCommands').returns([]);
    });

    afterEach(() => {
        cmds.getBrowserCommands.restore();
        cmds.getElementCommands.restore();

        sandbox.restore();
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

            const [node] = stack.release();

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

            const [node] = stack.release();

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

            const resultContext = await session.foo();

            assert.equal(resultContext, session);
        });

        it('should save element context while wrapping for "addCommand" with elemScope: true', async () => {
            const session = mkSessionStub_();

            initCommandHistory(session);
            session.addCommand('foo', function() {
                return this;
            }, true);

            const elem = await session.$('.selector');
            const resultContext = elem.foo();

            assert.equal(resultContext, elem);
        });

        it('should save element context while wrapping for "overwriteCommand" with elemScope: true', async () => {
            const session = mkSessionStub_();

            initCommandHistory(session);
            session.addCommand('foo', ()=>{}, true);
            session.overwriteCommand('foo', function() {
                return this;
            }, true);

            const elem = await session.$('.selector');
            const resultContext = elem.foo();

            assert.equal(resultContext, elem);
        });

        it('should wrap browser commands', async () => {
            cmds.getBrowserCommands.returns(['url']);

            const session = mkSessionStub_();
            const stack = initCommandHistory(session);

            await session.url('site.com');
            await session.execute();

            const [urlNode] = stack.release();

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

            const [clickNode] = stack.release();

            assert.propertyVal(clickNode, 'n', 'click');
            assert.propertyVal(clickNode, 's', 'e');
            assert.notProperty(clickNode, 'o');
            assert.deepPropertyVal(clickNode, 'c', []);
            assert.deepPropertyVal(clickNode, 'a', ['arg1']);
        });
    });

    describe('system commands', () => {
        const mkTestsSet = (getBrowser, systemCommandNameToTest) => {
            describe(`should not profile "${systemCommandNameToTest}" for`, () => {
                ['addCommand', 'overwriteCommand', 'extendOptions', 'setMeta', 'getMeta']
                    .forEach((commandName) => {
                        it(commandName, () => {
                            getBrowser().publicAPI[systemCommandNameToTest](commandName, () => {});
                            getBrowser().publicAPI[commandName]('some-arg');

                            assert.isTrue(getBrowser().releaseHistory().every(node => node.n !== commandName));
                        });
                    });
            });
        };

        describe('Browser', () => {
            let browser;

            beforeEach(async () => {
                sandbox.stub(webdriverio, 'remote').resolves(mkSessionStub_());
                browser = mkNewBrowser_({saveHistory: true});

                await browser.init();
            });

            mkTestsSet(() => browser, 'addCommand');
            mkTestsSet(() => browser, 'overwriteCommand');
        });

        describe('ExistingBrowser', () => {
            let browser;

            beforeEach(async () => {
                sandbox.stub(webdriverio, 'attach').resolves(mkSessionStub_());
                browser = mkExistingBrowser_({saveHistory: true});

                await browser.init({sessionOpts: {}, sessionCaps: {}});
            });

            mkTestsSet(() => browser, 'addCommand');
            mkTestsSet(() => browser, 'overwriteCommand');
        });
    });
});
