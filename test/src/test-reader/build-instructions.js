"use strict";

const _ = require("lodash");
const { InstructionsList, Instructions } = require("src/test-reader/build-instructions");
const { TreeBuilder } = require("src/test-reader/tree-builder");
const validators = require("src/validators");
const env = require("src/utils/env");
const RuntimeConfig = require("src/config/runtime-config");
const { makeConfigStub } = require("../../utils");

describe("test-reader/build-instructions", () => {
    const sandbox = sinon.createSandbox();

    afterEach(() => {
        sandbox.restore();
    });

    describe("InstructionsList", () => {
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

                new InstructionsList().push(foo).push(bar).push(baz).exec([]);

                assert.callOrder(foo, bar, baz);
            });

            it("should exec common instructions with passed ctx", () => {
                const instruction = sinon.spy();
                const ctx = { foo: "bar" };

                new InstructionsList().push(instruction).exec([], ctx);

                assert.calledOnceWith(instruction, ctx);
            });

            it("should exec instruction for passed files", () => {
                const foo = sinon.spy().named("foo");
                const bar = sinon.spy().named("bar");
                const baz = sinon.spy().named("baz");

                const ctx = { foo: "bar" };

                new InstructionsList()
                    .push(foo, "/foo.js")
                    .push(bar, "/bar.js")
                    .push(baz, "/baz.js")
                    .exec(["/foo.js", "/baz.js"], ctx);

                assert.calledOnceWith(foo, ctx);
                assert.calledOnceWith(baz, ctx);
                assert.notCalled(bar);
            });

            it("should ignore unknown files", () => {
                const bar = sinon.spy().named("bar");

                const ctx = { foo: "bar" };

                new InstructionsList().push(bar, "/bar.js").exec(["/foo.js", "/bar.js"], ctx);

                assert.calledOnceWith(bar, ctx);
            });

            it("should exec common instructions for any files", () => {
                const foo = sinon.spy().named("foo");
                const bar = sinon.spy().named("bar");
                const baz = sinon.spy().named("baz");

                const instructionsList = new InstructionsList().push(foo).push(bar, "/bar.js").push(baz, "/baz.js");

                instructionsList.exec(["/bar.js"]);
                instructionsList.exec(["/baz.js"]);

                assert.calledTwice(foo);
                assert.calledOnce(bar);
                assert.calledOnce(baz);
            });

            it("should exec common instructions before file instructions", () => {
                const foo = sinon.spy().named("foo");
                const bar = sinon.spy().named("bar");

                new InstructionsList().push(foo, "/foo.js").push(bar).exec(["/foo.js"]);

                assert.callOrder(bar, foo);
            });
        });
    });

    describe("Instructions", () => {
        beforeEach(() => {
            sandbox.stub(TreeBuilder.prototype, "addTrap");
        });

        const execTrapInstruction_ = (instruction, ctx) => {
            const treeBuilder = new TreeBuilder();
            instruction({ treeBuilder, ...ctx });

            return _.get(TreeBuilder.prototype.addTrap, "lastCall.args.0");
        };

        describe("extendWithBrowserId", () => {
            it("should decorate passed test object with browser id from context", () => {
                const decorator = execTrapInstruction_(Instructions.extendWithBrowserId, { browserId: "bro" });
                const testObject = {};

                decorator(testObject);

                assert.propertyVal(testObject, "browserId", "bro");
            });
        });

        describe("extendWitBrowserVersion", () => {
            it("should decorate passed test object with browser version if exists", () => {
                const decorator = execTrapInstruction_(Instructions.extendWithBrowserVersion, {
                    config: {
                        desiredCapabilities: {
                            version: "100500",
                            browserVersion: "500100",
                        },
                    },
                });
                const testObject = {};

                decorator(testObject);

                assert.propertyVal(testObject, "browserVersion", "500100");
            });

            it("should decorate passed test object with version if no browser version specified", () => {
                const decorator = execTrapInstruction_(Instructions.extendWithBrowserVersion, {
                    config: {
                        desiredCapabilities: {
                            version: "100500",
                        },
                    },
                });
                const testObject = {};

                decorator(testObject);

                assert.propertyVal(testObject, "browserVersion", "100500");
            });
        });

        describe("extendWithTimeout", () => {
            beforeEach(() => {
                sandbox.stub(RuntimeConfig, "getInstance").returns({ replMode: { enabled: false } });
            });

            describe("should not add decorator to tree builder if", () => {
                it("'testTimeout' is not specified in config", () => {
                    execTrapInstruction_(Instructions.extendWithTimeout, { config: {} });

                    assert.notCalled(TreeBuilder.prototype.addTrap);
                });

                it("'replMode' is enabled (even if 'testTimeout' is specified)", () => {
                    RuntimeConfig.getInstance.returns({ replMode: { enabled: true } });

                    execTrapInstruction_(Instructions.extendWithTimeout, {
                        config: {
                            testTimeout: 100500,
                        },
                    });

                    assert.notCalled(TreeBuilder.prototype.addTrap);
                });
            });

            it("should decorate with timeout if 'testTimeout' is specified in config", () => {
                const decorator = execTrapInstruction_(Instructions.extendWithTimeout, {
                    config: {
                        testTimeout: 100500,
                    },
                });
                const testObject = {};

                decorator(testObject);

                assert.propertyVal(testObject, "timeout", 100500);
            });

            it("should decorate with timeout even if 'testTimeout' is set to 0", () => {
                const decorator = execTrapInstruction_(Instructions.extendWithTimeout, {
                    config: {
                        testTimeout: 0,
                    },
                });
                const testObject = {};

                decorator(testObject);

                assert.propertyVal(testObject, "timeout", 0);
            });
        });

        describe("disableInPassiveBrowser", () => {
            describe("should not add decorator to tree builder if", () => {
                it("'passive' option is not specified in config", () => {
                    execTrapInstruction_(Instructions.extendWithTimeout, { config: {} });

                    assert.notCalled(TreeBuilder.prototype.addTrap);
                });

                it("'passive' option set to 'false' in config", () => {
                    execTrapInstruction_(Instructions.extendWithTimeout, {
                        config: {
                            passive: false,
                        },
                    });

                    assert.notCalled(TreeBuilder.prototype.addTrap);
                });
            });

            it("should disable passed test object if 'passive' option is set to 'true' in config", () => {
                const decorator = execTrapInstruction_(Instructions.disableInPassiveBrowser, {
                    config: {
                        passive: true,
                    },
                });
                const testObject = { disable: sandbox.stub() };

                decorator(testObject);

                assert.calledOnce(testObject.disable);
            });
        });

        describe("buildGlobalSkipInstruction", () => {
            beforeEach(() => {
                sandbox.stub(validators, "validateUnknownBrowsers");
                sandbox.stub(env, "parseCommaSeparatedValue").returns({ value: [] });
            });

            it("should validate skip browsers against known browsers", () => {
                env.parseCommaSeparatedValue
                    .withArgs(["TESTPLANE_SKIP_BROWSERS", "HERMIONE_SKIP_BROWSERS"])
                    .returns({ value: ["baz"], key: "TESTPLANE_SKIP_BROWSERS" });

                Instructions.buildGlobalSkipInstruction(makeConfigStub({ browsers: ["foo", "bar"] }));

                assert.calledOnceWith(validators.validateUnknownBrowsers, ["baz"], ["foo", "bar"]);
            });

            it("should set noop instruction if skip list is not specified", () => {
                env.parseCommaSeparatedValue
                    .withArgs(["TESTPLANE_SKIP_BROWSERS", "HERMIONE_SKIP_BROWSERS"])
                    .returns({ value: [], key: "TESTPLANE_SKIP_BROWSERS" });
                const instruction = Instructions.buildGlobalSkipInstruction(
                    makeConfigStub({ browsers: ["foo", "bar"] }),
                );

                execTrapInstruction_(instruction);

                assert.notCalled(TreeBuilder.prototype.addTrap);
            });

            it("should set noop instruction if browser is not in the skip list", () => {
                env.parseCommaSeparatedValue
                    .withArgs(["TESTPLANE_SKIP_BROWSERS", "HERMIONE_SKIP_BROWSERS"])
                    .returns({ value: ["foo"], key: "TESTPLANE_SKIP_BROWSERS" });
                const instruction = Instructions.buildGlobalSkipInstruction(
                    makeConfigStub({ browsers: ["foo", "bar"] }),
                );

                execTrapInstruction_(instruction, { browserId: "bar" });

                assert.notCalled(TreeBuilder.prototype.addTrap);
            });

            it("should set skip instruction if browser is in the skip list", () => {
                env.parseCommaSeparatedValue
                    .withArgs(["TESTPLANE_SKIP_BROWSERS", "HERMIONE_SKIP_BROWSERS"])
                    .returns({ value: ["foo"], key: "TESTPLANE_SKIP_BROWSERS" });
                const instruction = Instructions.buildGlobalSkipInstruction(
                    makeConfigStub({ browsers: ["foo", "bar"] }),
                );

                const decorator = execTrapInstruction_(instruction, { browserId: "foo" });
                const testObject = { skip: sinon.stub() };

                decorator(testObject);

                assert.calledOnceWith(testObject.skip, { reason: sinon.match("TESTPLANE_SKIP_BROWSERS") });
            });
        });
    });
});
