"use strict";

const { cleanupRrweb, installRrwebAndCollectEvents } = require("src/browser/history/rrweb");

describe("browser/history/rrweb", () => {
    const sandbox = sinon.createSandbox();

    afterEach(() => sandbox.restore());

    describe("internet explorer", () => {
        let session;

        beforeEach(() => {
            session = {
                capabilities: { browserName: "internet explorer" },
                execute: sandbox.stub(),
            };
        });

        it("should not install rrweb", async () => {
            const events = await installRrwebAndCollectEvents(session, {});

            assert.deepEqual(events, []);
            assert.notCalled(session.execute);
        });

        it("should not clean up rrweb", async () => {
            await cleanupRrweb(session, {});

            assert.notCalled(session.execute);
        });
    });
});
