"use strict";

const clearRequire = require("clear-require");
const HermioneFacade = require("src/worker/hermione-facade");
const Promise = require("bluebird");

describe("worker", () => {
    const sandbox = sinon.sandbox.create();

    beforeEach(() => {
        sandbox.stub(HermioneFacade.prototype);

        clearRequire(require.resolve("src/worker"));
    });

    afterEach(() => sandbox.restore());

    it("should init hermione facade on require", () => {
        require("src/worker");

        assert.calledOnce(HermioneFacade.prototype.init);
    });

    describe("runTest", () => {
        let runTest;

        beforeEach(() => {
            HermioneFacade.prototype.runTest.resolves();

            const worker = require("src/worker");
            runTest = worker.runTest;
        });

        it("should delegate runTest call to hermione facade", () => {
            HermioneFacade.prototype.runTest.withArgs("fullTitle", { some: "opts" }).resolves({ foo: "bar" });

            return runTest("fullTitle", { some: "opts" }).then(res => assert.deepEqual(res, { foo: "bar" }));
        });

        it("should reject on hermione facade runTest fail", () => {
            HermioneFacade.prototype.runTest.callsFake(() => Promise.reject(new Error("foo")));

            return assert.isRejected(runTest("fullTitle", { some: "opts" }), /foo/);
        });
    });
});
