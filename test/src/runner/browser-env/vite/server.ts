import proxyquire from "proxyquire";
import sinon, { SinonStub } from "sinon";
import Vite from "vite";
import chalk from "chalk";

import { ViteServer } from "../../../../../src/runner/browser-env/vite/server";
import { ManualMock } from "../../../../../src/runner/browser-env/vite/manual-mock";
import { makeConfigStub } from "../../../../utils";
import { BROWSER_TEST_RUN_ENV } from "../../../../../src/constants/config";

import type { Config } from "../../../../../src/config";
import type { BrowserTestRunEnvOptions } from "../../../../../src/runner/browser-env/vite/types";
import { promiseDelay } from "../../../../../src/utils/promise";

describe("runner/browser-env/vite/server", () => {
    const sandbox = sinon.createSandbox();
    let ViteServerStub: typeof ViteServer;
    let getPortStub: SinonStub;
    let createSocketServer: SinonStub;
    let getNodeModulePathStub: SinonStub;
    let generateIndexHtmlPlugin: () => Vite.Plugin[];
    let mockPlugin: () => Vite.Plugin[];
    let loggerLogStub: SinonStub;

    const mkViteServer_ = (opts: Partial<Vite.ViteDevServer> = {}): Vite.ViteDevServer =>
        ({
            listen: sandbox.stub(),
            close: sandbox.stub(),
            resolvedUrls: {
                local: ["http://localhost:12345"],
                network: [],
            },
            httpServer: {} as Vite.ViteDevServer["httpServer"],
            ...opts,
        } as Vite.ViteDevServer);

    const mkConfig_ = (opts?: Partial<Config>): Config => makeConfigStub(opts) as Config;
    const mkConfigWithVite_ = (options: BrowserTestRunEnvOptions = {}): Config => {
        return mkConfig_({
            system: {
                testRunEnv: [BROWSER_TEST_RUN_ENV, options],
            },
        } as Partial<Config>);
    };

    beforeEach(() => {
        sandbox.stub(Vite, "createServer").resolves(mkViteServer_());

        loggerLogStub = sandbox.stub();
        createSocketServer = sandbox.stub();
        getPortStub = sandbox.stub().resolves(12345);
        getNodeModulePathStub = sandbox.stub().resolves("file:///default-cwd");
        generateIndexHtmlPlugin = sandbox.stub().returns([{ name: "default-plugin-1" }]);
        mockPlugin = sandbox.stub().returns([{ name: "default-plugin-2" }]);
        sandbox.stub(ManualMock, "create").resolves(sinon.stub() as unknown as ManualMock);

        ({ ViteServer: ViteServerStub } = proxyquire("../../../../../src/runner/browser-env/vite/server", {
            "get-port": getPortStub,
            "./socket": { createSocketServer },
            "./plugins/generate-index-html": { plugin: generateIndexHtmlPlugin },
            "./plugins/mock": { plugin: mockPlugin },
            "./utils": { getNodeModulePath: getNodeModulePathStub },
            "../../../utils/logger": {
                log: loggerLogStub,
            },
        }));
    });

    afterEach(() => sandbox.restore());

    describe("start", () => {
        describe("should create vite server", () => {
            describe("with default config", () => {
                it("on localhost", async () => {
                    await ViteServerStub.create(mkConfig_()).start();

                    assert.calledOnceWith(Vite.createServer, sinon.match({ server: { host: "localhost" } }));
                });

                it("without config file", async () => {
                    await ViteServerStub.create(mkConfig_()).start();

                    assert.calledOnceWith(Vite.createServer, sinon.match({ configFile: false }));
                });

                it("with inlined source map", async () => {
                    await ViteServerStub.create(mkConfig_()).start();

                    assert.calledOnceWith(Vite.createServer, sinon.match({ build: { sourcemap: "inline" } }));
                });

                it("with silent log level", async () => {
                    await ViteServerStub.create(mkConfig_()).start();

                    assert.calledOnceWith(
                        Vite.createServer,
                        sinon.match({
                            logLevel: "silent",
                            optimizeDeps: {
                                esbuildOptions: {
                                    logLevel: "silent",
                                },
                            },
                        }),
                    );
                });

                it("with generated port", async () => {
                    getPortStub.resolves(98765);

                    await ViteServerStub.create(mkConfig_()).start();

                    assert.calledOnceWith(Vite.createServer, sinon.match({ server: { port: 98765 } }));
                });
            });

            describe("with user config from file", () => {
                it("on specified host and port", async () => {
                    const config = mkConfigWithVite_({ viteConfig: "./test/fixtures/vite.conf.ts" });

                    await ViteServerStub.create(config).start();

                    assert.calledOnceWith(Vite.createServer, sinon.match({ server: { host: "0.0.0.0", port: 4000 } }));
                });
            });

            describe("with user config as function", () => {
                it("on specified host and port", async () => {
                    const userConfigFn = async (): Promise<Vite.InlineConfig> => {
                        await promiseDelay(20);
                        return {
                            server: {
                                host: "1.1.1.1",
                                port: 5000,
                            },
                        };
                    };
                    const config = mkConfigWithVite_({ viteConfig: userConfigFn });

                    await ViteServerStub.create(config).start();

                    assert.calledOnceWith(Vite.createServer, sinon.match({ server: { host: "1.1.1.1", port: 5000 } }));
                });
            });

            describe("with user config as object", () => {
                it("on specified host and port", async () => {
                    const viteConfig = {
                        server: { host: "2.2.2.2", port: 6000 },
                    };
                    const config = mkConfigWithVite_({ viteConfig });

                    await ViteServerStub.create(config).start();

                    assert.calledOnceWith(Vite.createServer, sinon.match({ server: { host: "2.2.2.2", port: 6000 } }));
                });
            });

            it("with plugins", async () => {
                const viteConfig = {
                    plugins: [{ name: "user-plugin-1" }, { name: "user-plugin-2" }],
                };
                const config = mkConfigWithVite_({ viteConfig });
                (generateIndexHtmlPlugin as SinonStub).resolves([{ name: "gen-index-html" }]);
                (mockPlugin as SinonStub).returns([{ name: "mock" }]);

                await ViteServerStub.create(config).start();

                assert.calledOnceWith(
                    Vite.createServer,
                    sinon.match({
                        plugins: [
                            { name: "user-plugin-1" },
                            { name: "user-plugin-2" },
                            [{ name: "gen-index-html" }],
                            [{ name: "mock" }],
                        ],
                    }),
                );
            });
        });

        describe("mock plugin", () => {
            it("should create manual mock instance with config and options", async () => {
                const options = {
                    viteConfig: {
                        server: { host: "2.2.2.2", port: 6000 },
                    },
                };
                const config = mkConfigWithVite_(options);

                await ViteServerStub.create(config).start();

                assert.calledOnceWith(ManualMock.create as SinonStub, sinon.match(options.viteConfig), options);
            });

            it("should init mock plugin with manual mock module", async () => {
                const manualMockInstance = sinon.stub();
                (ManualMock.create as SinonStub).resolves(manualMockInstance);

                await ViteServerStub.create(mkConfigWithVite_({})).start();

                assert.calledOnceWith(mockPlugin, manualMockInstance);
            });
        });

        it("should create socket server", async () => {
            const viteServer = mkViteServer_();
            (Vite.createServer as SinonStub).resolves(viteServer);

            await ViteServerStub.create(mkConfig_()).start();

            assert.calledOnceWith(createSocketServer, viteServer.httpServer);
        });

        it("should create socket server before listening vite server", async () => {
            const viteServer = mkViteServer_();
            (Vite.createServer as SinonStub).resolves(viteServer);

            await ViteServerStub.create(mkConfig_()).start();

            assert.callOrder(createSocketServer, viteServer.listen as SinonStub);
        });

        it("should inform on which address vite server started", async () => {
            const viteServer = mkViteServer_({
                resolvedUrls: {
                    local: ["http://localhost:4444"],
                    network: [],
                },
            });
            (Vite.createServer as SinonStub).resolves(viteServer);

            await ViteServerStub.create(mkConfig_()).start();

            assert.calledOnceWith(loggerLogStub, chalk.green("Vite server started on http://localhost:4444"));
        });
    });

    describe("close", () => {
        it("should close server", async () => {
            const viteServer = mkViteServer_();
            (Vite.createServer as SinonStub).resolves(viteServer);

            const viteServerWrapper = ViteServerStub.create(mkConfig_());
            await viteServerWrapper.start();
            await viteServerWrapper.close();

            assert.calledOnce(viteServer.close as SinonStub);
        });
    });
});
