"use strict";

const proxyquire = require("proxyquire");
const ClientBridge = require("src/browser/client-bridge/client-bridge");

describe("clientBridge", () => {
    const sandbox = sinon.createSandbox();

    let clientBridge, browserify, script;

    beforeEach(() => {
        script = {
            exclude: sandbox.stub(),
            transform: sandbox.stub(),
            bundle: sinon.stub().yields(null, Buffer.from("scripts", "utf-8")),
        };

        browserify = sandbox.stub().returns(script);

        clientBridge = proxyquire("src/browser/client-bridge", { browserify });

        sandbox.stub(ClientBridge, "create");
    });

    afterEach(() => sandbox.restore());

    describe("build", () => {
        it("should browserify client scripts", () => {
            return clientBridge
                .build()
                .then(() =>
                    assert.calledOnceWith(
                        browserify,
                        sinon.match({ entries: "./index", basedir: sinon.match(/browser\/client-scripts/) }),
                    ),
                );
        });

        it("should transform client scripts", () => {
            return clientBridge.build().then(() => {
                assert.calledWith(
                    script.transform,
                    {
                        sourcemap: false,
                        global: true,
                        compress: { screw_ie8: false }, // eslint-disable-line camelcase
                        mangle: { screw_ie8: false }, // eslint-disable-line camelcase
                        output: { screw_ie8: false }, // eslint-disable-line camelcase
                    },
                    "uglifyify",
                );
            });
        });

        it("should transform client scripts using native library", () => {
            return clientBridge.build(null, { calibration: { needsCompatLib: false } }).then(() => {
                assert.calledWith(
                    script.transform,
                    sinon.match({
                        aliases: {
                            "./lib": { relative: "./lib.native.js" },
                        },
                        verbose: false,
                    }),
                );
            });
        });

        it("should transform client scripts using compat library", () => {
            return clientBridge.build(null, { calibration: { needsCompatLib: true } }).then(() => {
                assert.calledWith(
                    script.transform,
                    sinon.match({
                        aliases: {
                            "./lib": { relative: "./lib.compat.js" },
                        },
                        verbose: false,
                    }),
                );
            });
        });

        it("should transform client scripts NOT for deprecated mode", () => {
            return clientBridge.build(null, { supportDeprecated: false }).then(() => {
                assert.calledWith(
                    script.transform,
                    sinon.match({
                        aliases: {
                            "./ignore-areas": { relative: "./ignore-areas.js" },
                        },
                        verbose: false,
                    }),
                );
            });
        });

        it("should transform client scripts for deprecated mode", () => {
            return clientBridge.build(null, { supportDeprecated: true }).then(() => {
                assert.calledWith(
                    script.transform,
                    sinon.match({
                        aliases: {
                            "./ignore-areas": { relative: "./ignore-areas.deprecated.js" },
                        },
                        verbose: false,
                    }),
                );
            });
        });

        it("should create client bridge instance", () => {
            script.bundle.yields(null, Buffer.from("foo bar script", "utf-8"));

            ClientBridge.create.withArgs({ some: "browser" }, "foo bar script").returns({ client: "bridge" });

            return assert.becomes(clientBridge.build({ some: "browser" }), { client: "bridge" });
        });
    });
});
