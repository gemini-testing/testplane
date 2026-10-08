import proxyquire from "proxyquire";
import sinon, { type SinonStub } from "sinon";
import type {
    runDockerBrowser as RunDockerBrowser,
    prepareDockerImages as PrepareDockerImages,
    checkDockerParallelism as CheckDockerParallelism,
} from "src/browser/docker";
import type { DockerConfig } from "src/config/types";
import { EventEmitter } from "events";
import { tmpdir } from "os";
import path from "path";

describe("browser/docker", () => {
    const sandbox = sinon.createSandbox();
    let prepareDockerImages: typeof PrepareDockerImages;
    let runDockerBrowser: typeof RunDockerBrowser;
    let checkDockerParallelism: typeof CheckDockerParallelism;
    let warnStub: SinonStub;
    let prepareImage: SinonStub;
    let command: SinonStub;
    let syncCommand: SinonStub;
    let fetchStub: SinonStub;
    let exitHandlers: (() => void)[];
    let writeConfig: SinonStub;
    let removeConfig: SinonStub;
    let listLogs: SinonStub;
    let openLog: SinonStub;
    let spawnCommand: SinonStub;
    const selenoidImage = "registry.example.com/selenoid:1.11.3";

    const start = (
        image: string | null,
        options = {},
        container: DockerConfig = {},
    ): ReturnType<typeof runDockerBrowser> =>
        runDockerBrowser(image === null ? null : { image, selenoidImage, ...container }, {
            browserName: "chrome",
            browserVersion: "98.0",
            ...options,
        });

    beforeEach(() => {
        command = sandbox
            .stub()
            .callsFake(async (args: string[]) => (args[0] === "image" && args[1] === "inspect" ? "linux/amd64" : ""));
        command.withArgs(["info", "--format", "{{.OSType}}"]).resolves("linux");
        command.withArgs(["info", "--format", "{{json .SecurityOptions}}"]).resolves('["name=seccomp"]');
        command.withArgs(["version", "--format", "{{json .Server.Components}}"]).resolves('[{"Name":"Engine"}]');
        command
            .withArgs(sinon.match.array.startsWith(["inspect", "--format", "{{json .NetworkSettings.Ports}}"]))
            .resolves(JSON.stringify({ "4444/tcp": [{ HostIp: "127.0.0.1", HostPort: "12345" }] }));
        command.withArgs(sinon.match.array.startsWith(["inspect", "--format", "{{.State.Running}}"])).resolves("true");
        syncCommand = sandbox.stub();
        fetchStub = sandbox.stub(globalThis, "fetch").resolves({
            ok: true,
            json: async () => ({ total: 1, browsers: { chrome: {} } }),
        } as Response);
        exitHandlers = [];
        sandbox
            .stub(process, "once")
            .callThrough()
            .withArgs("exit")
            .callsFake(((_event: string, fn: () => void) => {
                exitHandlers.push(fn);
                return process;
            }) as any);
        sandbox.spy(process, "off");

        writeConfig = sandbox.stub().resolves();
        removeConfig = sandbox.stub().resolves();
        listLogs = sandbox.stub().resolves([]);
        openLog = sandbox.stub();
        spawnCommand = sandbox.stub().callsFake(() => {
            const child = new EventEmitter();
            queueMicrotask(() => child.emit("close", 0, null));
            return child;
        });
        warnStub = sandbox.stub();
        prepareImage = sandbox.stub().callsFake(async (image: string) => image);
        const dockerModule = proxyquire("src/browser/docker", {
            "./docker-image": { prepareDockerBrowserImage: prepareImage },
            "../utils/logger": { warn: warnStub, log: sandbox.stub() },
            "fs/promises": {
                mkdtemp: sandbox.stub().resolves("/tmp/testplane-selenoid-test"),
                writeFile: writeConfig,
                rm: removeConfig,
                mkdir: sandbox.stub().resolves(),
                readdir: listLogs,
                open: openLog,
            },
            fs: { rmSync: sandbox.stub() },
            // eslint-disable-next-line camelcase
            child_process: {
                spawn: spawnCommand,
                execFile: (_file: string, args: string[], _opts: unknown, callback: any): void => {
                    command(args).then(
                        (stdout: string) => callback(null, stdout, args[0] === "logs" ? "stderr logs" : ""),
                        (error: Error) => callback(error, "", error.message),
                    );
                },
                execFileSync: syncCommand,
            },
        });
        prepareDockerImages = dockerModule.prepareDockerImages;
        runDockerBrowser = dockerModule.runDockerBrowser;
        checkDockerParallelism = dockerModule.checkDockerParallelism;
    });

    afterEach(() => sandbox.restore());

    describe("image preparation without sessions", () => {
        it("should pull missing browser and controller images and prepare CDP without starting containers", async () => {
            for (const image of ["browser", selenoidImage]) {
                command
                    .withArgs(["image", "inspect", "--format", "{{.Os}}/{{.Architecture}}", "--", image])
                    .onFirstCall()
                    .rejects(new Error("No such image"));
            }
            prepareImage.resolves("testplane-browser:prepared");

            const result = await prepareDockerImages({ image: "browser", selenoidImage }, "Chrome");

            assert.deepEqual(result, { image: "testplane-browser:prepared", selenoidImage });
            for (const image of ["browser", selenoidImage]) {
                assert.calledWith(command, ["pull", "--platform", "linux/amd64", "--quiet", image]);
            }
            assert.calledOnce(prepareImage);
            assert.isFalse(command.getCalls().some(call => ["create", "start", "network"].includes(call.args[0][0])));
            assert.notCalled(writeConfig);
            assert.notCalled(fetchStub);
        });

        it("should reuse local images and leave Firefox unchanged", async () => {
            const result = await prepareDockerImages({ image: "firefox", selenoidImage }, "firefox");

            assert.equal(result.image, "firefox");
            assert.notCalled(prepareImage);
            assert.isFalse(command.getCalls().some(call => call.args[0][0] === "pull"));
        });

        it("should propagate preparation errors before any session is created", async () => {
            prepareImage.rejects(new Error("CDP image build failed"));

            await assert.isRejected(
                prepareDockerImages({ image: "browser", selenoidImage }, "yandex"),
                "CDP image build failed",
            );
            assert.notCalled(writeConfig);
        });
    });

    describe("parallelism validation", () => {
        beforeEach(() => {
            command.withArgs(["info", "--format", "{{.NCPU}}"]).resolves("8");
        });

        it("should reject 20 browsers on 8 Docker CPUs", async () => {
            await assert.isRejected(
                checkDockerParallelism(20),
                "Docker browser parallelism is 20, but Docker has 8 CPUs. The maximum allowed is 10",
            );
            assert.notCalled(warnStub);
        });

        it("should allow parallelism at or below the limit", async () => {
            await checkDockerParallelism(10);
            await checkDockerParallelism(5);
            assert.notCalled(warnStub);
        });

        it("should scale the limit with Docker CPUs and round down", async () => {
            command.withArgs(["info", "--format", "{{.NCPU}}"]).resolves("6");
            await checkDockerParallelism(7);
            assert.notCalled(warnStub);
            await assert.isRejected(checkDockerParallelism(8), "maximum allowed is 7");
        });

        it("should reject if Docker CPU detection fails", async () => {
            command.withArgs(["info", "--format", "{{.NCPU}}"]).rejects(new Error("daemon unavailable"));
            await assert.isRejected(
                checkDockerParallelism(20),
                "Cannot check Docker browser parallelism: daemon unavailable",
            );
        });

        ["", "0", "unknown"].forEach(value => {
            it(`should report an invalid Docker CPU count: ${JSON.stringify(value)}`, async () => {
                command.withArgs(["info", "--format", "{{.NCPU}}"]).resolves(value);
                await assert.isRejected(checkDockerParallelism(20), "Invalid Docker CPU count");
            });
        });
    });

    it("should allow the Selenoid controller to access the engine socket when SELinux is enabled", async () => {
        command
            .withArgs(["info", "--format", "{{json .SecurityOptions}}"])
            .resolves('["name=rootless", "name=selinux", "name=seccomp"]');
        const driver = await start("browser");
        const args = command.getCalls().find(call => call.args[0][0] === "create")!.args[0];
        const position = args.indexOf("--security-opt");
        assert.isAbove(position, -1);
        assert.equal(args[position + 1], "label=disable");
        assert.isBelow(position, args.indexOf(selenoidImage));
        assert.notInclude(args, "--privileged");
        assert.notProperty(JSON.parse(writeConfig.firstCall.args[1]).chrome.versions["98.0"], "securityOpt");
        await driver.free();
    });

    for (const options of ['["name=seccomp"]', "[]", "null"]) {
        it(`should keep controller security defaults without SELinux (${options})`, async () => {
            command.withArgs(["info", "--format", "{{json .SecurityOptions}}"]).resolves(options);
            const driver = await start("browser");
            const args = command.getCalls().find(call => call.args[0][0] === "create")!.args[0];
            assert.notInclude(args, "--security-opt");
            await driver.free();
        });
    }

    it("should configure the browser image and start Selenoid with an isolated network and Docker socket", async () => {
        const driver = await start("registry/browser:1");
        const args = command.getCalls().find(call => call.args[0][0] === "create")!.args[0];
        const name = args[2];

        assert.deepEqual(args.slice(0, 2), ["create", "--name"]);
        assert.match(name, /^testplane-/);
        assert.deepEqual(args.slice(3), [
            "--platform",
            "linux/amd64",
            "--pull",
            "never",
            "--publish",
            "127.0.0.1::4444",
            "--network",
            `${name}-network`,
            "--volume",
            "/var/run/docker.sock:/var/run/docker.sock",
            selenoidImage,
            "-conf",
            "/browsers.json",
            "-container-network",
            `${name}-network`,
            "-limit",
            "1",
            "-retry-count",
            "1",
            "-capture-driver-logs",
            "-service-startup-timeout",
            "30000ms",
            "-session-attempt-timeout",
            "30000ms",
        ]);
        assert.deepEqual(JSON.parse(writeConfig.firstCall.args[1]), {
            chrome: {
                default: "98.0",
                versions: {
                    "98.0": {
                        image: "registry/browser:1",
                        port: "4444",
                        path: "/",
                        shmSize: 2147483648,
                        hosts: ["host.docker.internal:host-gateway"],
                    },
                },
            },
        });
        assert.calledWith(command, ["cp", "/tmp/testplane-selenoid-test/browsers.json", `${name}:/browsers.json`]);
        assert.calledWith(command, ["start", name]);
        assert.equal(driver.gridUrl, "http://127.0.0.1:12345/wd/hub");
        assert.isUndefined(driver.getPid());
        assert.calledWith(fetchStub, "http://127.0.0.1:12345/status");
        await driver.free();
        assert.calledOnce(removeConfig);
    });

    it("should rely on Podman host resolution without injecting host-gateway", async () => {
        command
            .withArgs(["version", "--format", "{{json .Server.Components}}"])
            .resolves('[{"Name":"Podman Engine"},{"Name":"Engine"}]');
        const driver = await start("browser");
        const config = JSON.parse(writeConfig.firstCall.args[1]);
        assert.deepEqual(config.chrome.versions["98.0"].hosts, []);
        await driver.free();
    });

    it("should mark Selenoid as containerized before starting it on Podman", async () => {
        command.withArgs(["version", "--format", "{{json .Server.Components}}"]).resolves('[{"Name":"Podman Engine"}]');
        const driver = await start("browser");
        const name = command.getCalls().find(call => call.args[0][0] === "create")!.args[0][2];
        const marker = "/tmp/testplane-selenoid-test/.dockerenv";
        assert.calledWith(writeConfig, marker, "");
        const copy = command.withArgs(["cp", marker, `${name}:/.dockerenv`]);
        assert.calledOnce(copy);
        assert.callOrder(writeConfig.withArgs(marker), copy, command.withArgs(["start", name]));
        await driver.free();
    });

    it("should use Docker's own container marker on Docker", async () => {
        const driver = await start("browser");
        assert.isFalse(
            command.getCalls().some(call => call.args[0].some((arg: string) => arg.endsWith("/.dockerenv"))),
        );
        await driver.free();
    });

    it("should preserve explicit host mappings on Podman", async () => {
        command.withArgs(["version", "--format", "{{json .Server.Components}}"]).resolves('[{"Name":"Podman Engine"}]');
        const hosts = ["app:192.0.2.1", "host.docker.internal:192.0.2.2"];
        const driver = await start("browser", {}, { hosts });
        const config = JSON.parse(writeConfig.firstCall.args[1]);
        assert.deepEqual(config.chrome.versions["98.0"].hosts, hosts);
        await driver.free();
    });

    it("should use a custom Selenoid image without passing it to browsers.json", async () => {
        const customImage = "registry/selenoid:custom";
        command
            .withArgs(["image", "inspect", "--format", "{{.Os}}/{{.Architecture}}", "--", customImage])
            .onFirstCall()
            .rejects(new Error("No such image"))
            .onSecondCall()
            .resolves("linux/amd64");
        const driver = await start("browser:1", {}, { selenoidImage: customImage });
        assert.calledWith(command, ["pull", "--platform", "linux/amd64", "--quiet", customImage]);
        const create = command.getCalls().find(call => call.args[0][0] === "create")!.args[0];
        assert.include(create, customImage);
        assert.notInclude(create, selenoidImage);
        const config = JSON.parse(writeConfig.firstCall.args[1]);
        assert.equal(config.chrome.versions["98.0"].image, "browser:1");
        assert.notProperty(config.chrome.versions["98.0"], "selenoidImage");
        await driver.free();
    });

    it("should require an explicitly configured Selenoid image before calling Docker", async () => {
        await assert.isRejected(
            runDockerBrowser({ image: "browser:1" }, { browserName: "chrome" }),
            '"docker.selenoidImage" must be a non-empty string when "gridUrl" is "docker"',
        );
        assert.notCalled(command);
    });

    [null, "", "  ", 123, "--privileged", "image extra"].forEach(value => {
        it(`should reject invalid selenoidImage before starting Docker: ${JSON.stringify(value)}`, async () => {
            await assert.isRejected(
                start("browser", {}, { selenoidImage: value } as DockerConfig),
                "docker.selenoidImage",
            );
            assert.notCalled(command);
        });
    });

    it("should route Firefox sessions through /wd/hub inside the browser container", async () => {
        const driver = await start(
            "registry.yandex.net/selenium/firefox:148.0",
            {
                browserName: "firefox",
                browserVersion: "148.0",
            },
            { path: "/wd/hub", tmpfs: { "/tmp": "size=512m" } },
        );

        try {
            const config = JSON.parse(writeConfig.firstCall.args[1]);
            assert.equal(config.firefox.versions["148.0"].path, "/wd/hub");
            assert.equal(config.firefox.versions["148.0"].port, "4444");
            assert.deepEqual(config.firefox.versions["148.0"].tmpfs, { "/tmp": "size=512m" });
            assert.equal(driver.gridUrl, "http://127.0.0.1:12345/wd/hub");
        } finally {
            await driver.free();
        }
    });

    [null, "", "  "].forEach(image => {
        it(`should reject missing or empty image: ${JSON.stringify(image)}`, async () => {
            await assert.isRejected(start(image), '"docker.image" must be a non-empty string');
            assert.notCalled(command);
        });
    });

    ["--privileged", "image extra"].forEach(image => {
        it(`should reject invalid image: ${image}`, async () => {
            await assert.isRejected(start(image), "Invalid docker.image");
            assert.notCalled(command);
        });
    });

    it("should explain how to fix a missing Docker executable", async () => {
        command
            .withArgs(sinon.match.array.startsWith(["info"]))
            .rejects(Object.assign(new Error("spawn docker ENOENT"), { code: "ENOENT" }));
        await assert.isRejected(start("browser"), "Docker is not installed or is not on PATH");
    });

    it("should distinguish an unavailable daemon from a missing image", async () => {
        command
            .withArgs(sinon.match.array.startsWith(["info"]))
            .rejects(new Error("Cannot connect to the Docker daemon"));
        await assert.isRejected(start("browser"), "Docker daemon is unavailable");
    });

    it("should pull a missing image for amd64 and then start it", async () => {
        command
            .withArgs(sinon.match.array.startsWith(["image", "inspect"]))
            .onFirstCall()
            .rejects(new Error("No such image: browser"));
        const driver = await start("browser");
        assert.calledWith(command, ["pull", "--platform", "linux/amd64", "--quiet", "browser"]);
        assert.equal(command.getCalls().filter(call => call.args[0][0] === "image").length, 3);
        await driver.free();
    });

    it("should not pull an image already available locally", async () => {
        const driver = await start("browser");
        assert.isFalse(command.getCalls().some(call => call.args[0][0] === "pull"));
        await driver.free();
    });

    it("should share the pull between parallel sessions", async () => {
        command
            .withArgs(sinon.match.array.startsWith(["image", "inspect"]))
            .onFirstCall()
            .rejects(new Error("No such image: browser"));
        const drivers = await Promise.all([start("browser"), start("browser")]);
        assert.equal(command.getCalls().filter(call => call.args[0][0] === "pull").length, 1);
        await Promise.all(drivers.map(driver => driver.free()));
    });

    it("should report registry errors and allow retrying a failed pull", async () => {
        command
            .withArgs(sinon.match.array.startsWith(["image", "inspect"]))
            .onFirstCall()
            .rejects(new Error("No such image: browser"));
        command.withArgs(sinon.match.array.startsWith(["pull"])).rejects(new Error("pull access denied"));
        await assert.isRejected(start("browser"), 'Cannot pull Docker image "browser" for linux/amd64');
        assert.isFalse(command.getCalls().some(call => call.args[0][0] === "create"));
        const driver = await start("browser");
        await driver.free();
    });

    it("should verify the platform after pulling", async () => {
        const inspect = command.withArgs(sinon.match.array.startsWith(["image", "inspect"]));
        inspect.onFirstCall().rejects(new Error("No such image: browser"));
        inspect.onSecondCall().resolves("linux/arm64");
        await assert.isRejected(start("browser"), 'targets "linux/arm64"; expected "linux/amd64"');
    });

    it("should preserve unexpected image inspection errors", async () => {
        command.withArgs(sinon.match.array.startsWith(["image", "inspect"])).rejects(new Error("permission denied"));
        await assert.isRejected(start("browser"), 'Cannot inspect Docker image "browser".\npermission denied');
    });

    it("should reject images for a different architecture", async () => {
        command.withArgs(sinon.match.array.startsWith(["image", "inspect"])).resolves("linux/arm64");
        await assert.isRejected(start("browser"), 'targets "linux/arm64"; expected "linux/amd64"');
    });

    it("should remove the container only once when free and kill race", async () => {
        const driver = await start("browser");
        await Promise.all([driver.free(), driver.kill()]);
        assert.equal(command.getCalls().filter(call => call.args[0][0] === "rm").length, 1);
        assert.calledWith(process.off as SinonStub, "exit", exitHandlers[0]);
    });

    it("should clean up synchronously if the process exits", async () => {
        await start("browser");
        exitHandlers[0]();
        assert.calledWith(syncCommand, "docker", ["rm", "--force", sinon.match(/^testplane-/)]);
    });

    it("should use distinct container names for parallel sessions", async () => {
        const drivers = await Promise.all([start("browser"), start("browser")]);
        const runs = command.getCalls().filter(call => call.args[0][0] === "create");
        assert.notEqual(runs[0].args[0][2], runs[1].args[0][2]);
        await Promise.all(drivers.map(driver => driver.free()));
    });

    it("should remove a container and include logs when startup fails", async () => {
        command.withArgs(sinon.match.array.startsWith(["create"])).rejects(new Error("emulation failed"));
        await assert.isRejected(start("browser"), "emulation failed\nContainer logs:\nstderr logs");
        assert.calledWith(command, ["rm", "--force", sinon.match(/^testplane-/)]);
    });

    it("should detect a container that exited before becoming ready", async () => {
        command.withArgs(sinon.match.array.startsWith(["inspect", "--format", "{{.State.Running}}"])).resolves("false");
        await assert.isRejected(start("browser"), "Selenoid container exited before becoming ready");
        assert.calledWith(command, ["rm", "--force", sinon.match(/^testplane-/)]);
    });

    it("should time out and remove a container whose WebDriver is not ready", async () => {
        fetchStub.resolves({ ok: true, json: async () => ({ value: { ready: false } }) });
        await assert.isRejected(start("browser", { timeout: 5 }), "Selenoid did not become ready within 5 ms");
        assert.calledWith(command, ["rm", "--force", sinon.match(/^testplane-/)]);
    });

    it("should wait through connection errors and a not-ready status", async () => {
        fetchStub.onFirstCall().rejects(new Error("ECONNREFUSED"));
        fetchStub.onSecondCall().resolves({ ok: true, json: async () => ({ value: { ready: false } }) });
        const driver = await start("browser");
        assert.calledThrice(fetchStub);
        await driver.free();
    });

    it("should remove leftover browser containers before removing the isolated network", async () => {
        const driver = await start("browser");
        command.withArgs(sinon.match.array.startsWith(["ps"])).resolves("child-one\nchild-two");
        await driver.kill();
        assert.calledWith(command, ["rm", "--force", "child-one", "child-two"]);
        assert.calledWith(command, ["network", "rm", sinon.match(/^testplane-.*-network$/)]);
    });

    it("should expose controller logs before cleanup when session creation fails", async () => {
        const driver = await start("browser");
        assert.equal(await driver.getLogs!(), "stderr logs");
        await driver.kill();
    });

    it("should read container logs before the browser service becomes ready", async () => {
        const driver = await start("browser");
        const network = command.getCalls().find(call => call.args[0][0] === "create")!.args[0][2] + "-network";
        command
            .withArgs(["ps", "--all", "--quiet", "--filter", `network=${network}`, "--filter", "ancestor=browser"])
            .resolves("android-container");
        command.withArgs(["logs", "--tail", "100", "android-container"]).resolves("Emulator failed to boot\n");
        listLogs.rejects(new Error("Selenoid has not saved logs yet"));

        try {
            assert.include(
                await driver.getLogs!(),
                "Browser container log (android-container):\nEmulator failed to boot",
            );
        } finally {
            await driver.free();
        }
    });

    it("should preserve saved logs when listing browser containers fails", async () => {
        const driver = await start("browser");
        command.withArgs(sinon.match.array.startsWith(["ps"])).rejects(new Error("Docker unavailable"));
        assert.equal(await driver.getLogs!(), "stderr logs");
        command.withArgs(sinon.match.array.startsWith(["ps"])).resolves("");
        await driver.free();
    });

    it("should include saved browser logs and close the log file", async () => {
        const driver = await start("browser");
        const contents = Buffer.from("Chrome: No usable sandbox!");
        const close = sandbox.stub().resolves();
        listLogs.resolves([{ name: "session.log", isFile: (): boolean => true }]);
        openLog.resolves({
            stat: async () => ({ size: contents.length }),
            read: async (buffer: Buffer) => ({ bytesRead: contents.copy(buffer) }),
            close,
        });

        assert.include(await driver.getLogs!(), "Browser log (session.log):\nChrome: No usable sandbox!");
        assert.calledOnce(close);
        await driver.kill();
    });

    it("should preserve controller logs if browser logs cannot be read", async () => {
        const driver = await start("browser");
        listLogs.rejects(new Error("logs unavailable"));
        assert.equal(await driver.getLogs!(), "stderr logs");
        await driver.kill();
    });

    it("should use the configured image as the default when no version is specified", async () => {
        const driver = await start("browser", { browserVersion: undefined });
        const config = JSON.parse(writeConfig.firstCall.args[1]);
        assert.equal(config.chrome.default, "default");
        assert.equal(config.chrome.versions.default.image, "browser");
        await driver.free();
    });

    it("should allow a missing browser name for Appium images", async () => {
        const container = {
            path: "/wd/hub",
            port: "4723",
            shmSize: 7516192768,
            volumes: ["/tmp/.X11-unix:/tmp/.X11-unix"],
            hosts: ["app:192.0.2.1"],
            env: ["TZ=UTC"],
        };
        const driver = await start("browser", { browserName: undefined }, container);
        try {
            const config = JSON.parse(writeConfig.firstCall.args[1]);
            assert.deepEqual(config[""].versions["98.0"], { image: "browser", ...container });
            assert.equal(driver.gridUrl, "http://127.0.0.1:12345/wd/hub");
        } finally {
            await driver.free();
        }
    });

    describe("session logs", () => {
        it("should stream full logs to a session file outside the directory removed on cleanup", async () => {
            const driver = await start("browser");
            const file = { fd: 123, appendFile: sandbox.stub().resolves(), close: sandbox.stub().resolves() };
            openLog.resolves(file);
            command.withArgs(sinon.match.array.startsWith(["ps", "--all"])).resolves("browser-id");

            const filePath = await driver.saveLogs!("session/id");

            assert.equal(filePath, path.join(tmpdir(), "testplane-logs", "session%2Fid.log"));
            assert.calledWith(openLog, filePath, "w", 0o600);
            assert.calledWith(file.appendFile, sinon.match("Session: session/id"));
            assert.calledWith(
                spawnCommand,
                "docker",
                ["logs", "--timestamps", "browser-id"],
                sinon.match({ stdio: ["ignore", 123, 123] }),
            );
            assert.isFalse(spawnCommand.getCalls().some(call => call.args[1].includes("--tail")));
            assert.calledOnce(file.close);
            await driver.free();
            assert.calledOnceWith(removeConfig, "/tmp/testplane-selenoid-test", { recursive: true, force: true });
        });

        it("should record unavailable output and still close the log file", async () => {
            const driver = await start("browser");
            const file = { fd: 123, appendFile: sandbox.stub().resolves(), close: sandbox.stub().resolves() };
            openLog.resolves(file);
            spawnCommand.callsFake(() => {
                const child = new EventEmitter();
                queueMicrotask(() => child.emit("error", new Error("daemon unavailable")));
                return child;
            });
            await driver.saveLogs!("session-id");
            assert.calledWith(file.appendFile, sinon.match("Log collection failed: daemon unavailable"));
            assert.calledOnce(file.close);
            await driver.free();
        });
    });

    for (const browserName of ["chrome", "yandex", "Chrome", "Yandex"]) {
        it(`should give Selenoid the prepared image for "${browserName}" and use it to locate containers`, async () => {
            prepareImage.resolves("testplane-browser:prepared");
            const driver = await start("browser", { browserName });
            const config = JSON.parse(writeConfig.firstCall.args[1]);
            assert.calledOnce(prepareImage);
            assert.equal(config[browserName].versions["98.0"].image, "testplane-browser:prepared");
            await driver.getLogs!();
            assert.isTrue(
                command.getCalls().some(call => call.args[0].includes("ancestor=testplane-browser:prepared")),
            );
            await driver.free();
        });
    }

    for (const browserName of ["firefox", "MicrosoftEdge", "opera", "android", ""]) {
        it(`should use the original image without devtools preparation for "${browserName}"`, async () => {
            prepareImage.rejects(new Error("Image preparation must not run"));
            const driver = await start("original-browser:1", { browserName });
            const config = JSON.parse(writeConfig.firstCall.args[1]);
            assert.notCalled(prepareImage);
            assert.equal(config[browserName].versions["98.0"].image, "original-browser:1");
            await driver.getLogs!();
            assert.isTrue(command.getCalls().some(call => call.args[0].includes("ancestor=original-browser:1")));
            await driver.free();
        });
    }

    it("should report image preparation failure before creating containers or networks", async () => {
        prepareImage.rejects(new Error("UPX installation failed"));
        await assert.isRejected(start("browser"), "UPX installation failed");
        assert.isFalse(command.getCalls().some(call => ["create", "network"].includes(call.args[0][0])));
        assert.notCalled(writeConfig);
    });

    describe("CDP adapter", () => {
        it("should reuse a working CDP adapter without starting a proxy", async () => {
            const driver = await start("browser");
            fetchStub.resolves({ ok: true, json: async () => ({ domains: [] }) });
            await driver.prepareCdp!("session-id");
            assert.calledWith(fetchStub, "http://127.0.0.1:12345/devtools/session-id/json/protocol");
            assert.lengthOf(
                command.getCalls().filter(call => call.args[0][0] === "create"),
                1,
            );
            assert.isFalse(command.getCalls().some(call => call.args[0][0] === "exec"));
            assert.calledOnce(prepareImage);
            await driver.free();
        });

        it("should wait for the native adapter without running commands in the browser", async () => {
            const driver = await start("browser");
            fetchStub.resetHistory();
            fetchStub.resolves({ ok: true, json: async () => ({ domains: [] }) });
            fetchStub.onFirstCall().rejects(new Error("CDP unavailable"));
            command.withArgs(sinon.match.array.startsWith(["ps", "--quiet"])).resolves("browser-id");
            await driver.prepareCdp!("session-id");
            assert.calledOnce(prepareImage);
            assert.isFalse(command.getCalls().some(call => call.args[0][0] === "exec"));
            assert.lengthOf(
                command.getCalls().filter(call => call.args[0][0] === "create"),
                1,
            );
            assert.lengthOf(
                command.getCalls().filter(call => call.args[0][0] === "image"),
                2,
            );
            await driver.free();
        });

        it("should fail if the browser exits before CDP is ready", async () => {
            const driver = await start("browser");
            fetchStub.rejects(new Error("CDP unavailable"));
            command.withArgs(sinon.match.array.startsWith(["ps", "--quiet"])).resolves("browser-id");
            command.withArgs(["inspect", "--format", "{{.State.Running}}", "browser-id"]).resolves("false");
            await assert.isRejected(driver.prepareCdp!("session-id"), "browser container exited");
            await driver.kill();
        });

        it("should time out if CDP never becomes ready", async () => {
            const driver = await start("browser", { timeout: 10 });
            fetchStub.rejects(new Error("CDP unavailable"));
            command.withArgs(sinon.match.array.startsWith(["ps", "--quiet"])).resolves("browser-id");
            await assert.isRejected(driver.prepareCdp!("session-id"), "CDP adapter did not become ready");
            await driver.kill();
        });
    });

    it("should pull a missing Selenoid image too", async () => {
        command
            .withArgs(["image", "inspect", "--format", "{{.Os}}/{{.Architecture}}", "--", selenoidImage])
            .onFirstCall()
            .rejects(new Error("No such image"));
        const driver = await start("browser");
        assert.calledWith(command, ["pull", "--platform", "linux/amd64", "--quiet", selenoidImage]);
        await driver.free();
    });

    it("should retain the exit cleanup and allow retry after a removal failure", async () => {
        const driver = await start("browser");
        const rm = command.withArgs(sinon.match.array.startsWith(["rm"]));
        rm.onFirstCall().rejects(new Error("daemon unavailable"));
        await assert.isRejected(Promise.resolve(driver.free()), "Cannot remove Docker environment");
        assert.neverCalledWith(process.off as SinonStub, "exit", exitHandlers[0]);
        await driver.kill();
        assert.calledWith(process.off as SinonStub, "exit", exitHandlers[0]);
    });
});
