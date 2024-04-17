import _ from "lodash";
import proxyquire from "proxyquire";
import sinon, { type SinonStub } from "sinon";
import type { PartialDeep } from "type-fest";
import defaultConfig from "../../../src/config/defaults";
import type { InitDevServer } from "../../../src/dev-server";
import type { Config } from "../../../src/config";
import type { Hermione } from "../../../src/hermione";
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
    let loggerStub: { log: SinonStub };
    let debugLog: SinonStub;
    let hermioneStub: Hermione & { halt: SinonStub };
    let findCwdStub: SinonStub;

    const createDevServerConfig_ = (opts: UserDevServerConfig): Config["devServer"] => {
        return _.defaultsDeep(opts, defaultConfig.devServer);
    };

    const initDevServer_ = (
        devServerConfig: UserDevServerConfig = {},
        configPath = "",
        hermione = hermioneStub,
    ): ReturnType<InitDevServer> => {
        return devServer.initDevServer({
            hermione,
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
        findCwdStub = sandbox.stub();

        loggerStub = { log: sandbox.stub() };
        debugLog = sandbox.stub();

        devServer = proxyquire("src/dev-server", {
            child_process: { spawn: spawnStub }, // eslint-disable-line camelcase
            "../utils/logger": loggerStub,
            debug: sandbox.stub().withArgs("hermione:dev-server").returns(debugLog),
            "./utils": {
                pipeLogsWithPrefix: pipeLogsWithPrefixStub,
                waitDevServerReady: waitDevServerReadyStub,
                findCwd: findCwdStub,
            },
        });

        hermioneStub = {
            halt: sandbox.stub(),
        } as Hermione & { halt: SinonStub };
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

    it("should halt hermione on process kill", async () => {
        await initDevServer_({
            command: "foo",
            logs: false,
        });

        childProcessStub.emit("exit", 9, "SIGKILL");

        assert.calledOnce(hermioneStub.halt);
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
});
