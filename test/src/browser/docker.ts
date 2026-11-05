import proxyquire from "proxyquire";
import sinon, { type SinonStub } from "sinon";
import type { prepareDockerImages as PrepareDockerImages } from "src/browser-backend/docker/engine";
import type { SelenoidDockerController as Controller } from "src/browser-backend/docker/controller";
import type { BrowserConfig } from "src/config/browser-config";
import type { DockerConfig } from "src/config/types";
import RuntimeConfig from "src/config/runtime-config";
import { EventEmitter } from "events";
import { Readable, Writable } from "stream";
import { tmpdir } from "os";
import path from "path";

describe("browser-backend/docker/controller", () => {
    const sandbox = sinon.createSandbox();
    let prepareDockerImages: typeof PrepareDockerImages;
    let SelenoidDockerController: typeof Controller;
    let controllers: Controller[];
    let warnStub: SinonStub;
    let debugStub: SinonStub;
    let prepareImage: SinonStub;
    let command: SinonStub;
    let syncCommand: SinonStub;
    let fetchStub: SinonStub;
    let exitHandlers: (() => void)[];
    let writeConfig: SinonStub;
    let removeConfig: SinonStub;
    let openLog: SinonStub;
    let spawnCommand: SinonStub;
    let getPortStub: SinonStub;
    let writeStream: SinonStub;
    let logChunks: Buffer[];
    const selenoidImage = "registry.example.com/selenoid:1.11.3";
    const daemonPlatformCommand = ["version", "--format", "{{.Server.Os}}/{{.Server.Arch}}"];

    const makeConfig = (
        id: string,
        docker: DockerConfig,
        desiredCapabilities = { browserName: "chrome", browserVersion: "98.0" },
    ): BrowserConfig => ({ id, docker, desiredCapabilities }) as BrowserConfig;

    const start = async (
        image: string,
        options: { browserName?: string; browserVersion?: string; timeout?: number } = {},
        container: DockerConfig = {},
    ): Promise<Controller> => {
        const capabilities = { browserName: "chrome", browserVersion: "98.0", ...options };
        const controller = await SelenoidDockerController.create(
            [makeConfig(capabilities.browserName ?? "appium", { image, selenoidImage, ...container }, capabilities)],
            { timeout: options.timeout },
        );
        controllers.push(controller);

        return controller;
    };

    beforeEach(() => {
        controllers = [];
        command = sandbox
            .stub()
            .callsFake(async (args: string[]) => (args[0] === "image" && args[1] === "inspect" ? "linux/amd64" : ""));
        command.withArgs(["info", "--format", "{{.OSType}}"]).resolves("linux");
        command.withArgs(["info", "--format", "{{json .SecurityOptions}}"]).resolves('["name=seccomp"]');
        command.withArgs(["version", "--format", "{{json .Server.Components}}"]).resolves('[{"Name":"Engine"}]');
        command.withArgs(daemonPlatformCommand).resolves("linux/amd64");
        command
            .withArgs(sinon.match.array.startsWith(["manifest", "inspect"]))
            .resolves(
                JSON.stringify([
                    { Descriptor: { platform: { os: "linux", architecture: "amd64" } } },
                    { Descriptor: { platform: { os: "linux", architecture: "arm64", variant: "v8" } } },
                ]),
            );
        command
            .withArgs(sinon.match.array.startsWith(["inspect", "--format", "{{json .NetworkSettings.Ports}}"]))
            .resolves(JSON.stringify({ "4444/tcp": [{ HostIp: "127.0.0.1", HostPort: "12345" }] }));
        command.withArgs(sinon.match.array.startsWith(["inspect", "--format", "{{.State.Running}}"])).resolves("true");
        command.withArgs(sinon.match.array.startsWith(["exec"])).resolves("present");
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
        openLog = sandbox.stub().callsFake(async () => ({
            fd: 123,
            appendFile: sandbox.stub().resolves(),
            [Symbol.asyncDispose]: sandbox.stub().resolves(),
        }));
        spawnCommand = sandbox.stub().callsFake(() => {
            const child = new EventEmitter();
            queueMicrotask(() => child.emit("close", 0, null));
            return child;
        });
        warnStub = sandbox.stub();
        debugStub = sandbox.stub();
        getPortStub = sandbox.stub().resolves(12346);
        logChunks = [];
        writeStream = sandbox.stub().callsFake(
            () =>
                new Writable({
                    write(chunk, _encoding, done): void {
                        logChunks.push(chunk);
                        done();
                    },
                }),
        );
        prepareImage = sandbox.stub().callsFake(async (image: string) => image);
        const engine = proxyquire("src/browser-backend/docker/engine", {
            "./browser-image": { prepareDockerBrowserImage: prepareImage },
            "../../utils/logger": { log: sandbox.stub(), warn: warnStub },
            // eslint-disable-next-line camelcase
            child_process: {
                spawn: spawnCommand,
                execFile: (_file: string, args: string[], _opts: unknown, callback: any): void => {
                    command(args).then(
                        (stdout: string) => callback(null, stdout, args[0] === "logs" ? "stderr logs" : ""),
                        (error: Error) => callback(error, "", error.message),
                    );
                },
            },
        });
        prepareDockerImages = engine.prepareDockerImages;
        ({ SelenoidDockerController } = proxyquire("src/browser-backend/docker/controller", {
            "./engine": engine,
            "./timing": { debugDocker: debugStub },
            "../../utils/logger": { warn: warnStub, log: sandbox.stub() },
            "get-port": getPortStub,
            "fs/promises": {
                mkdtemp: sandbox.stub().resolves("/tmp/testplane-selenoid-test"),
                writeFile: writeConfig,
                rm: removeConfig,
                mkdir: sandbox.stub().resolves(),
                open: openLog,
            },
            fs: { rmSync: sandbox.stub(), createWriteStream: writeStream },
            // eslint-disable-next-line camelcase
            child_process: { execFileSync: syncCommand },
        }));
    });

    afterEach(async () => {
        try {
            // A failed disposal keeps its synchronous fallback; each test checks that failure itself.
            await Promise.allSettled(controllers.map(controller => controller[Symbol.asyncDispose]()));
        } finally {
            sandbox.restore();
        }
    });

    describe("image preparation without sessions", () => {
        it("should reject a missing Docker config before running Docker", async () => {
            await assert.isRejected(prepareDockerImages(null), '"docker.image" must be a non-empty string');

            assert.notCalled(command);
        });

        for (const key of ["image", "selenoidImage"]) {
            for (const value of [undefined, null, "", "   ", 123]) {
                it(`should reject missing or invalid ${key} before running Docker: ${JSON.stringify(value)}`, async () => {
                    await assert.isRejected(
                        prepareDockerImages({ image: "browser:1", selenoidImage, [key]: value }),
                        `"docker.${key}" must be a non-empty string`,
                    );

                    assert.notCalled(command);
                    assert.notCalled(prepareImage);
                });
            }

            for (const value of ["-image", "image with whitespace"]) {
                it(`should reject an invalid ${key} reference before running Docker: ${value}`, async () => {
                    await assert.isRejected(
                        prepareDockerImages({ image: "browser:1", selenoidImage, [key]: value }),
                        `Invalid docker.${key} "${value}"`,
                    );

                    assert.notCalled(command);
                    assert.notCalled(prepareImage);
                });
            }
        }

        it("should pull missing browser and controller images and prepare CDP without starting containers", async () => {
            for (const image of ["browser", selenoidImage]) {
                command
                    .withArgs([
                        "image",
                        "inspect",
                        "--format",
                        "{{.Os}}/{{.Architecture}}{{if .Variant}}/{{.Variant}}{{end}}",
                        "--",
                        image,
                    ])
                    .onFirstCall()
                    .rejects(new Error("No such image"));
            }
            prepareImage.resolves("testplane-browser:prepared");

            const result = await prepareDockerImages({ image: "browser", selenoidImage }, "Chrome");

            assert.deepEqual(result, { image: "testplane-browser:prepared", selenoidImage });
            assert.calledWith(command, ["pull", "--platform", "linux/amd64", "--quiet", "browser"]);
            assert.calledWith(command, ["pull", "--platform", "linux/amd64", "--quiet", selenoidImage]);
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

    describe("platform selection", () => {
        const imagePlatform = "{{.Os}}/{{.Architecture}}{{if .Variant}}/{{.Variant}}{{end}}";

        describe("registry platform selection", () => {
            const manifestCommand = ["manifest", "inspect", "--verbose", "browser"];

            beforeEach(() => {
                command
                    .withArgs(["image", "inspect", "--format", imagePlatform, "--", "browser"])
                    .onFirstCall()
                    .rejects(new Error("No such image"));
            });

            it("should pull a compatible single-platform image only after checking its metadata", async () => {
                command
                    .withArgs(manifestCommand)
                    .resolves(JSON.stringify({ Descriptor: { platform: { os: "linux", architecture: "amd64" } } }));

                await prepareDockerImages({ image: "browser", selenoidImage });

                const inspect = command.withArgs(manifestCommand);
                const pull = command.withArgs(["pull", "--platform", "linux/amd64", "--quiet", "browser"]);
                assert.calledOnce(inspect);
                assert.calledOnce(pull);
                assert.callOrder(inspect, pull);
            });

            for (const multiPlatform of [false, true]) {
                it(`should fall back to amd64 when arm64 is absent (manifest list: ${multiPlatform})`, async () => {
                    command.withArgs(daemonPlatformCommand).resolves("linux/arm64");
                    const manifest = { Descriptor: { platform: { os: "linux", architecture: "amd64" } } };
                    command.withArgs(manifestCommand).resolves(JSON.stringify(multiPlatform ? [manifest] : manifest));

                    await prepareDockerImages({ image: "browser", selenoidImage }, "chrome");

                    assert.calledWith(command, ["pull", "--platform", "linux/amd64", "--quiet", "browser"]);
                    assert.calledWith(prepareImage, "browser", sinon.match.string, sinon.match.func, "linux/amd64");
                    assert.calledOnce(warnStub);
                    assert.calledWithMatch(warnStub, "unavailable for linux/arm64; using linux/amd64");
                    assert.calledWithMatch(warnStub, "requires emulation");
                });
            }

            it("should fail before pulling when neither the native platform nor amd64 is available", async () => {
                command.withArgs(daemonPlatformCommand).resolves("linux/arm64");
                command
                    .withArgs(manifestCommand)
                    .resolves(
                        JSON.stringify([
                            { Descriptor: { platform: { os: "linux", architecture: "riscv64" } } },
                            { Descriptor: { platform: { os: "unknown", architecture: "unknown" } } },
                        ]),
                    );

                await assert.isRejected(
                    prepareDockerImages({ image: "browser", selenoidImage }),
                    'requested "linux/arm64"',
                );

                assert.isFalse(command.getCalls().some(call => call.args[0][0] === "pull"));
                assert.notCalled(warnStub);
            });

            it("should enforce the selected native platform after pulling even if amd64 is an allowed fallback", async () => {
                command.withArgs(daemonPlatformCommand).resolves("linux/arm64");
                // Inspection after pulling returns amd64 although the registry advertised arm64.

                await assert.isRejected(
                    prepareDockerImages({ image: "browser", selenoidImage }),
                    'targets "linux/amd64"; expected "linux/arm64"',
                );

                assert.calledWith(command, ["pull", "--platform", "linux/arm64", "--quiet", "browser"]);
                assert.notCalled(warnStub);
            });

            for (const { name, manifest, platform } of [
                {
                    name: "a single-platform image",
                    manifest: { Descriptor: { platform: { os: "linux", architecture: "amd64" } } },
                    platform: "linux/arm64",
                },
                {
                    name: "a multi-platform image with no matching architecture",
                    manifest: [
                        { Descriptor: { platform: { os: "linux", architecture: "amd64" } } },
                        { Descriptor: { platform: { os: "linux", architecture: "arm", variant: "v7" } } },
                    ],
                    platform: "linux/arm64",
                },
                {
                    name: "an image with a different variant",
                    manifest: { Descriptor: { platform: { os: "linux", architecture: "arm", variant: "v6" } } },
                    platform: "linux/arm/v7",
                },
                { name: "an image without platform metadata", manifest: {}, platform: "linux/amd64" },
            ]) {
                it(`should reject ${name} when the platform is explicitly requested`, async () => {
                    command.withArgs(manifestCommand).resolves(JSON.stringify(manifest));

                    await assert.isRejected(
                        prepareDockerImages({ image: "browser", selenoidImage, platform }),
                        `requested "${platform}"`,
                    );

                    assert.calledWith(command, manifestCommand);
                    assert.isFalse(command.getCalls().some(call => call.args[0][0] === "pull"));
                });
            }

            it("should propagate registry inspection errors without pulling", async () => {
                command.withArgs(manifestCommand).rejects(new Error("registry access denied"));

                await assert.isRejected(
                    prepareDockerImages({ image: "browser", selenoidImage }),
                    "registry access denied",
                );

                assert.isFalse(command.getCalls().some(call => call.args[0][0] === "pull"));
            });
        });

        for (const platform of ["linux/amd64", "linux/arm64"]) {
            it(`should select the daemon's ${platform} platform regardless of the client architecture`, async () => {
                sandbox.stub(process, "arch").value(platform === "linux/amd64" ? "arm64" : "x64");
                command.withArgs(daemonPlatformCommand).resolves(platform);
                command
                    .withArgs(["image", "inspect", "--format", imagePlatform, "--", "browser"])
                    .onFirstCall()
                    .rejects(new Error("No such image"))
                    .onSecondCall()
                    .resolves(platform);

                await start("browser");

                assert.calledWith(command, ["pull", "--platform", platform, "--quiet", "browser"]);
                assert.calledWith(prepareImage, "browser", sinon.match.string, sinon.match.func, platform);
                assert.notCalled(warnStub);
                const create = command.getCalls().find(call => call.args[0][0] === "create")!.args[0];
                assert.notInclude(create, "--platform");
            });
        }

        for (const platform of ["", "/", "<no value>/<no value>", "linux/", "windows/amd64"]) {
            it(`should reject an invalid daemon platform before preparing images: ${JSON.stringify(platform)}`, async () => {
                command.withArgs(daemonPlatformCommand).resolves(platform);

                await assert.isRejected(
                    prepareDockerImages({ image: "browser", selenoidImage }),
                    "Invalid Docker daemon platform",
                );

                assert.calledOnceWith(command, daemonPlatformCommand);
                assert.notCalled(prepareImage);
            });
        }

        it("should propagate daemon platform discovery errors", async () => {
            command.withArgs(daemonPlatformCommand).rejects(new Error("Cannot connect to the Docker daemon"));

            await assert.isRejected(
                prepareDockerImages({ image: "browser", selenoidImage }),
                "Cannot connect to the Docker daemon",
            );

            assert.calledOnceWith(command, daemonPlatformCommand);
            assert.notCalled(prepareImage);
        });

        it("should not detect the daemon platform when both image platforms are explicitly configured", async () => {
            command
                .withArgs(["image", "inspect", "--format", imagePlatform, "--", "browser"])
                .onFirstCall()
                .rejects(new Error("No such image"))
                .onSecondCall()
                .resolves("linux/arm64/v8");
            const driver = await start("browser", {}, { platform: "linux/arm64", selenoidPlatform: "linux/amd64" });
            assert.calledWith(command, ["pull", "--platform", "linux/arm64", "--quiet", "browser"]);
            assert.calledWith(prepareImage, "browser", sinon.match.string, sinon.match.func, "linux/arm64/v8");
            const create = command.getCalls().find(call => call.args[0][0] === "create")!.args[0];
            assert.equal(create[create.indexOf("--platform") + 1], "linux/amd64");
            assert.neverCalledWith(command, daemonPlatformCommand);
            const entry = JSON.parse(writeConfig.firstCall.args[1]).chrome.versions["98.0"];
            assert.notProperty(entry, "platform");
            assert.notProperty(entry, "selenoidPlatform");
            await driver[Symbol.asyncDispose]();
        });

        it("should prefer native Selenoid independently of the browser platform", async () => {
            command.withArgs(daemonPlatformCommand).resolves("linux/arm64");
            command
                .withArgs(["image", "inspect", "--format", imagePlatform, "--", selenoidImage])
                .onFirstCall()
                .rejects(new Error("No such image"))
                .onSecondCall()
                .resolves("linux/arm64");

            await start("browser", {}, { platform: "linux/amd64" });

            assert.calledWith(command, ["pull", "--platform", "linux/arm64", "--quiet", selenoidImage]);
            assert.calledWith(command, ["manifest", "inspect", "--verbose", selenoidImage]);
            const create = command.getCalls().find(call => call.args[0][0] === "create")!.args[0];
            assert.notInclude(create, "--platform");
        });

        describe("Selenoid platform fallback", () => {
            beforeEach(() => {
                command.withArgs(daemonPlatformCommand).resolves("linux/arm64");
                command
                    .withArgs(["image", "inspect", "--format", imagePlatform, "--", selenoidImage])
                    .onFirstCall()
                    .rejects(new Error("No such image"));
                command
                    .withArgs(["manifest", "inspect", "--verbose", selenoidImage])
                    .resolves(JSON.stringify({ Descriptor: { platform: { os: "linux", architecture: "amd64" } } }));
            });

            it("should fall back to AMD64 when native Selenoid is unavailable", async () => {
                await prepareDockerImages({ image: "browser", selenoidImage });

                assert.calledWith(command, ["pull", "--platform", "linux/amd64", "--quiet", selenoidImage]);
                assert.calledOnce(warnStub);
                assert.calledWithMatch(warnStub, "unavailable for linux/arm64; using linux/amd64");
            });

            it("should not fall back when Selenoid's platform is explicitly configured", async () => {
                await assert.isRejected(
                    prepareDockerImages({ image: "browser", selenoidImage, selenoidPlatform: "linux/arm64" }),
                    'requested "linux/arm64"',
                );

                assert.isFalse(command.getCalls().some(call => call.args[0][0] === "pull"));
                assert.notCalled(warnStub);
            });
        });

        it("should pull and start an ARM controller independently of the browser platform", async () => {
            command
                .withArgs(["image", "inspect", "--format", imagePlatform, "--", selenoidImage])
                .onFirstCall()
                .rejects(new Error("No such image"))
                .onSecondCall()
                .resolves("linux/arm64");
            const driver = await start("browser", {}, { selenoidPlatform: "linux/arm64" });
            assert.calledWith(command, ["pull", "--platform", "linux/arm64", "--quiet", selenoidImage]);
            assert.calledWith(prepareImage, "browser", sinon.match.string, sinon.match.func, "linux/amd64");
            const create = command.getCalls().find(call => call.args[0][0] === "create")!.args[0];
            assert.equal(create[create.indexOf("--platform") + 1], "linux/arm64");
            assert.notProperty(JSON.parse(writeConfig.firstCall.args[1]).chrome.versions["98.0"], "selenoidPlatform");
            await driver[Symbol.asyncDispose]();
        });

        it("should validate an explicitly requested image variant", async () => {
            command.withArgs(["image", "inspect", "--format", imagePlatform, "--", "browser"]).resolves("linux/arm/v6");
            await assert.isRejected(
                start("browser", {}, { platform: "linux/arm/v7" }),
                'targets "linux/arm/v6"; expected "linux/arm/v7"',
            );
            assert.notCalled(prepareImage);
        });

        for (const platform of ["linux/arm64/v8", "linux/amd64"]) {
            it(`should reuse a cached ${platform} image on arm64 without querying the registry`, async () => {
                command.withArgs(daemonPlatformCommand).resolves("linux/arm64");
                command.withArgs(["image", "inspect", "--format", imagePlatform, "--", "browser"]).resolves(platform);

                await prepareDockerImages({ image: "browser", selenoidImage }, "chrome");

                assert.calledWith(prepareImage, "browser", sinon.match.string, sinon.match.func, platform);
                assert.isFalse(command.getCalls().some(call => ["manifest", "pull"].includes(call.args[0][0])));
            });
        }

        for (const key of ["platform", "selenoidPlatform"]) {
            for (const value of [null, "", "arm64", "--privileged", "linux/arm64 extra", "windows/amd64", 123]) {
                it(`should reject invalid ${key}: ${JSON.stringify(value)}`, async () => {
                    await assert.isRejected(start("browser", {}, { [key]: value }), `docker.${key}`);
                    assert.notCalled(command);
                });
            }
        }

        it("should not share image validation across different requested platforms", async () => {
            command.withArgs(["image", "inspect", "--format", imagePlatform, "--", "browser"]).resolves("linux/arm64");
            const results = await Promise.allSettled([
                prepareDockerImages({ image: "browser", selenoidImage, platform: "linux/arm64" }),
                prepareDockerImages({ image: "browser", selenoidImage, platform: "linux/amd64" }),
            ]);
            assert.equal(results[0].status, "fulfilled");
            assert.equal(results[1].status, "rejected");
        });

        it("should keep native-with-fallback selection separate from an explicit native platform", async () => {
            command.withArgs(daemonPlatformCommand).resolves("linux/arm64");
            const results = await Promise.allSettled([
                prepareDockerImages({ image: "browser", selenoidImage }),
                prepareDockerImages({ image: "browser", selenoidImage, platform: "linux/arm64" }),
            ]);

            assert.equal(results[0].status, "fulfilled");
            assert.equal(results[1].status, "rejected");
            assert.include((results[1] as PromiseRejectedResult).reason.message, 'expected "linux/arm64"');
        });

        it("should keep automatic Selenoid image validation separate from an explicit platform", async () => {
            command.withArgs(daemonPlatformCommand).resolves("linux/arm64");
            command
                .withArgs(["image", "inspect", "--format", imagePlatform, "--", selenoidImage])
                .resolves("linux/arm64");

            const results = await Promise.allSettled([
                prepareDockerImages({ image: "browser", selenoidImage }),
                prepareDockerImages({ image: "browser", selenoidImage, selenoidPlatform: "linux/amd64" }),
            ]);

            assert.equal(results[0].status, "fulfilled");
            assert.equal(results[1].status, "rejected");
            assert.include((results[1] as PromiseRejectedResult).reason.message, 'expected "linux/amd64"');
        });

        it("should reject conflicting controller platforms before preparing images", async () => {
            await assert.isRejected(
                SelenoidDockerController.create([
                    makeConfig("first", { image: "browser", selenoidImage }),
                    makeConfig("second", { image: "browser", selenoidImage, selenoidPlatform: "linux/arm64" }),
                ]),
                "same docker.selenoidPlatform",
            );
            assert.notCalled(command);
        });

        it("should reject a conflicting controller platform when adding a standalone browser", async () => {
            const driver = await start("browser");
            command.resetHistory();
            await assert.isRejected(
                driver.ensureBrowser(
                    makeConfig("second", { image: "browser", selenoidImage, selenoidPlatform: "linux/arm64" }),
                ),
                "same docker.selenoidPlatform",
            );
            assert.notCalled(command);
            await driver[Symbol.asyncDispose]();
        });
    });

    describe("socket path", () => {
        it("should mount a custom daemon socket at Selenoid's default socket path", async () => {
            const socketPath = "/run/user/1000/podman/podman.sock";
            const driver = await start("browser", {}, { socketPath });
            const args = command.getCalls().find(call => call.args[0][0] === "create")!.args[0];
            assert.equal(args[args.indexOf("--volume") + 1], `${socketPath}:/var/run/docker.sock`);
            assert.notProperty(JSON.parse(writeConfig.firstCall.args[1]).chrome.versions["98.0"], "socketPath");
            await driver[Symbol.asyncDispose]();
        });

        for (const socketPath of [
            null,
            "",
            "/",
            "relative.sock",
            "unix:///run/docker.sock",
            "/run/docker.sock:ro",
            "/run/\n.sock",
            123,
        ]) {
            it(`should reject an invalid socket path: ${JSON.stringify(socketPath)}`, async () => {
                await assert.isRejected(start("browser", {}, { socketPath } as DockerConfig), "docker.socketPath");
                assert.notCalled(command);
            });
        }

        it("should reject conflicting socket paths before preparing images", async () => {
            await assert.isRejected(
                SelenoidDockerController.create([
                    makeConfig("first", { image: "browser", selenoidImage }),
                    makeConfig("second", { image: "browser", selenoidImage, socketPath: "/run/podman/podman.sock" }),
                ]),
                "same docker.socketPath",
            );
            assert.notCalled(command);
        });

        it("should accept an explicit default socket path in a shared controller", async () => {
            const driver = await SelenoidDockerController.create([
                makeConfig("first", { image: "browser", selenoidImage }),
                makeConfig("second", { image: "browser", selenoidImage, socketPath: "/var/run/docker.sock" }),
            ]);
            await driver[Symbol.asyncDispose]();
        });

        it("should reject a conflicting socket when adding a standalone browser", async () => {
            const driver = await start("browser");
            command.resetHistory();
            await assert.isRejected(
                driver.ensureBrowser(
                    makeConfig("second", { image: "browser", selenoidImage, socketPath: "/run/podman/podman.sock" }),
                ),
                "same docker.socketPath",
            );
            assert.notCalled(command);
            await driver[Symbol.asyncDispose]();
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
        await driver[Symbol.asyncDispose]();
    });

    for (const options of ['["name=seccomp"]', "[]", "null"]) {
        it(`should keep controller security defaults without SELinux (${options})`, async () => {
            command.withArgs(["info", "--format", "{{json .SecurityOptions}}"]).resolves(options);
            const driver = await start("browser");
            const args = command.getCalls().find(call => call.args[0][0] === "create")!.args[0];
            assert.notInclude(args, "--security-opt");
            await driver[Symbol.asyncDispose]();
        });
    }

    it("should configure the browser image and start Selenoid with an isolated network and Docker socket", async () => {
        const driver = await start("registry/browser:1");
        const args = command.getCalls().find(call => call.args[0][0] === "create")!.args[0];
        const name = args[2];

        assert.deepEqual(args.slice(0, 2), ["create", "--name"]);
        assert.match(name, /^testplane-/);
        assert.calledWith(command, ["network", "create", "--ipv6", `${name}-network`]);
        assert.deepEqual(args.slice(3), [
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
            "2147483647",
            "-retry-count",
            "1",
            "-log-output-dir",
            "/opt/selenoid/logs",
            "-save-all-logs",
            "-disable-privileged",
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
                        labels: { "testplane.controller": name },
                    },
                },
            },
        });
        assert.calledWith(command, ["cp", "/tmp/testplane-selenoid-test/browsers.json", `${name}:/browsers.json`]);
        assert.calledWith(command, ["start", name]);
        assert.equal(driver.gridUrl, "http://127.0.0.1:12345/wd/hub");
        assert.calledWith(fetchStub, "http://127.0.0.1:12345/status");
        await driver[Symbol.asyncDispose]();
        assert.calledOnce(removeConfig);
    });

    for (const missingNetwork of ["network does-not-exist not found", "no such network does-not-exist"]) {
        it(`should log and fall back to IPv4 when dual-stack creation fails and the network is missing (${missingNetwork})`, async () => {
            const dualStack = command.withArgs(sinon.match.array.startsWith(["network", "create", "--ipv6"]));
            dualStack.rejects(new Error("IPv6 is unavailable"));
            const inspect = command.withArgs(sinon.match.array.startsWith(["network", "inspect"]));
            inspect.rejects(new Error(missingNetwork));

            const driver = await start("browser");
            const network = dualStack.firstCall.args[0][3];
            const ipv4 = command.withArgs(["network", "create", network]);
            assert.calledOnce(ipv4);
            assert.calledOnce(debugStub);
            assert.calledWithMatch(debugStub, "falling back to IPv4. Error: IPv6 is unavailable");
            assert.callOrder(dualStack, inspect, debugStub, ipv4);
            await driver[Symbol.asyncDispose]();
            assert.calledWith(command, ["network", "rm", network]);
        });
    }

    it("should reuse the network if creation timed out after the engine created it", async () => {
        const dualStack = command.withArgs(sinon.match.array.startsWith(["network", "create", "--ipv6"]));
        dualStack.rejects(new Error("network creation timed out"));
        const inspect = command.withArgs(sinon.match.array.startsWith(["network", "inspect"]));
        inspect.resolves('[{"Name":"existing-network","EnableIPv6":true}]');

        const driver = await start("browser");
        const network = dualStack.firstCall.args[0][3];
        assert.calledWith(inspect, ["network", "inspect", network]);
        assert.equal(
            command.getCalls().filter(call => call.args[0].slice(0, 2).join(" ") === "network create").length,
            1,
        );
        assert.notCalled(warnStub);
        await driver[Symbol.asyncDispose]();
    });

    it("should stop if it cannot determine whether the network was created", async () => {
        const dualStack = command.withArgs(sinon.match.array.startsWith(["network", "create", "--ipv6"]));
        dualStack.rejects(new Error("network creation timed out"));
        command
            .withArgs(sinon.match.array.startsWith(["network", "inspect"]))
            .rejects(new Error("network inspection permission denied"));

        await assert.isRejected(start("browser"), "network inspection permission denied");
        const network = dualStack.firstCall.args[0][3];
        assert.neverCalledWith(command, ["network", "create", network]);
        assert.isFalse(command.getCalls().some(call => call.args[0][0] === "create"));
    });

    it("should propagate an IPv4 fallback failure without starting Selenoid", async () => {
        command.withArgs(sinon.match.array.startsWith(["network", "inspect"])).rejects(new Error("no such network"));
        command.withArgs(sinon.match.array.startsWith(["network", "create"])).callsFake(async (args: string[]) => {
            throw new Error(args.includes("--ipv6") ? "IPv6 is unavailable" : "IPv4 creation failed");
        });

        await assert.isRejected(start("browser"), "IPv4 creation failed");
        assert.calledOnce(debugStub);
        assert.isFalse(command.getCalls().some(call => call.args[0][0] === "create"));
    });

    it("should rely on Podman host resolution without injecting host-gateway", async () => {
        command
            .withArgs(["version", "--format", "{{json .Server.Components}}"])
            .resolves('[{"Name":"Podman Engine"},{"Name":"Engine"}]');
        const driver = await start("browser");
        const config = JSON.parse(writeConfig.firstCall.args[1]);
        assert.deepEqual(config.chrome.versions["98.0"].hosts, []);
        assert.calledWith(command, ["network", "create", "--ipv6", sinon.match.string]);
        await driver[Symbol.asyncDispose]();
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
        await driver[Symbol.asyncDispose]();
    });

    it("should use Docker's own container marker on Docker", async () => {
        const driver = await start("browser");
        assert.isFalse(
            command.getCalls().some(call => call.args[0].some((arg: string) => arg.endsWith("/.dockerenv"))),
        );
        await driver[Symbol.asyncDispose]();
    });

    it("should preserve explicit host mappings on Podman", async () => {
        command.withArgs(["version", "--format", "{{json .Server.Components}}"]).resolves('[{"Name":"Podman Engine"}]');
        const hosts = ["app:192.0.2.1", "host.docker.internal:192.0.2.2"];
        const driver = await start("browser", {}, { hosts });
        const config = JSON.parse(writeConfig.firstCall.args[1]);
        assert.deepEqual(config.chrome.versions["98.0"].hosts, hosts);
        await driver[Symbol.asyncDispose]();
    });

    describe("native rootless Podman networking", () => {
        let platformStub: SinonStub;

        beforeEach(() => {
            platformStub = sandbox.stub(process, "platform").value("linux");
            command
                .withArgs(["version", "--format", "{{json .Server.Components}}"])
                .resolves('[{"Name":"Podman Engine"}]');
            command.withArgs(["info", "--format", "{{json .SecurityOptions}}"]).resolves('["name=rootless"]');
        });

        it("should reach independent slirp browsers through host ports without preparing a bridge", async () => {
            const driver = await start("browser", {}, { labels: { team: "tests" } });
            const args = command.getCalls().find(call => call.args[0][0] === "create")!.args[0];
            const name = args[2];

            assert.calledOnceWith(getPortStub, { host: "127.0.0.1" });
            assert.equal(args[args.indexOf("--network") + 1], "host");
            assert.equal(args[args.indexOf("-container-network") + 1], "slirp4netns:enable_ipv6=true");
            assert.equal(args[args.indexOf("-listen") + 1], "127.0.0.1:12346");
            assert.include(args, "/var/run/docker.sock:/var/run/docker.sock");
            assert.notInclude(args, "--publish");
            assert.isFalse(command.getCalls().some(call => call.args[0][0] === "network"));
            assert.isFalse(command.getCalls().some(call => call.args[0].includes(`${name}:/.dockerenv`)));
            assert.neverCalledWith(command, ["inspect", "--format", "{{json .NetworkSettings.Ports}}", name]);
            assert.deepEqual(JSON.parse(writeConfig.firstCall.args[1]).chrome.versions["98.0"].labels, {
                team: "tests",
                "testplane.controller": name,
            });
            assert.equal(driver.gridUrl, "http://127.0.0.1:12346/wd/hub");
            assert.calledWith(fetchStub, "http://127.0.0.1:12346/status");
            await driver[Symbol.asyncDispose]();
            assert.isFalse(command.getCalls().some(call => call.args[0][0] === "network"));
        });

        for (const platform of ["darwin", "win32"]) {
            it(`should preserve bridge networking and VM port forwarding on ${platform}`, async () => {
                platformStub.value(platform);
                const driver = await start("browser");
                const args = command.getCalls().find(call => call.args[0][0] === "create")!.args[0];
                const name = args[2];
                assert.calledWith(command, ["network", "create", "--ipv6", `${name}-network`]);
                assert.equal(args[args.indexOf("--network") + 1], `${name}-network`);
                assert.include(args, "--publish");
                assert.calledWith(command, ["cp", "/tmp/testplane-selenoid-test/.dockerenv", `${name}:/.dockerenv`]);
                assert.equal(driver.gridUrl, "http://127.0.0.1:12345/wd/hub");
                assert.notCalled(getPortStub);
                await driver[Symbol.asyncDispose]();
            });
        }

        it("should preserve bridge networking for rootful Podman", async () => {
            command.withArgs(["info", "--format", "{{json .SecurityOptions}}"]).resolves('["name=seccomp"]');
            const driver = await start("browser");
            assert.calledWith(command, ["network", "create", "--ipv6", sinon.match.string]);
            assert.notCalled(getPortStub);
            await driver[Symbol.asyncDispose]();
        });

        it("should preserve bridge networking for rootless Docker", async () => {
            command.withArgs(["version", "--format", "{{json .Server.Components}}"]).resolves('[{"Name":"Engine"}]');
            const driver = await start("browser");
            assert.calledWith(command, ["network", "create", "--ipv6", sinon.match.string]);
            assert.notCalled(getPortStub);
            await driver[Symbol.asyncDispose]();
        });

        it("should remove only browsers owned by the controller after stopping it", async () => {
            const driver = await start("browser");
            const name = command.getCalls().find(call => call.args[0][0] === "create")!.args[0][2];
            const children = command.withArgs([
                "ps",
                "--all",
                "--quiet",
                "--filter",
                `label=testplane.controller=${name}`,
            ]);
            children.resolves("owned-browser");

            await Promise.all([driver[Symbol.asyncDispose](), driver[Symbol.asyncDispose]()]);

            assert.callOrder(
                command.withArgs(["rm", "--force", name]),
                children,
                command.withArgs(["rm", "--force", "owned-browser"]),
            );
            assert.calledOnce(children);
            assert.isFalse(command.getCalls().some(call => call.args[0][0] === "network"));
        });

        it("should keep synchronous exit cleanup scoped to the controller", async () => {
            await start("browser");
            const name = command.getCalls().find(call => call.args[0][0] === "create")!.args[0][2];
            const children = ["ps", "--all", "--quiet", "--filter", `label=testplane.controller=${name}`];
            syncCommand.withArgs("docker", children).returns("owned-browser");

            exitHandlers[0]();

            assert.calledWith(syncCommand, "docker", children);
            assert.calledWith(syncCommand, "docker", ["rm", "--force", "owned-browser"]);
            assert.isFalse(syncCommand.getCalls().some(call => call.args[1][0] === "network"));
        });

        it("should label browsers added later without mutating their configuration", async () => {
            const controller = await start("browser");
            const name = command.getCalls().find(call => call.args[0][0] === "create")!.args[0][2];
            const labels = { team: "tests" };
            fetchStub.resolves({ ok: true, json: async () => ({ browsers: { firefox: { added: {} } } }) });

            await controller.ensureBrowser(
                makeConfig(
                    "firefox",
                    { image: "firefox", selenoidImage, labels },
                    { browserName: "firefox", browserVersion: "added" },
                ),
            );

            assert.deepEqual(JSON.parse(writeConfig.lastCall.args[1]).firefox.versions.added.labels, {
                team: "tests",
                "testplane.controller": name,
            });
            assert.deepEqual(labels, { team: "tests" });
            await controller[Symbol.asyncDispose]();
        });

        it("should clean up startup failures without touching any shared networks", async () => {
            command.withArgs(sinon.match.array.startsWith(["start"])).rejects(new Error("controller failed"));
            await assert.isRejected(start("browser"), "controller failed");
            assert.calledWith(command, ["rm", "--force", sinon.match(/^testplane-/)]);
            assert.isFalse(command.getCalls().some(call => call.args[0][0] === "network"));
            assert.calledOnce(removeConfig);
        });
    });

    it("should use a custom Selenoid image without passing it to browsers.json", async () => {
        const customImage = "registry/selenoid:custom";
        command
            .withArgs([
                "image",
                "inspect",
                "--format",
                "{{.Os}}/{{.Architecture}}{{if .Variant}}/{{.Variant}}{{end}}",
                "--",
                customImage,
            ])
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
        await driver[Symbol.asyncDispose]();
    });

    it("should route Firefox sessions through /wd/hub inside the browser container", async () => {
        const driver = await start(
            "registry.example.com/selenium/firefox:148.0",
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
            await driver[Symbol.asyncDispose]();
        }
    });

    it("should explain how to fix a missing Docker executable", async () => {
        command
            .withArgs(sinon.match.array.startsWith(["info"]))
            .rejects(Object.assign(new Error("spawn docker ENOENT"), { code: "ENOENT" }));
        await assert.isRejected(start("browser"), "spawn docker ENOENT");
    });

    it("should distinguish an unavailable daemon from a missing image", async () => {
        command
            .withArgs(sinon.match.array.startsWith(["info"]))
            .rejects(new Error("Cannot connect to the Docker daemon"));
        await assert.isRejected(start("browser"), "Cannot connect to the Docker daemon");
    });

    it("should pull a missing image for amd64 and then start it", async () => {
        command
            .withArgs(sinon.match.array.startsWith(["image", "inspect"]))
            .onFirstCall()
            .rejects(new Error("No such image: browser"));
        const driver = await start("browser");
        assert.calledWith(command, ["pull", "--platform", "linux/amd64", "--quiet", "browser"]);
        assert.equal(command.getCalls().filter(call => call.args[0][0] === "image").length, 3);
        await driver[Symbol.asyncDispose]();
    });

    it("should not pull an image already available locally", async () => {
        const driver = await start("browser");
        assert.isFalse(command.getCalls().some(call => call.args[0][0] === "pull"));
        assert.isFalse(command.getCalls().some(call => call.args[0][0] === "manifest"));
        await driver[Symbol.asyncDispose]();
    });

    it("should share the platform selection and fallback pull between parallel sessions", async () => {
        command.withArgs(daemonPlatformCommand).resolves("linux/arm64");
        command
            .withArgs(["manifest", "inspect", "--verbose", "browser"])
            .resolves(JSON.stringify({ Descriptor: { platform: { os: "linux", architecture: "amd64" } } }));
        command
            .withArgs(sinon.match.array.startsWith(["image", "inspect"]))
            .onFirstCall()
            .rejects(new Error("No such image: browser"));
        const drivers = await Promise.all([start("browser"), start("browser")]);
        assert.equal(command.getCalls().filter(call => call.args[0][0] === "pull").length, 1);
        assert.equal(command.getCalls().filter(call => call.args[0][0] === "manifest").length, 1);
        assert.calledWith(command, ["pull", "--platform", "linux/amd64", "--quiet", "browser"]);
        assert.calledOnce(warnStub);
        await Promise.all(drivers.map(driver => driver[Symbol.asyncDispose]()));
    });

    it("should report registry errors and allow retrying a failed pull", async () => {
        command
            .withArgs(sinon.match.array.startsWith(["image", "inspect"]))
            .onFirstCall()
            .rejects(new Error("No such image: browser"));
        command.withArgs(sinon.match.array.startsWith(["pull"])).rejects(new Error("pull access denied"));
        await assert.isRejected(start("browser"), "pull access denied");
        assert.isFalse(command.getCalls().some(call => call.args[0][0] === "create"));
        const driver = await start("browser");
        await driver[Symbol.asyncDispose]();
    });

    it("should verify the platform after pulling", async () => {
        const inspect = command.withArgs(sinon.match.array.startsWith(["image", "inspect"]));
        inspect.onFirstCall().rejects(new Error("No such image: browser"));
        inspect.onSecondCall().resolves("linux/arm64");
        await assert.isRejected(start("browser"), 'targets "linux/arm64"; expected "linux/amd64"');
    });

    it("should preserve unexpected image inspection errors", async () => {
        command.withArgs(sinon.match.array.startsWith(["image", "inspect"])).rejects(new Error("permission denied"));
        await assert.isRejected(start("browser"), "permission denied");
    });

    it("should reject images for a different architecture", async () => {
        command.withArgs(sinon.match.array.startsWith(["image", "inspect"])).resolves("linux/arm64");
        await assert.isRejected(start("browser"), 'targets "linux/arm64"; expected "linux/amd64"');
    });

    it("should remove the container only once on concurrent disposal", async () => {
        const driver = await start("browser");
        await Promise.all([driver[Symbol.asyncDispose](), driver[Symbol.asyncDispose]()]);
        assert.equal(command.getCalls().filter(call => call.args[0][0] === "rm").length, 1);
        assert.calledWith(process.off as SinonStub, "exit", exitHandlers[0]);
    });

    it("should clean up synchronously if the process exits", async () => {
        await start("browser");
        exitHandlers[0]();
        assert.calledWith(syncCommand, "docker", ["rm", "--force", sinon.match(/^testplane-/)]);
    });

    for (const onFail of [false, true]) {
        it(`should preserve a retained controller on CLI exit (onFail=${onFail})`, async () => {
            sandbox.stub(RuntimeConfig, "getInstance").returns({ keepBrowserMode: { enabled: true, onFail } });
            await start("browser");

            exitHandlers[0]();

            assert.notCalled(syncCommand);
            assert.notCalled(removeConfig);
        });
    }

    it("should use distinct names for independently owned controllers", async () => {
        const drivers = await Promise.all([start("browser"), start("browser")]);
        const runs = command.getCalls().filter(call => call.args[0][0] === "create");
        assert.notEqual(runs[0].args[0][2], runs[1].args[0][2]);
        await Promise.all(drivers.map(driver => driver[Symbol.asyncDispose]()));
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
        await driver[Symbol.asyncDispose]();
    });

    it("should remove leftover browser containers before removing the isolated network", async () => {
        const driver = await start("browser");
        command.withArgs(sinon.match.array.startsWith(["ps"])).resolves("child-one\nchild-two");
        await driver[Symbol.asyncDispose]();
        assert.calledWith(command, ["rm", "--force", "child-one", "child-two"]);
        assert.calledWith(command, ["network", "rm", sinon.match(/^testplane-.*-network$/)]);
    });

    it("should expose controller logs before cleanup when session creation fails", async () => {
        const driver = await start("browser");
        assert.equal(await driver.getLogs(), "stderr logs");
        await driver[Symbol.asyncDispose]();
    });

    describe("session logs", () => {
        const logResponse = (): { ok: boolean; body: ReturnType<typeof Readable.toWeb> } => ({
            ok: true,
            body: Readable.toWeb(Readable.from([Buffer.from("browser output")])),
        });

        it("should stream Selenoid logs to a session file outside the temporary config directory", async () => {
            const controller = await start("browser");
            fetchStub.resolves(logResponse());

            const file = await controller.saveSessionLogs("session/id");

            assert.equal(file, path.join(tmpdir(), "testplane-logs", "session%2Fid.log"));
            assert.calledWith(fetchStub, "http://127.0.0.1:12345/logs/session%2Fid.log");
            assert.calledOnceWith(writeStream, file, { mode: 0o600 });
            assert.equal(Buffer.concat(logChunks).toString(), "browser output");
            await controller[Symbol.asyncDispose]();
            assert.calledOnceWith(removeConfig, "/tmp/testplane-selenoid-test", { recursive: true, force: true });
        });

        it("should request a custom Selenoid log name but save it under the session ID", async () => {
            const controller = await start("browser");
            fetchStub.resolves(logResponse());

            const file = await controller.saveSessionLogs("session-id", "custom name.log");

            assert.calledWith(fetchStub, "http://127.0.0.1:12345/logs/custom%20name.log");
            assert.equal(file, path.join(tmpdir(), "testplane-logs", "session-id.log"));
        });

        it("should retry while Selenoid is finishing the session log", async () => {
            const controller = await start("browser");
            fetchStub.resetHistory();
            const cancel = sandbox.stub().resolves();
            fetchStub.onFirstCall().resolves({ ok: false, status: 404, body: { cancel } });
            fetchStub.onSecondCall().resolves(logResponse());

            await controller.saveSessionLogs("session-id");

            assert.calledTwice(fetchStub);
            assert.calledOnce(cancel);
            assert.equal(Buffer.concat(logChunks).toString(), "browser output");
        });

        it("should propagate non-404 errors and release the response body", async () => {
            const controller = await start("browser");
            fetchStub.resetHistory();
            const cancel = sandbox.stub().resolves();
            fetchStub.resolves({ ok: false, status: 500, body: { cancel } });

            await assert.isRejected(controller.saveSessionLogs("session-id"), "HTTP 500");

            assert.calledOnce(fetchStub);
            assert.calledOnce(cancel);
            assert.notCalled(writeStream);
        });
    });

    it("should use the configured image as the default when no version is specified", async () => {
        const driver = await start("browser", { browserVersion: undefined });
        const config = JSON.parse(writeConfig.firstCall.args[1]);
        assert.equal(config.chrome.default, "default");
        assert.equal(config.chrome.versions.default.image, "browser");
        await driver[Symbol.asyncDispose]();
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
            assert.match(config.appium.versions["98.0"], {
                image: "browser",
                ...container,
                labels: { "testplane.controller": sinon.match.string },
            });
            assert.equal(driver.gridUrl, "http://127.0.0.1:12345/wd/hub");
        } finally {
            await driver[Symbol.asyncDispose]();
        }
    });

    for (const browserName of ["chrome", "yandex", "Chrome", "Yandex"]) {
        it(`should give Selenoid the prepared image for "${browserName}"`, async () => {
            prepareImage.resolves("testplane-browser:prepared");
            const driver = await start("browser", { browserName });
            const config = JSON.parse(writeConfig.firstCall.args[1]);
            assert.calledOnce(prepareImage);
            assert.equal(config[browserName].versions["98.0"].image, "testplane-browser:prepared");
            await driver[Symbol.asyncDispose]();
        });
    }

    for (const browserName of ["firefox", "MicrosoftEdge", "opera", "android", ""]) {
        it(`should use the original image without devtools preparation for "${browserName}"`, async () => {
            prepareImage.rejects(new Error("Image preparation must not run"));
            const driver = await start("original-browser:1", { browserName });
            const config = JSON.parse(writeConfig.firstCall.args[1]);
            assert.notCalled(prepareImage);
            assert.equal(config[browserName].versions["98.0"].image, "original-browser:1");
            await driver[Symbol.asyncDispose]();
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
            await driver.prepareCdp("session-id", "session-label", 50);
            assert.calledWith(fetchStub, "http://127.0.0.1:12345/devtools/session-id/json/protocol");
            assert.lengthOf(
                command.getCalls().filter(call => call.args[0][0] === "create"),
                1,
            );
            assert.isFalse(command.getCalls().some(call => call.args[0][0] === "exec"));
            assert.calledOnce(prepareImage);
            await driver[Symbol.asyncDispose]();
        });

        it("should check adapter presence before waiting for its native route", async () => {
            const driver = await start("browser");
            fetchStub.resetHistory();
            fetchStub.resolves({ ok: true, json: async () => ({ domains: [] }) });
            fetchStub.onFirstCall().rejects(new Error("CDP unavailable"));
            command.withArgs(sinon.match.array.startsWith(["ps", "--quiet"])).resolves("browser-id");
            await driver.prepareCdp("session-id", "session-label", 50);
            assert.calledOnce(prepareImage);
            assert.isTrue(command.getCalls().some(call => call.args[0][0] === "exec"));
            assert.lengthOf(
                command.getCalls().filter(call => call.args[0][0] === "create"),
                1,
            );
            assert.lengthOf(
                command.getCalls().filter(call => call.args[0][0] === "image"),
                2,
            );
            await driver[Symbol.asyncDispose]();
        });

        it("should skip waiting when the browser image has no adapter", async () => {
            const driver = await start("browser");
            fetchStub.resetHistory();
            fetchStub.rejects(new Error("CDP unavailable"));
            command.withArgs(sinon.match.array.startsWith(["ps", "--quiet"])).resolves("browser-id");
            command.withArgs(sinon.match.array.startsWith(["exec"])).resolves("absent\n");
            assert.isFalse(await driver.prepareCdp("session-id", "session-label", 50));
            assert.calledOnce(fetchStub);
            assert.calledWith(debugStub, sinon.match("continuing without CDP"));
            await driver[Symbol.asyncDispose]();
        });

        it("should propagate adapter inspection failures", async () => {
            const driver = await start("browser");
            fetchStub.rejects(new Error("CDP unavailable"));
            command.withArgs(sinon.match.array.startsWith(["ps", "--quiet"])).resolves("browser-id");
            command.withArgs(sinon.match.array.startsWith(["exec"])).rejects(new Error("exec failed"));
            await assert.isRejected(driver.prepareCdp("session-id", "session-label", 50), "exec failed");
            await driver[Symbol.asyncDispose]();
        });

        it("should fail if the browser exits before CDP is ready", async () => {
            const driver = await start("browser");
            fetchStub.rejects(new Error("CDP unavailable"));
            command.withArgs(sinon.match.array.startsWith(["ps", "--quiet"])).resolves("browser-id");
            command.withArgs(["inspect", "--format", "{{.State.Running}}", "browser-id"]).resolves("false");
            await assert.isRejected(driver.prepareCdp("session-id", "session-label", 50), "browser container exited");
            await driver[Symbol.asyncDispose]();
        });

        it("should time out if CDP never becomes ready", async () => {
            const driver = await start("browser", { timeout: 10 });
            fetchStub.rejects(new Error("CDP unavailable"));
            command.withArgs(sinon.match.array.startsWith(["ps", "--quiet"])).resolves("browser-id");
            await assert.isRejected(
                driver.prepareCdp("session-id", "session-label", 50),
                "CDP adapter did not become ready",
            );
            await driver[Symbol.asyncDispose]();
        });
    });

    it("should pull a missing Selenoid image too", async () => {
        command
            .withArgs([
                "image",
                "inspect",
                "--format",
                "{{.Os}}/{{.Architecture}}{{if .Variant}}/{{.Variant}}{{end}}",
                "--",
                selenoidImage,
            ])
            .onFirstCall()
            .rejects(new Error("No such image"));
        const driver = await start("browser");
        assert.calledWith(command, ["pull", "--platform", "linux/amd64", "--quiet", selenoidImage]);
        await driver[Symbol.asyncDispose]();
    });

    it("should retain synchronous exit cleanup after a removal failure", async () => {
        sandbox.stub(RuntimeConfig, "getInstance").returns({ keepBrowserMode: { enabled: true, onFail: false } });
        const driver = await start("browser");
        const rm = command.withArgs(sinon.match.array.startsWith(["rm"]));
        rm.onFirstCall().rejects(new Error("daemon unavailable"));
        await assert.isRejected(driver[Symbol.asyncDispose](), "daemon unavailable");
        assert.neverCalledWith(process.off as SinonStub, "exit", exitHandlers[0]);
        assert.calledWith(command, ["network", "rm", sinon.match.string]);
        assert.calledOnce(removeConfig);

        exitHandlers[0]();

        const name = command.getCalls().find(call => call.args[0][0] === "create")!.args[0][2];
        assert.calledWith(syncCommand, "docker", ["rm", "--force", name]);
    });
});
