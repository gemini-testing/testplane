import proxyquire from "proxyquire";
import sinon from "sinon";
import { AsyncEmitter, MasterEvents } from "src/events";
import type { Config } from "src/config";
import type * as DockerManager from "src/browser/docker-manager";

describe("browser/docker-manager", () => {
    const sandbox = sinon.createSandbox();
    let api: typeof DockerManager;
    let controller: any;
    let start: sinon.SinonStub;
    let check: sinon.SinonStub;
    let signals: AsyncEmitter;
    const docker = { image: "chrome:1", selenoidImage: "selenoid:1" };
    const options = { browserName: "chrome", timeout: 1000 };
    const makeConfig = (): Config =>
        ({
            forBrowser: (id: string) => ({
                docker: { ...docker, image: id === "second" ? "chrome:2" : docker.image },
                desiredCapabilities: { browserName: "chrome" },
                sessionRequestTimeout: id === "second" ? 2000 : 1000,
            }),
        } as unknown as Config);

    beforeEach(() => {
        controller = {
            kill: sandbox.stub().resolves(),
            addBrowser: sandbox.stub().resolves(),
            createSession: sandbox.stub().callsFake(() => ({
                gridUrl: "http://localhost:1234/wd/hub",
                free: sandbox.stub().resolves(),
                kill: sandbox.stub().resolves(),
                getPid: (): undefined => undefined,
            })),
        };
        start = sandbox.stub().resolves(controller);
        check = sandbox.stub().resolves(5);
        signals = new AsyncEmitter();
        api = proxyquire("src/browser/docker-manager", {
            "./docker": { startDockerController: start, checkDockerParallelism: check },
            "../signal-handler": { __esModule: true, default: signals },
        });
    });
    afterEach(() => sandbox.restore());

    it("shares startup across parallel sessions and retains the controller between batches", async () => {
        const config = makeConfig();
        api.configureDockerRun(config, ["first", "second"], 3);
        const close = sandbox.stub().resolves();
        const sessions = await Promise.all(
            ["first", "second"].map(id => api.runDockerBrowser(docker, options, config, id, close)),
        );
        assert.calledOnce(start);
        assert.equal(start.firstCall.args[3], 3);
        assert.equal(start.firstCall.args[1].timeout, 2000);
        const entries = start.firstCall.args[2];
        assert.deepEqual(
            entries.map((entry: any) => entry.config.image),
            ["chrome:1", "chrome:2"],
        );
        assert.notEqual(entries[0].browserVersion, entries[1].browserVersion);
        await Promise.all(sessions.map(session => session.free()));
        assert.notCalled(controller.kill);
        const next = await api.runDockerBrowser(docker, options, config, "first", close);
        assert.calledOnce(start);
        await next.free();
        await api.stopDockerRun(config);
        assert.calledOnce(controller.kill);
        assert.notCalled(check);
    });

    it("closes active sessions before removing the controller, even if a session fails to close", async () => {
        const config = makeConfig();
        api.configureDockerRun(config, ["first"], 1);
        const close = sandbox.stub().rejects(new Error("session failed"));
        await api.runDockerBrowser(docker, options, config, "first", close);
        await Promise.all([api.stopDockerRun(config), api.stopDockerRun(config)]);
        assert.calledOnce(close);
        assert.calledOnce(controller.kill);
        assert.callOrder(close, controller.kill);
    });

    it("does not start containers for an unused run", async () => {
        const config = makeConfig();
        api.configureDockerRun(config, ["first"], 1);
        await api.stopDockerRun(config);
        assert.notCalled(start);
    });

    it("does not create a session when stopping during controller startup", async () => {
        let ready!: (value: unknown) => void;
        start.returns(
            new Promise(resolve => {
                ready = resolve;
            }),
        );
        const config = makeConfig();
        api.configureDockerRun(config, ["first"], 1);
        const pending = api.runDockerBrowser(docker, options, config, "first", sandbox.stub().resolves());
        await Promise.resolve();
        await Promise.resolve();
        const stopped = api.stopDockerRun(config);
        ready(controller);
        await assert.isRejected(pending, "already ended");
        await stopped;
        assert.notCalled(controller.createSession);
        assert.calledOnce(controller.kill);
    });

    it("shares a startup failure without creating multiple controllers on retries", async () => {
        start.rejects(new Error("controller failed"));
        const config = makeConfig();
        api.configureDockerRun(config, ["first"], 2);
        const results = await Promise.allSettled(
            [1, 2].map(() => api.runDockerBrowser(docker, options, config, "first", sandbox.stub().resolves())),
        );
        assert.isTrue(results.every(result => result.status === "rejected"));
        assert.calledOnce(start);
        await api.stopDockerRun(config);
    });

    it("gives separate runs their own controller ownership", async () => {
        const configs = [makeConfig(), makeConfig()];
        for (const config of configs) {
            api.configureDockerRun(config, ["first"], 1);
            const session = await api.runDockerBrowser(docker, options, config, "first", sandbox.stub().resolves());
            await session.free();
        }
        assert.calledTwice(start);
        await Promise.all(configs.map(config => api.stopDockerRun(config)));
    });

    it("shares standalone sessions, reloads new entries and stops only after the last release", async () => {
        const close = sandbox.stub().resolves();
        const [first, second] = await Promise.all(
            [1, 2].map(() => api.runDockerBrowser(docker, options, makeConfig(), "chrome", close)),
        );
        assert.calledOnce(start);
        assert.calledOnce(check);
        assert.equal(start.firstCall.args[3], 5);
        assert.calledOnce(controller.addBrowser);
        await Promise.all([first.free(), first.kill()]);
        assert.notCalled(controller.kill);
        await second.free();
        assert.calledOnce(controller.kill);
    });

    it("does not kill an existing standalone session when adding another browser fails", async () => {
        const first = await api.runDockerBrowser(docker, options, makeConfig(), "chrome", sandbox.stub().resolves());
        controller.addBrowser.rejects(new Error("incompatible controller"));
        await assert.isRejected(
            api.runDockerBrowser(docker, options, makeConfig(), "chrome", sandbox.stub().resolves()),
            "incompatible controller",
        );
        assert.notCalled(controller.kill);
        await first.free();
        assert.calledOnce(controller.kill);
    });
    it("finishes standalone cleanup on shutdown without waiting on its own stop promise", async () => {
        const session: Awaited<ReturnType<typeof api.runDockerBrowser>> = await api.runDockerBrowser(
            docker,
            options,
            makeConfig(),
            "chrome",
            async () => {
                await session.free();
            },
        );
        await signals.emitAndWait(MasterEvents.RUNNER_END);
        assert.calledOnce(controller.kill);
    });

    it("concurrent standalone releases both wait for controller cleanup", async () => {
        let finish!: () => void;
        controller.kill.returns(
            new Promise<void>(resolve => {
                finish = resolve;
            }),
        );
        const session = await api.runDockerBrowser(docker, options, makeConfig(), "chrome", sandbox.stub().resolves());
        const first = session.free();
        let done = false;
        const second = Promise.resolve(session.kill()).then(() => {
            done = true;
        });
        await Promise.resolve();
        await Promise.resolve();
        assert.isFalse(done);
        finish();
        await Promise.all([first, second]);
        assert.isTrue(done);
        assert.calledOnce(controller.kill);
    });
});
