"use strict";

const proxyquire = require("proxyquire");

describe("utils/processor", () => {
    const sandbox = sinon.createSandbox();
    let processor, webdriverReady, mochaReady, preloadWebdriverIO, preloadMochaReader, run, callback;

    const deferred = () => {
        let resolve;
        const promise = new Promise(done => {
            resolve = done;
        });
        return { promise, resolve };
    };

    beforeEach(() => {
        webdriverReady = deferred();
        mochaReady = deferred();
        preloadWebdriverIO = sandbox.stub().returns(webdriverReady.promise);
        preloadMochaReader = sandbox.stub().returns(mochaReady.promise);
        run = sandbox.stub().returns("result");
        callback = sandbox.spy();
        sandbox.stub(process, "on");

        processor = proxyquire.noCallThru().load("src/utils/processor", {
            "./preload-utils.js": { preloadWebdriverIO, preloadMochaReader },
            "worker-module": { run },
        });
    });

    afterEach(() => sandbox.restore());

    it("should finish preloading WebdriverIO before importing the Mocha reader", async () => {
        assert.calledOnce(preloadWebdriverIO);
        assert.notCalled(preloadMochaReader);

        webdriverReady.resolve();
        await webdriverReady.promise;

        assert.calledOnce(preloadMochaReader);
    });

    it("should wait for both preloads before reporting the worker module as loaded", async () => {
        const loading = processor.loadModule("worker-module", callback);
        assert.notCalled(callback);

        webdriverReady.resolve();
        await webdriverReady.promise;
        assert.notCalled(callback);

        mochaReady.resolve();
        await loading;

        assert.calledOnceWithExactly(callback, null);
    });

    it("should wait for both preloads before executing a worker method", async () => {
        const executing = processor.execute("worker-module", "run", ["argument"], callback);
        assert.notCalled(run);
        assert.notCalled(callback);

        webdriverReady.resolve();
        await webdriverReady.promise;
        assert.notCalled(run);
        assert.notCalled(callback);

        mochaReady.resolve();
        await executing;

        assert.calledOnceWithExactly(run, "argument");
        assert.calledOnceWithExactly(callback, null, "result");
    });

    it("should share preload completion between concurrent worker requests", async () => {
        const loaded = sandbox.spy();
        const loading = processor.loadModule("worker-module", loaded);
        const executing = processor.execute("worker-module", "run", [], callback);
        assert.notCalled(loaded);
        assert.notCalled(run);

        webdriverReady.resolve();
        mochaReady.resolve();
        await Promise.all([loading, executing]);

        assert.calledOnce(preloadWebdriverIO);
        assert.calledOnce(preloadMochaReader);
        assert.calledOnceWithExactly(loaded, null);
        assert.calledOnceWithExactly(callback, null, "result");
    });
});
