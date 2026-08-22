import { shouldIgnoreUnhandledRejection, registerUnhandledRejectionFilter } from "../../../src/utils/errors";

describe("utils/errors", () => {
    describe("shouldIgnoreUnhandledRejection", () => {
        it("should return false if no error is passed", () => {
            assert.isFalse(shouldIgnoreUnhandledRejection(undefined));
        });

        it("should ignore known Puppeteer/CDP protocol errors by name", () => {
            const err = new Error("some message");
            err.name = "ProtocolError";

            assert.isTrue(shouldIgnoreUnhandledRejection(err));
        });

        it("should ignore known Puppeteer/CDP target-closed errors by name", () => {
            const err = new Error("some message");
            err.name = "TargetCloseError";

            assert.isTrue(shouldIgnoreUnhandledRejection(err));
        });

        it("should ignore known Puppeteer error messages originating from puppeteer-core", () => {
            const err = new Error("Cannot extract value when objectId is given");
            err.stack = "Error: ...\n    at .../node_modules/puppeteer-core/lib/foo.js:1:1";

            assert.isTrue(shouldIgnoreUnhandledRejection(err));
        });

        it("should not ignore a Puppeteer-shaped message that did not come from puppeteer-core", () => {
            const err = new Error("Cannot extract value when objectId is given");
            err.stack = "Error: ...\n    at /my-project/src/index.js:1:1";

            assert.isFalse(shouldIgnoreUnhandledRejection(err));
        });

        it("should not ignore an arbitrary error by default", () => {
            assert.isFalse(shouldIgnoreUnhandledRejection(new Error("something genuinely broke")));
        });

        describe("registerUnhandledRejectionFilter", () => {
            const registeredUnregisterFns: Array<() => void> = [];

            afterEach(() => {
                registeredUnregisterFns.splice(0).forEach(unregister => unregister());
            });

            const register = (filter: (err: Error) => boolean): void => {
                registeredUnregisterFns.push(registerUnhandledRejectionFilter(filter));
            };

            it("should ignore a rejection a registered filter matches", () => {
                register(err => err.message === "known-safe failure");

                assert.isTrue(shouldIgnoreUnhandledRejection(new Error("known-safe failure")));
            });

            it("should not ignore a rejection no registered filter matches", () => {
                register(err => err.message === "known-safe failure");

                assert.isFalse(shouldIgnoreUnhandledRejection(new Error("something else")));
            });

            it("should consult every registered filter, not just the first one", () => {
                register(() => false);
                register(err => err.message === "matched-by-second-filter");

                assert.isTrue(shouldIgnoreUnhandledRejection(new Error("matched-by-second-filter")));
            });

            it("should treat a throwing filter as not matched, and not let it break other filters", () => {
                register(() => {
                    throw new Error("filter itself is broken");
                });
                register(err => err.message === "still works");

                assert.isFalse(shouldIgnoreUnhandledRejection(new Error("unrelated")));
                assert.isTrue(shouldIgnoreUnhandledRejection(new Error("still works")));
            });

            it("should stop consulting a filter once it has been unregistered", () => {
                const unregister = registerUnhandledRejectionFilter(err => err.message === "temporary");

                assert.isTrue(shouldIgnoreUnhandledRejection(new Error("temporary")));

                unregister();

                assert.isFalse(shouldIgnoreUnhandledRejection(new Error("temporary")));
            });

            it("should never override the built-in Puppeteer allowlist behavior", () => {
                register(() => false);

                const err = new Error("some message");
                err.name = "ProtocolError";

                assert.isTrue(shouldIgnoreUnhandledRejection(err));
            });
        });
    });
});
