import _ from "lodash";
import proxyquire from "proxyquire";
import sinon, { type SinonStub } from "sinon";
import type { PartialDeep } from "type-fest";
import defaultConfig from "../../../src/config/defaults";
import type { InitDevServer } from "../../../src/dev-server";
import type { Config } from "../../../src/config";
import type { Testplane } from "../../../src/testplane";
import EventEmitter from "events";

type DevServer = { initDevServer: InitDevServer };

type DevServerConfig = Config["devServer"];
type UserDevServerConfig = PartialDeep<DevServerConfig>;

describe("dev-server", () => {
    const sandbox = sinon.createSandbox();

    let devServer: DevServer;
    let spawnStub: SinonStub;
    let childProcessStub: EventEmitter & { kill: SinonStub };
    let pipeLogsWithPrefixStub: SinonStub;
    let waitDevServerReadyStub: SinonStub;
    let probeServerStub: SinonStub;
    let loggerStub: { log: SinonStub; warn: SinonStub };
    let debugLog: SinonStub;
    let testplaneStub: Testplane & { halt: SinonStub };
    let findCwdStub: SinonStub;

    const createDevServerConfig_ = (opts: UserDevServerConfig): Config["devServer"] => {
        return _.defaultsDeep(opts, defaultConfig.devServer);
    };

    const initDevServer_ = (
        devServerConfig: UserDevServerConfig = {},
        configPath = "",
        testplane = testplaneStub,
    ): ReturnType<InitDevServer> => {
        return devServer.initDevServer({
            testplane,
            configPath,
            devServerConfig: createDevServerConfig_(devServerConfig),
        });
    };

    beforeEach(() => {
        childProcessStub = new EventEmitter() as EventEmitter & { kill: SinonStub };
        childProcessStub.kill = sandbox.stub();

        spawnStub = sandbox.stub().returns(childProcessStub);
        pipeLogsWithPrefixStub = sandbox.stub();
        waitDevServerReadyStub = sandbox.stub();
        probeServerStub = sandbox.stub();
        findCwdStub = sandbox.stub();

        loggerStub = { log: sandbox.stub(), warn: sandbox.stub() };
        debugLog = sandbox.stub();

        devServer = proxyquire("src/dev-server", {
            child_process: { spawn: spawnStub }, // eslint-disable-line camelcase
            "../utils/logger": loggerStub,
            debug: sandbox.stub().withArgs("testplane:dev-server").returns(debugLog),
            "./utils": {
                pipeLogsWithPrefix: pipeLogsWithPrefixStub,
                waitDevServerReady: waitDevServerReadyStub,
                probeServer: probeServerStub,
                findCwd: findCwdStub,
            },
        });

        testplaneStub = {
            halt: sandbox.stub(),
        } as Testplane & { halt: SinonStub };
    });

    afterEach(() => sandbox.restore());

    it("should not start child process if dev server command is not defined", async () => {
        await initDevServer_();

        assert.notCalled(spawnStub);
    });

    it("should start child process if dev server command is defined", async () => {
        await initDevServer_({ command: "foo" });

        assert.calledOnceWith(spawnStub, "foo");
    });

    it("should pass env, argv and cwd", async () => {
        await initDevServer_({
            command: "foo",
            args: ["bar", "baz"],
            env: { qux: "quux" },
            cwd: "/quuux",
        });

        assert.calledOnceWith(spawnStub, "foo", ["bar", "baz"], {
            env: { ...process.env, qux: "quux" },
            cwd: "/quuux",
            shell: true,
            windowsHide: true,
        });
    });

    it("should halt testplane on process kill", async () => {
        await initDevServer_({
            command: "foo",
            logs: false,
        });

        childProcessStub.emit("exit", 9, "SIGKILL");

        assert.calledOnce(testplaneStub.halt);
    });

    it("should kill dev server on process exit", async () => {
        await initDevServer_({
            command: "foo",
            logs: false,
        });

        const processExitListeners = process.listeners("exit");
        const devServerProcessExitListener = processExitListeners[processExitListeners.length - 1];

        devServerProcessExitListener(9);

        assert.calledOnceWith(childProcessStub.kill, "SIGINT");
    });

    describe("logs", () => {
        it("should not pipe dev server logs if disabled", async () => {
            await initDevServer_({
                command: "foo",
                logs: false,
            });

            assert.notCalled(pipeLogsWithPrefixStub);
        });

        it("should pipe dev server logs by default", async () => {
            await initDevServer_({
                command: "foo",
            });

            assert.calledOnceWith(pipeLogsWithPrefixStub, childProcessStub, "[dev server] ");
        });

        it("should log dev server start", async () => {
            await initDevServer_({
                command: "foo",
            });

            assert.calledWith(loggerStub.log, "Starting dev server with command", '"foo"');
        });

        it("should log dev server args, if specified", async () => {
            await initDevServer_({
                command: "foo",
                args: ["-bar", "baz"],
            });

            assert.calledWith(debugLog, "Dev server args:", JSON.stringify(["-bar", "baz"]));
        });

        it("should log dev server env, if specified", async () => {
            await initDevServer_({
                command: "foo",
                env: { bar: "baz" },
            });

            assert.calledWith(debugLog, "Dev server env:", JSON.stringify({ bar: "baz" }, null, 4));
        });
    });

    describe("reuseExisting", () => {
        const defaultReadinessProbe = {
            url: "http://localhost:3000",
            isReady: null,
            timeouts: {
                waitServerTimeout: 30000,
                probeRequestTimeout: 1000,
                probeRequestInterval: 500,
            },
        };

        it("should throw error when reuseExisting is true but readinessProbe is a function", async () => {
            const readinessProbe = sandbox.stub();

            try {
                await initDevServer_({
                    command: "foo",
                    reuseExisting: true,
                    readinessProbe,
                });
                assert.fail("Expected error to be thrown");
            } catch (error) {
                assert.match(
                    (error as Error).message,
                    /When 'reuseExisting' is set to 'true' in 'devServer' config, it is required to set 'devServer.readinessProbe.url'/,
                );
            }

            assert.notCalled(spawnStub);
            assert.notCalled(probeServerStub);
        });

        it("should throw error when reuseExisting is true but readinessProbe.url is not set", async () => {
            try {
                await initDevServer_({
                    command: "foo",
                    reuseExisting: true,
                    readinessProbe: {
                        ...defaultReadinessProbe,
                        url: null,
                    },
                });
                assert.fail("Expected error to be thrown");
            } catch (error) {
                assert.match(
                    (error as Error).message,
                    /When 'reuseExisting' is set to 'true' in 'devServer' config, it is required to set 'devServer.readinessProbe.url'/,
                );
            }

            assert.notCalled(spawnStub);
            assert.notCalled(probeServerStub);
        });

        it("should reuse existing server when reuseExisting is true and server is ready", async () => {
            probeServerStub.resolves(true);

            await initDevServer_({
                command: "foo",
                reuseExisting: true,
                readinessProbe: defaultReadinessProbe,
            });

            assert.calledOnceWith(probeServerStub, defaultReadinessProbe);
            assert.calledWith(loggerStub.log, "Reusing existing dev server");
            assert.notCalled(spawnStub);
            assert.notCalled(waitDevServerReadyStub);
        });

        it("should start new server when reuseExisting is true but server is not ready", async () => {
            probeServerStub.resolves(false);

            await initDevServer_({
                command: "foo",
                reuseExisting: true,
                readinessProbe: defaultReadinessProbe,
            });

            assert.calledOnceWith(probeServerStub, defaultReadinessProbe);
            assert.calledWith(loggerStub.log, "Starting dev server with command", '"foo"');
            assert.calledOnceWith(spawnStub, "foo");
            assert.calledOnce(waitDevServerReadyStub);
        });

        it("should work with custom isReady function when reusing existing server", async () => {
            probeServerStub.resolves(true);
            const customIsReady = sandbox.stub();

            const customReadinessProbe = {
                ...defaultReadinessProbe,
                isReady: customIsReady,
            };

            await initDevServer_({
                command: "foo",
                reuseExisting: true,
                readinessProbe: customReadinessProbe,
            });

            assert.calledOnceWith(probeServerStub, customReadinessProbe);
            assert.calledWith(loggerStub.log, "Reusing existing dev server");
            assert.notCalled(spawnStub);
        });

        it("should not probe server when reuseExisting is false", async () => {
            await initDevServer_({
                command: "foo",
                reuseExisting: false,
                readinessProbe: defaultReadinessProbe,
            });

            assert.notCalled(probeServerStub);
            assert.calledWith(loggerStub.log, "Starting dev server with command", '"foo"');
            assert.calledOnceWith(spawnStub, "foo");
            assert.calledOnce(waitDevServerReadyStub);
        });

        it("should not probe server when reuseExisting is not set (default false)", async () => {
            await initDevServer_({
                command: "foo",
                readinessProbe: defaultReadinessProbe,
            });

            assert.notCalled(probeServerStub);
            assert.calledWith(loggerStub.log, "Starting dev server with command", '"foo"');
            assert.calledOnceWith(spawnStub, "foo");
            assert.calledOnce(waitDevServerReadyStub);
        });
    });
});
