import { EventEmitter } from "node:events";
import sinon, { SinonStub } from "sinon";
import { AlsoController } from "../../../../src/test-reader/controllers/also-controller";
import { TreeBuilder } from "../../../../src/test-reader/tree-builder";
import { ConfigurableTestObject } from "../../../../src/test-reader/test-object/configurable-test-object";
import { TestReaderEvents as ReadEvents } from "../../../../src/events";
import type { Suite } from "../../../../src/types";

describe("test-reader/controllers/also-controller", () => {
    const sandbox = sinon.createSandbox();

    const mkController_ = (): AlsoController => {
        const eventBus = new EventEmitter().on(ReadEvents.NEW_BUILD_INSTRUCTION, instruction =>
            instruction({ treeBuilder: new TreeBuilder() }),
        );

        return AlsoController.create(eventBus);
    };

    const mkTestObject_ = ({
        browserId = "default-browser-id",
        parent = null,
    }: { browserId?: string; parent?: Suite | null } = {}): ConfigurableTestObject => {
        const testObject = new ConfigurableTestObject({
            title: "default-title",
            file: "/default-file",
            id: "default-id",
        });

        testObject.browserId = browserId;
        testObject.parent = parent;
        testObject.enable = sinon.spy(testObject.enable.bind(testObject));

        return testObject;
    };

    const applyTraps_ = ({ browserId, parent }: { browserId: string; parent?: Suite }): void => {
        const testObject = mkTestObject_({ browserId, parent });

        for (let i = 0; i < (TreeBuilder.prototype.addTrap as SinonStub).callCount; ++i) {
            (TreeBuilder.prototype.addTrap as SinonStub).getCall(i).args[0](testObject);
        }
    };

    beforeEach(() => {
        sandbox.stub(TreeBuilder.prototype, "addTrap");
        sandbox.stub(ConfigurableTestObject.prototype, "enable");
    });

    afterEach(() => {
        sandbox.restore();
    });

    (
        [
            ["plain text", (str: string): string => str],
            ["regular expression", (str: string): RegExp => new RegExp(str)],
        ] as const
    ).forEach(([description, mkMatcher]) => {
        describe(description, () => {
            describe(".in", () => {
                it("should be chainable", () => {
                    const also = mkController_();

                    const res = also.in(mkMatcher("yabro"));

                    assert.equal(res, also);
                });

                describe("trap", () => {
                    it("should be set", () => {
                        mkController_().in(mkMatcher("yabro"));

                        assert.calledOnceWith(TreeBuilder.prototype.addTrap as SinonStub, sinon.match.func);
                    });

                    it("should not enable test in case of browser mismatch", () => {
                        mkController_().in(mkMatcher("yabro"));

                        applyTraps_({ browserId: "broya" });

                        assert.notCalled(ConfigurableTestObject.prototype.enable as SinonStub);
                    });

                    it("should enable test in case of browser match", () => {
                        mkController_().in(mkMatcher("yabro"));

                        applyTraps_({ browserId: "yabro" });

                        assert.calledOnce(ConfigurableTestObject.prototype.enable as SinonStub);
                    });

                    it("should enable for each match", () => {
                        mkController_().in(mkMatcher("yabro")).in(mkMatcher("broya"));

                        applyTraps_({ browserId: "broya" });

                        assert.calledOnce(ConfigurableTestObject.prototype.enable as SinonStub);
                    });

                    it("should accept few matchers", () => {
                        mkController_().in([mkMatcher("yabro"), mkMatcher("broya")]);

                        applyTraps_({ browserId: "broya" });

                        assert.calledOnce(ConfigurableTestObject.prototype.enable as SinonStub);
                    });

                    it("should enable parent suites", () => {
                        const parent = mkTestObject_({ browserId: "broya" }) as Suite;
                        mkController_().in([mkMatcher("yabro"), mkMatcher("broya")]);

                        applyTraps_({ browserId: "broya", parent });

                        assert.calledOnceWith(parent.enable as SinonStub);
                    });
                });
            });
        });
    });
});
