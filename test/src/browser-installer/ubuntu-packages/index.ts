import proxyquire from "proxyquire";
import sinon, { type SinonStub } from "sinon";
import type {
    writeUbuntuPackageDependencies as WriteUbuntuPackageDependencies,
    installUbuntuPackageDependencies as InstallUbuntuPackageDependencies,
    getUbuntuLinkerEnv as GetUbuntuLinkerEnv,
} from "../../../../src/browser-installer/ubuntu-packages";

describe("browser-installer/ubuntu-packages", () => {
    const sandbox = sinon.createSandbox();

    let writeUbuntuPackageDependencies: typeof WriteUbuntuPackageDependencies;
    let installUbuntuPackageDependencies: typeof InstallUbuntuPackageDependencies;
    let getUbuntuLinkerEnv: typeof GetUbuntuLinkerEnv;

    let fsStub: Record<keyof typeof import("fs-extra"), SinonStub>;
    let loggerLogStub: SinonStub;
    let loggerWarnStub: SinonStub;
    let installUbuntuPackagesStub: SinonStub;
    let getUbuntuMilestoneStub: SinonStub;

    beforeEach(() => {
        fsStub = {
            readJSON: sinon.stub().resolves({}),
            existsSync: sinon.stub().returns(false),
            readdir: sinon.stub().resolves([]),
            stat: sinon.stub().resolves({ isDirectory: () => true }),
            outputJSON: sinon.stub().resolves({}),
        } as Record<keyof typeof import("fs-extra"), SinonStub>;

        loggerLogStub = sandbox.stub();
        loggerWarnStub = sandbox.stub();
        installUbuntuPackagesStub = sandbox.stub();
        getUbuntuMilestoneStub = sandbox.stub().resolves("20");

        const ubuntuPackages = proxyquire("../../../../src/browser-installer/ubuntu-packages", {
            "fs-extra": fsStub,
            "./apt": { installUbuntuPackages: installUbuntuPackagesStub },
            "./utils": { getUbuntuMilestone: getUbuntuMilestoneStub },
            "../../utils/logger": { log: loggerLogStub, warn: loggerWarnStub },
        });

        ({ writeUbuntuPackageDependencies, installUbuntuPackageDependencies, getUbuntuLinkerEnv } = ubuntuPackages);
    });

    afterEach(() => sandbox.restore());

    describe("writeUbuntuPackageDependencies", () => {
        it("should write sorted dependencies if file does not exist", async () => {
            getUbuntuMilestoneStub.resolves("20");
            fsStub.readJSON.withArgs(sinon.match("ubuntu-20-dependencies.json")).rejects(new Error("No such file"));

            await writeUbuntuPackageDependencies("20", ["b", "a", "c"]);

            assert.calledOnceWith(fsStub.outputJSON, sinon.match.string, ["a", "b", "c"]);
        });

        it("should write uniq sorted dependencies with existing deps from file", async () => {
            fsStub.readJSON.resolves(["a", "b", "d"]);

            await writeUbuntuPackageDependencies("20", ["e", "c", "d"]);

            assert.calledOnceWith(fsStub.outputJSON, sinon.match.string, ["a", "b", "c", "d", "e"]);
        });
    });

    describe("installUbuntuPackageDependencies", () => {
        it("should install deps for current milestone", async () => {
            getUbuntuMilestoneStub.resolves("20");
            fsStub.existsSync.withArgs(sinon.match("packages")).returns(false);
            fsStub.readJSON.withArgs(sinon.match("ubuntu-20-dependencies.json")).resolves(["foo", "bar"]);

            await installUbuntuPackageDependencies();

            assert.calledOnceWith(loggerLogStub, "Downloading extra deb packages to local browsers execution...");
            assert.calledOnceWith(installUbuntuPackagesStub, ["foo", "bar"], sinon.match("packages"));
        });

        it("should read dependencies and install packages only once per multiple function calls", async () => {
            getUbuntuMilestoneStub.resolves("20");
            fsStub.existsSync.withArgs(sinon.match("packages")).returns(false);
            fsStub.readJSON.withArgs(sinon.match("ubuntu-20-dependencies.json")).resolves(["foo", "bar"]);

            const promise1 = await installUbuntuPackageDependencies();
            const promise2 = await installUbuntuPackageDependencies();

            assert.equal(promise1, promise2);
            assert.calledOnce(fsStub.readJSON);
            assert.calledOnceWith(installUbuntuPackagesStub, ["foo", "bar"], sinon.match("packages"));
        });

        it("should skip installation if directory with packages exists", async () => {
            getUbuntuMilestoneStub.resolves("20");
            fsStub.existsSync.withArgs(sinon.match("packages")).returns(true);

            await installUbuntuPackageDependencies();

            assert.notCalled(fsStub.readJSON.withArgs(sinon.match("ubuntu-20-dependencies.json")));
            assert.notCalled(loggerLogStub);
            assert.notCalled(installUbuntuPackagesStub);
        });

        it("should log warning if current ubuntu version is not supported", async () => {
            getUbuntuMilestoneStub.resolves("100500");
            fsStub.readJSON.withArgs(sinon.match("ubuntu-100500-dependencies.json")).rejects(new Error("No such file"));

            await installUbuntuPackageDependencies();

            assert.calledOnceWith(
                loggerWarnStub,
                [
                    `Unable to read ubuntu dependencies for Ubuntu@100500, as this version currently not supported`,
                    `Assuming all necessary packages are installed already`,
                ].join("\n"),
            );
            assert.calledOnceWith(installUbuntuPackagesStub, []);
        });
    });

    describe("getUbuntuLinkerEnv", () => {
        beforeEach(() => {
            fsStub.existsSync.withArgs(sinon.match("packages")).returns(true);
            fsStub.readdir.withArgs(sinon.match("/lib")).resolves(["foo", "bar"]);
            fsStub.readdir.withArgs(sinon.match("/usr/lib")).resolves(["baz", "qux"]);
            fsStub.stat.resolves({ isDirectory: () => true });
        });

        it("should resolve ubuntu linker env", async () => {
            const env = await getUbuntuLinkerEnv();

            assert.match(env.LD_LIBRARY_PATH, "/packages/lib/foo");
            assert.match(env.LD_LIBRARY_PATH, "/packages/lib/bar");
            assert.match(env.LD_LIBRARY_PATH, "/packages/usr/lib/baz");
            assert.match(env.LD_LIBRARY_PATH, "/packages/usr/lib/qux");
        });

        it("should concat existing LD_LIBRARY_PATH", async () => {
            const envBack = process.env.LD_LIBRARY_PATH;
            process.env.LD_LIBRARY_PATH = "foo/bar/baz";

            const env = await getUbuntuLinkerEnv();

            process.env.LD_LIBRARY_PATH = envBack;
            assert.match(env.LD_LIBRARY_PATH, "foo/bar/baz");
        });

        it("should cache env value", async () => {
            await getUbuntuLinkerEnv();

            const existsSyncCallCount = fsStub.existsSync.callCount;
            const readDirCallCount = fsStub.readdir.callCount;
            const statCallCount = fsStub.stat.callCount;

            await getUbuntuLinkerEnv();
            await getUbuntuLinkerEnv();
            await getUbuntuLinkerEnv();

            assert.callCount(fsStub.existsSync, existsSyncCallCount);
            assert.callCount(fsStub.readdir, readDirCallCount);
            assert.callCount(fsStub.stat, statCallCount);
        });
    });
});
