import proxyquire from "proxyquire";
import sinon, { type SinonStub } from "sinon";
import { mkdtemp, readFile, readdir, rm } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import type { prepareDockerBrowserImage as Prepare } from "src/browser/docker-image";

describe("browser/docker-image", () => {
    const sandbox = sinon.createSandbox();
    let directory: string;
    let prepare: typeof Prepare;
    let docker: SinonStub;
    let build: SinonStub;
    let metadata: { Id: string; Config: { User: string } };
    let images: Set<string>;
    let recipes: string[];

    const load = (): typeof Prepare =>
        proxyquire("src/browser/docker-image", {
            os: { tmpdir: () => directory },
            "../utils/logger": { log: sandbox.stub(), warn: sandbox.stub() },
        }).prepareDockerBrowserImage;

    beforeEach(async () => {
        directory = await mkdtemp(path.join(tmpdir(), "testplane-image-test-"));
        metadata = { Id: `sha256:${"a".repeat(64)}`, Config: { User: "selenium:1200" } };
        images = new Set();
        recipes = [];
        build = sandbox.stub().resolves();
        docker = sandbox.stub().callsFake(async (args: string[]) => {
            if (args[0] === "build") {
                recipes.push(await readFile(path.join(args[args.length - 1], "Dockerfile"), "utf8"));
                await build();
                images.add(args[args.indexOf("--tag") + 1]);
            } else if (args[0] === "image" && args[1] === "inspect") {
                if (args.length === 3) return JSON.stringify([metadata]);
                if (!images.has(args[args.length - 1])) throw new Error("No such image");
                return "prepared-image-id";
            }
            return "";
        });
        prepare = load();
    });

    afterEach(async () => {
        sandbox.restore();
        await rm(directory, { recursive: true, force: true });
    });

    it("should build from the immutable source, unpack in place and preserve the image user and startup", async () => {
        const image = await prepare("chrome:latest", "session", docker);
        const base = image.replace("testplane-browser:", "testplane-browser-base:");
        assert.calledWith(docker, ["image", "tag", metadata.Id, base]);
        assert.match(recipes[0], new RegExp(`^FROM ${base}\nUSER 0\nRUN `));
        assert.include(recipes[0], "upx-ucl -d /usr/bin/devtools");
        assert.include(recipes[0], "apt-get update -qq");
        assert.include(recipes[0], "apt-get install -y --no-install-recommends upx-ucl");
        assert.include(recipes[0], "if [ -f /usr/bin/devtools ]");
        assert.include(recipes[0], "/usr/bin/devtools -help");
        assert.match(recipes[0], /USER selenium:1200\n$/);
        assert.notMatch(recipes[0], /^(ENTRYPOINT|CMD|ENV|SHELL) /m);
        assert.calledWith(
            docker,
            ["build", "--platform", "linux/amd64", "--pull=false", "--tag", image, sinon.match.string],
            { timeout: 600_000 },
        );
        assert.calledWith(docker, ["image", "rm", base]);
        assert.deepEqual(await readdir(directory), ["testplane-docker-image-locks"]);
        assert.deepEqual(await readdir(path.join(directory, "testplane-docker-image-locks")), []);
    });

    it("should reuse an existing image across invocations without building or running container commands", async () => {
        const first = await prepare("chrome:latest", "first", docker);
        docker.resetHistory();
        const second = await load()("chrome:latest", "second", docker);
        assert.equal(first, second);
        assert.calledOnce(build);
        assert.equal(docker.callCount, 2);
        assert.isTrue(docker.getCalls().every(call => call.args[0][1] === "inspect"));
    });

    it("should rebuild when the same source tag points to a new image", async () => {
        const first = await prepare("chrome:latest", "first", docker);
        metadata.Id = `sha256:${"b".repeat(64)}`;
        const second = await prepare("chrome:latest", "second", docker);
        assert.notEqual(first, second);
        assert.calledTwice(build);
    });

    it("should reuse the image for different tags with the same source ID", async () => {
        const first = await prepare("chrome:latest", "first", docker);
        const second = await prepare("chrome:149", "second", docker);
        assert.equal(first, second);
        assert.calledOnce(build);
    });

    it("should build only once for concurrent callers sharing the filesystem lock", async () => {
        const images = await Promise.all([
            prepare("chrome:latest", "first", docker),
            load()("chrome:latest", "second", docker),
        ]);
        assert.equal(images[0], images[1]);
        assert.calledOnce(build);
    });

    it("should rebuild a removed prepared image", async () => {
        const first = await prepare("chrome:latest", "first", docker);
        images.delete(first);
        assert.equal(await prepare("chrome:latest", "second", docker), first);
        assert.calledTwice(build);
    });

    it("should report build output, clean temporary files and release the lock for a retry", async () => {
        build
            .onFirstCall()
            .rejects(Object.assign(new Error("build failed"), { stderr: "apt error", stdout: "details" }));
        await assert.isRejected(prepare("chrome:latest", "first", docker), "build failed\ndetails\napt error");
        assert.equal(images.size, 0);
        assert.deepEqual(await readdir(directory), ["testplane-docker-image-locks"]);
        assert.deepEqual(await readdir(path.join(directory, "testplane-docker-image-locks")), []);
        await prepare("chrome:latest", "retry", docker);
        assert.calledTwice(build);
    });

    it("should propagate daemon errors instead of treating them as a missing image", async () => {
        docker
            .withArgs(sinon.match.array.startsWith(["image", "inspect", "--format"]))
            .rejects(new Error("daemon unavailable"));
        await assert.isRejected(prepare("chrome:latest", "session", docker), "daemon unavailable");
        assert.notCalled(build);
        assert.deepEqual(await readdir(directory), []);
    });

    it("should preserve the default root user", async () => {
        metadata.Config.User = "";
        await prepare("chrome:latest", "session", docker);
        assert.match(recipes[0], /USER 0\n$/);
    });
});
