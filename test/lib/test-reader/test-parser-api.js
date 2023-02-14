'use strict';

const TestParserAPI = require('lib/test-reader/test-parser-api');
const {TreeBuilder} = require('lib/test-reader/tree-builder');
const ReadEvents = require('lib/test-reader/read-events');
const {EventEmitter} = require('events');

describe('test-reader/test-parser-api', () => {
    const sandbox = sinon.sandbox.create();

    const init_ = () => {
        const ctx = {};

        const eventBus = new EventEmitter()
            .on(ReadEvents.NEW_BUILD_INSTRUCTION, (instruction) => instruction({treeBuilder: new TreeBuilder()}));

        return {
            ctx,
            api: TestParserAPI.create(ctx, eventBus)
        };
    };

    beforeEach(() => {
        sandbox.stub(TreeBuilder.prototype, 'addTrap');
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe('setController', () => {
        it('should set appropriate controller to context', () => {
            const {ctx, api} = init_();

            api.setController('foo', {});

            assert.property(ctx, 'foo');
        });

        it('should set controller methods', () => {
            const {ctx, api} = init_();

            api.setController('foo', {
                doStuff: () => {},
                doOtherStuff: () => {}
            });

            assert.property(ctx.foo, 'doStuff');
            assert.property(ctx.foo, 'doOtherStuff');
        });

        it('controller methods should be chainable', () => {
            const {ctx, api} = init_();

            api.setController('foo', {doStuff: sinon.spy()});

            const res = ctx.foo.doStuff();

            assert.equal(res, ctx.foo);
        });

        it('should add trap for each controller method call', () => {
            const {ctx, api} = init_();

            api.setController('foo', {
                doStuff: () => {},
                doOtherStuff: () => {}
            });

            ctx.foo
                .doStuff()
                .doOtherStuff();

            assert.calledTwice(TreeBuilder.prototype.addTrap);
            assert.alwaysCalledWith(TreeBuilder.prototype.addTrap, sinon.match.func);
        });

        describe('trap', () => {
            const installMethod_ = (spy) => {
                const {ctx, api} = init_();

                api.setController('foo', {spy});

                return {
                    controller: (...args) => ctx.foo.spy(...args),
                    trap: (...args) => TreeBuilder.prototype.addTrap.lastCall.args[0](...args)
                };
            };

            it('should call controller method', () => {
                const spy = sinon.spy();
                const {controller, trap} = installMethod_(spy);

                controller();
                trap({});

                assert.calledOnce(spy);
            });

            it('should call controller method on trapped object', () => {
                const spy = sinon.spy();
                const testObject = {};
                const {controller, trap} = installMethod_(spy);

                controller();
                trap(testObject);

                assert.calledOn(spy, testObject);
            });

            it('should call controller method with passed arguments', () => {
                const spy = sinon.spy();
                const {controller, trap} = installMethod_(spy);

                controller('bar', {baz: 'qux'});
                trap({});

                assert.calledWith(spy, 'bar', {baz: 'qux'});
            });
        });
    });
});
