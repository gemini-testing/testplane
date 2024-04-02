"use strict";

const clearRequire = require("clear-require");
const TestplaneFacade = require("src/worker/testplane-facade");
const Promise = require("bluebird");

describe("worker", () => {
    const sandbox = sinon.createSandbox();

    beforeEach(() => {
        sandbox.stub(TestplaneFacade.prototype);

        clearRequire(require.resolve("src/worker"));
    });

    afterEach(() => sandbox.restore());

    it("should init testplane facade on require", () => {
        require("src/worker");

        assert.calledOnce(TestplaneFacade.prototype.init);
    });

    describe("runTest", () => {
        let runTest;

        beforeEach(() => {
            TestplaneFacade.prototype.runTest.resolves();

            const worker = require("src/worker");
            runTest = worker.runTest;
        });

        it("should delegate runTest call to testplane facade", () => {
            TestplaneFacade.prototype.runTest.withArgs("fullTitle", { some: "opts" }).resolves({ foo: "bar" });

            return runTest("fullTitle", { some: "opts" }).then(res => assert.deepEqual(res, { foo: "bar" }));
        });

        it("should reject on testplane facade runTest fail", () => {
            TestplaneFacade.prototype.runTest.callsFake(() => Promise.reject(new Error("foo")));

            return assert.isRejected(runTest("fullTitle", { some: "opts" }), /foo/);
        });
    });
});
