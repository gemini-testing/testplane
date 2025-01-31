"use strict";
const Promise = require("bluebird");
const {ClientBridge} = require("src/browser/client-bridge/client-bridge");
const { ClientBridgeError } = require("src/browser/client-bridge/error");

const CALL = '__geminiCore.example(1, "two")';

describe("ClientBridge", () => {
    let browser, script, bridge;

    beforeEach(() => {
        browser = {
            evalScript: sinon.stub().resolves(),
            injectScript: sinon.stub().resolves(),
        };
        browser.evalScript.resolves({});
        browser.injectScript.resolves({});
        script = "exampleScript()";
        bridge = new ClientBridge(browser, script);
    });

    describe("call", () => {
        it("should try to call a method on __geminiCore namespace", () => {
            return bridge
                .call("example", [1, "two"])
                .then(() => assert.calledWith(browser.evalScript, sinon.match(CALL)));
        });

        it("should allow to not specify the arguments", () => {
            return bridge
                .call("example")
                .then(() => assert.calledWith(browser.evalScript, sinon.match("__geminiCore.example()")));
        });

        it("should return what evalScript returns if succeeded", () => {
            browser.evalScript.returns(Promise.resolve("result"));

            return assert.becomes(bridge.call("example"), "result");
        });

        it("should reject if evalScript returns unexpected error", () => {
            const message = "Something happened";

            browser.evalScript.rejects(new Error(message));

            return assert.isRejected(bridge.call("fail"), ClientBridgeError, message);
        });

        it("should not attempt to call eval second if it return with unexpected error", () => {
            browser.evalScript.rejects(new Error("bla"));

            return assert.isRejected(bridge.call("fail")).then(() => assert.calledOnce(browser.evalScript));
        });

        describe("if scripts were not injected", () => {
            let setupAsNonInjected, performCall;

            beforeEach(() => {
                setupAsNonInjected = finalResult => {
                    browser.evalScript
                        .onFirstCall()
                        .returns(Promise.resolve({ isClientScriptNotInjected: true }))
                        .onSecondCall()
                        .returns(Promise.resolve(finalResult));

                    browser.injectScript.withArgs(script).returns(Promise.resolve());
                };

                performCall = () => bridge.call("example");
            });

            it("should try to inject scripts", () => {
                setupAsNonInjected();

                return performCall().then(() => assert.calledWith(browser.injectScript, script));
            });

            it("should try to eval again after inject", () => {
                setupAsNonInjected();

                return bridge.call("example", [1, "two"]).then(() => {
                    assert.calledTwice(browser.evalScript);
                    assert.alwaysCalledWith(browser.evalScript, sinon.match(CALL));
                });
            });

            it("should return result of the succesfull call", () => {
                setupAsNonInjected("success");

                return assert.becomes(performCall(), "success");
            });

            it("should fail if scripts failed to inject", () => {
                setupAsNonInjected({ isClientScriptNotInjected: true });

                return assert.isRejected(performCall(), ClientBridgeError);
            });
        });
    });
});
