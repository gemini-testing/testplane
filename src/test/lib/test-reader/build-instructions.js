"use strict";

const { InstructionsList } = require("lib/test-reader/build-instructions");
const { TreeBuilder } = require("lib/test-reader/tree-builder");
const { Suite } = require("lib/test-reader/test-object");

describe("test-reader/build-instructions", () => {
    const sandbox = sinon.sandbox.create();

    afterEach(() => {
        sandbox.restore();
    });

    describe("push", () => {
        it("should be chainable", () => {
            const instructions = new InstructionsList();

            const res = instructions.push(() => {});

            assert.equal(res, instructions);
        });

        it("should not call passed instruction", () => {
            const instruction = sinon.spy();

            new InstructionsList().push(instruction);

            assert.notCalled(instruction);
        });
    });

    describe("exec", () => {
        it("should exec instructions in the order of push", () => {
            const foo = sinon.spy().named("foo");
            const bar = sinon.spy().named("bar");
            const baz = sinon.spy().named("baz");

            new InstructionsList()
                .push(foo)
                .push(bar)
                .push(baz)
                .exec();

            assert.callOrder(foo, bar, baz);
        });

        it("should exec instructions with passed ctx", () => {
            const instruction = sinon.spy();
            const ctx = { foo: "bar" };

            new InstructionsList()
                .push(instruction)
                .exec(ctx);

            assert.calledOnceWith(instruction, ctx);
        });

        it("should extend passed ctx with instance of tree builder", () => {
            const instruction = sinon.spy();

            new InstructionsList()
                .push(instruction)
                .exec();

            assert.calledOnceWith(instruction, {
                treeBuilder: sinon.match.instanceOf(TreeBuilder),
            });
        });

        it("should apply filters on tree builder", () => {
            sandbox.stub(TreeBuilder.prototype, "applyFilters").returnsThis();
            new InstructionsList()
                .exec();

            assert.calledOnce(TreeBuilder.prototype.applyFilters);
        });

        it("should return tree root suite", () => {
            const rootSuite = new Suite({});
            sandbox.stub(TreeBuilder.prototype, "getRootSuite").returns(rootSuite);

            const res = new InstructionsList().exec();

            assert.equal(res, rootSuite);
        });

        it("should apply filters after instructions execution but before getting root suite", () => {
            const instruction = sinon.spy();
            sandbox.stub(TreeBuilder.prototype, "applyFilters").returnsThis();
            sandbox.stub(TreeBuilder.prototype, "getRootSuite");

            new InstructionsList()
                .push(instruction)
                .exec();

            assert.callOrder(instruction, TreeBuilder.prototype.applyFilters, TreeBuilder.prototype.getRootSuite);
        });
    });
});
