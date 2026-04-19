import fs from "fs";
import path from "path";
import sinon from "sinon";
import type { SinonStub } from "sinon";
import { ClientBridge } from "src/browser/client-bridge";
import { ClientBridgeError } from "src/browser/client-bridge/error";

const NAMESPACE = "screen-shooter";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFnRecord = Record<string, (...args: any[]) => any>;

describe("ClientBridge", () => {
    const sandbox = sinon.createSandbox();

    let browser: { execute: SinonStub };
    let script: string;
    let bridge: ClientBridge<AnyFnRecord>;

    beforeEach(() => {
        browser = { execute: sandbox.stub().resolves({}) };
        script = "exampleScript()";
        bridge = new ClientBridge(browser, script, NAMESPACE);
    });

    afterEach(() => sandbox.restore());

    describe("call", () => {
        const CALL = `__geminiCore['${NAMESPACE}'].example(1, "two")`;

        it("should try to call a method on __geminiCore namespace", () => {
            return bridge.call("example", [1, "two"]).then(() => assert.calledWith(browser.execute, sinon.match(CALL)));
        });

        it("should allow to not specify the arguments", () => {
            return bridge
                .call("example", [])
                .then(() => assert.calledWith(browser.execute, sinon.match(`__geminiCore['${NAMESPACE}'].example()`)));
        });

        it("should return what execute returns if succeeded", () => {
            browser.execute.returns(Promise.resolve("result"));

            return assert.becomes(bridge.call("example", []), "result");
        });

        it("should reject if execute returns unexpected error", () => {
            const message = "Something happened";

            browser.execute.rejects(new Error(message));

            return assert.isRejected(bridge.call("example", []), ClientBridgeError, message);
        });

        it("should not attempt to call execute a second time if it returns unexpected error", () => {
            browser.execute.rejects(new Error("bla"));

            return assert.isRejected(bridge.call("example", [])).then(() => assert.calledOnce(browser.execute));
        });

        describe("if scripts were not injected", () => {
            let setupAsNonInjected: (finalResult?: unknown) => void;
            let performCall: () => Promise<unknown>;

            beforeEach(() => {
                setupAsNonInjected = (finalResult?: unknown): void => {
                    browser.execute
                        .onCall(0)
                        .resolves({ isClientScriptNotInjected: true }) // command call
                        .onCall(1)
                        .resolves() // inject call
                        .onCall(2)
                        .resolves(finalResult); // command call after inject
                };

                performCall = (): Promise<unknown> => bridge.call("example", []);
            });

            it("should try to inject scripts", () => {
                setupAsNonInjected();

                return performCall().then(() => assert.calledWith(browser.execute, script, NAMESPACE));
            });

            it("should try to call command again after inject", () => {
                setupAsNonInjected();

                return bridge.call("example", [1, "two"]).then(() => {
                    assert.calledThrice(browser.execute);
                    assert.include(browser.execute.firstCall.args[0], CALL);
                    assert.include(browser.execute.thirdCall.args[0], CALL);
                });
            });

            it("should return result of the successful call", () => {
                setupAsNonInjected("success");

                return assert.becomes(performCall(), "success");
            });

            it("should fail if scripts failed to inject", () => {
                setupAsNonInjected({ isClientScriptNotInjected: true });

                return assert.isRejected(performCall(), ClientBridgeError);
            });
        });
    });

    describe("create", () => {
        beforeEach(() => {
            sandbox.stub(fs.promises, "readFile").resolves("script content");
        });

        it("should not poison cache between different namespaces", async () => {
            const modulePath = require.resolve("src/browser/client-bridge");
            // This is needed to clear the cache of the client-bridge module
            delete require.cache[modulePath];
            /* eslint-disable @typescript-eslint/no-var-requires */
            const { ClientBridge: IsolatedClientBridge } =
                require("src/browser/client-bridge") as typeof import("src/browser/client-bridge");
            /* eslint-enable @typescript-eslint/no-var-requires */

            const readFileStub = fs.promises.readFile as unknown as SinonStub;
            readFileStub.callsFake(async (filePath: fs.PathOrFileDescriptor) => {
                const normalizedPath = String(filePath);

                if (normalizedPath.includes(`${path.sep}screen-shooter${path.sep}`)) {
                    return "screen-shooter script";
                }

                if (normalizedPath.includes(`${path.sep}browser-utils${path.sep}`)) {
                    return "browser-utils script";
                }

                throw new Error(`Unexpected bundle path: ${normalizedPath}`);
            });

            const screenShooterBridge = await IsolatedClientBridge.create(browser, "screen-shooter", {});
            const browserUtilsBridge = await IsolatedClientBridge.create(browser, "browser-utils", {});

            assert.equal((screenShooterBridge as unknown as { _script: string })._script, "screen-shooter script");
            assert.equal((browserUtilsBridge as unknown as { _script: string })._script, "browser-utils script");
            assert.calledTwice(readFileStub);
        });

        it("should read native bundle by default", async () => {
            const readFileStub = fs.promises.readFile as unknown as SinonStub;
            const result = await ClientBridge.create(browser, NAMESPACE, {});

            assert.equal(path.basename(readFileStub.firstCall.args[0]), "bundle.native.js");
            assert.instanceOf(result, ClientBridge);
        });

        it("should read compat bundle when needsCompatLib is true", async () => {
            const readFileStub = fs.promises.readFile as unknown as SinonStub;
            const result = await ClientBridge.create(browser, NAMESPACE, { needsCompatLib: true });

            assert.equal(path.basename(readFileStub.firstCall.args[0]), "bundle.compat.js");
            assert.instanceOf(result, ClientBridge);
        });
    });
});
