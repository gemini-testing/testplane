import proxyquire from "proxyquire";
import sinon, { type SinonStub } from "sinon";
import _ from "lodash";

describe("utils/typescript", () => {
    const processEnvBackup = _.clone(process.env);

    let ts: typeof import("src/utils/typescript");
    let registerStub: SinonStub;
    const REGISTER_INSTANCE = Symbol("tsNodeTesting");

    beforeEach(() => {
        registerStub = sinon.stub();
        ts = proxyquire.noCallThru().load("src/utils/typescript", {
            "ts-node": {
                register: registerStub,
                REGISTER_INSTANCE,
            },
        });
    });

    afterEach(() => {
        _.set(process, REGISTER_INSTANCE, undefined);
        _.set(process, "env", processEnvBackup);
    });

    describe("tryToRegisterTsNode", () => {
        it("should not call register if typescript was already installed", () => {
            _.set(global, ["process", REGISTER_INSTANCE], true);

            ts.tryToRegisterTsNode();

            assert.notCalled(registerStub);
        });

        it("should not call register if TS_ENABLE is false", () => {
            process.env.TS_ENABLE = "false";

            ts.tryToRegisterTsNode();

            assert.notCalled(registerStub);

            process.env.TS_ENABLE = "undefined";
        });

        it("should pass 'allowJs' option", () => {
            ts.tryToRegisterTsNode();

            assert.calledOnceWith(
                registerStub,
                sinon.match({
                    compilerOptions: {
                        allowJs: true,
                    },
                }),
            );
        });

        it("should respect env vars", () => {
            process.env.TS_NODE_SKIP_PROJECT = "false";
            process.env.TS_NODE_TRANSPILE_ONLY = "false";

            ts.tryToRegisterTsNode();

            assert.calledOnceWith(
                registerStub,
                sinon.match({
                    skipProject: false,
                    transpileOnly: false,
                }),
            );
        });

        it("should use swc if it is installed", () => {
            ts = proxyquire.noCallThru().load("src/utils/typescript", {
                "ts-node": {
                    register: registerStub,
                },
                "@swc/core": sinon.stub(),
            });

            ts.tryToRegisterTsNode();

            assert.calledOnceWith(
                registerStub,
                sinon.match({
                    swc: true,
                }),
            );
        });

        it("should not use swc if not installed", () => {
            registerStub
                .withArgs(
                    sinon.match({
                        swc: true,
                    }),
                )
                .throws("MODULE_NOT_FOUND");
            ts = proxyquire.noCallThru().load("src/utils/typescript", {
                "ts-node": {
                    register: registerStub,
                },
                "@swc/core": null,
            });

            ts.tryToRegisterTsNode();

            assert.calledWith(
                registerStub,
                sinon.match({
                    swc: false,
                }),
            );
        });

        it("should not throw if ts-node throws", () => {
            registerStub.throws();
            ts = proxyquire.noCallThru().load("src/utils/typescript", {
                "ts-node": registerStub,
                "@swc/core": null,
            });

            assert.doesNotThrow(() => ts.tryToRegisterTsNode());
        });

        it("should not throw if nothing is installed", () => {
            ts = proxyquire.noCallThru().load("src/utils/typescript", {
                "ts-node": null,
                "@swc/core": null,
            });

            assert.doesNotThrow(() => ts.tryToRegisterTsNode());
        });
    });
});
