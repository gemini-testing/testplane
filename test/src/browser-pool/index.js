"use strict";

const BasicPool = require("src/browser-pool/basic-pool");
const LimitedPool = require("src/browser-pool/limited-pool");
const PerBrowserLimitedPool = require("src/browser-pool/per-browser-limited-pool");
const pool = require("src/browser-pool");
const _ = require("lodash");
const { EventEmitter } = require("events");
const { makeConfigStub } = require("../../utils");

describe("browser-pool", () => {
    const sandbox = sinon.sandbox.create();

    afterEach(() => sandbox.restore());

    const mkPool_ = opts => {
        opts = _.defaults(opts, {
            emitter: new EventEmitter(),
            config: makeConfigStub(),
        });

        return pool.create(opts.config, opts.emitter);
    };

    it("should create basic pool", () => {
        const emitter = new EventEmitter();
        const config = makeConfigStub();

        sandbox.spy(BasicPool, "create");

        pool.create(config, emitter);

        assert.calledOnce(BasicPool.create);
        assert.calledWith(BasicPool.create, config, emitter);
    });

    it("should create pool according to perBrowserLimit by default", () => {
        const browserPool = mkPool_();

        assert.instanceOf(browserPool, PerBrowserLimitedPool);
    });

    it("should create pool according to parallelLimit if that option exist", () => {
        const config = makeConfigStub({ system: { parallelLimit: 10 } });

        const browserPool = mkPool_({ config });

        assert.instanceOf(browserPool, LimitedPool);
    });

    it("should ignore parallelLimit if its value is Infinity", () => {
        const config = makeConfigStub({ system: { parallelLimit: Infinity } });

        const browserPool = mkPool_({ config });

        assert.instanceOf(browserPool, PerBrowserLimitedPool);
    });

    it("should ignore parallelLimit if its value is not set", () => {
        const config = makeConfigStub({ system: {} });

        const browserPool = mkPool_({ config });

        assert.instanceOf(browserPool, PerBrowserLimitedPool);
    });
});
