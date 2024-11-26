import path from "path";
import { Command } from "@gemini-testing/commander";
import proxyquire from "proxyquire";
import sinon, { type SinonStub } from "sinon";
import { Testplane } from "../../../../../src/testplane";
import type { Writable } from "type-fest";
import type { Config } from "../../../../../src/config";

describe("cli/commands/install-deps", () => {
    const sandbox = sinon.createSandbox();

    let cli: { run: () => void };
    let loggerStub: { log: SinonStub; warn: SinonStub; error: SinonStub };
    let testplaneStub: Writable<Testplane>;
    let installBrowsersWithDriversStub: SinonStub;

    const installBrowsers_ = async (argv: string = ""): Promise<void> => {
        process.argv = ["foo/bar/node", "foo/bar/script", "install-deps", ...argv.split(" ")].filter(Boolean);
        cli.run();

        await (Command.prototype.action as SinonStub).lastCall.returnValue;
    };

    const mkBrowser_ = (browserName: string, browserVersion: string): Config["browsers"][string] =>
        ({
            desiredCapabilities: { browserName, browserVersion },
        } as Config["browsers"][string]);

    beforeEach(() => {
        loggerStub = { log: sandbox.stub(), warn: sandbox.stub(), error: sandbox.stub() };
        testplaneStub = Object.create(Testplane.prototype);

        Object.defineProperty(testplaneStub, "config", {
            value: { browsers: {} },
            writable: true,
            configurable: true,
        });

        sandbox.stub(Testplane, "create").returns(testplaneStub as Testplane);

        sandbox.stub(process, "exit");

        sandbox.spy(Command.prototype, "action");

        installBrowsersWithDriversStub = sandbox.stub();

        cli = proxyquire("../../../../../src/cli", {
            [path.resolve(process.cwd(), "src/cli/commands/install-deps")]: proxyquire(
                "../../../../../src/cli/commands/install-deps",
                {
                    "../../../browser-installer": {
                        installBrowsersWithDrivers: installBrowsersWithDriversStub,
                        BrowserInstallStatus: { Ok: "ok", Skip: "skip", Error: "error" },
                    },
                    "../../../utils/logger": loggerStub,
                },
            ),
        });
    });

    afterEach(() => sandbox.restore());

    it("should install listed browsers with versions", async () => {
        testplaneStub.config.browsers = {};

        await installBrowsers_("chrome@113 firefox@120 chrome@80");

        assert.calledWith(installBrowsersWithDriversStub, [
            { browserName: "chrome", browserVersion: "113" },
            { browserName: "firefox", browserVersion: "120" },
            { browserName: "chrome", browserVersion: "80" },
        ]);
    });

    it("should install browsers from config", async () => {
        testplaneStub.config.browsers = {
            "chrome@113": mkBrowser_("safari", "70"),
            "firefox@123": mkBrowser_("edge", "100"),
            "chrome@100": mkBrowser_("firefox", "120"),
            "chrome@80": mkBrowser_("firefox", "115"),
        };

        await installBrowsers_("chrome@113 firefox@123 chrome@80");

        assert.calledWith(installBrowsersWithDriversStub, [
            { browserName: "safari", browserVersion: "70" },
            { browserName: "edge", browserVersion: "100" },
            { browserName: "firefox", browserVersion: "115" },
        ]);
    });

    it("should install some browsers from config and others with browser name + versions", async () => {
        testplaneStub.config.browsers = {
            "my-chrome": mkBrowser_("chrome", "115"),
            firefox: mkBrowser_("firefox", "120"),
        };

        await installBrowsers_("my-chrome chrome@80");

        assert.calledWith(installBrowsersWithDriversStub, [
            { browserName: "chrome", browserVersion: "115" },
            { browserName: "chrome", browserVersion: "80" },
        ]);
    });

    it("should install all config browsers", async () => {
        testplaneStub.config.browsers = {
            safari: mkBrowser_("safari", "70"),
            edge: mkBrowser_("edge", "100"),
            "firefox-120": mkBrowser_("firefox", "120"),
            "firefox-115": mkBrowser_("firefox", "115"),
        };

        await installBrowsers_("");

        assert.calledWith(installBrowsersWithDriversStub, [
            { browserName: "safari", browserVersion: "70" },
            { browserName: "edge", browserVersion: "100" },
            { browserName: "firefox", browserVersion: "120" },
            { browserName: "firefox", browserVersion: "115" },
        ]);
    });

    describe("should log", () => {
        it("successfully installed browsers", async () => {
            installBrowsersWithDriversStub.resolves({ "chrome@110": { status: "ok" } });
            testplaneStub.config.browsers = {};

            await installBrowsers_("chrome@110");

            assert.calledOnceWithMatch(loggerStub.log, "These browsers are downloaded successfully:");
            assert.calledOnceWithMatch(loggerStub.log, "- chrome@110");
            assert.notCalled(loggerStub.warn);
            assert.notCalled(loggerStub.error);
        });

        it("skipped browsers", async () => {
            installBrowsersWithDriversStub.resolves({ "chrome@110": { status: "skip", reason: "some reason" } });
            testplaneStub.config.browsers = {};

            await installBrowsers_("chrome@110");

            assert.calledOnceWithMatch(loggerStub.warn, "Browser install for these browsers was skipped:");
            assert.calledOnceWithMatch(loggerStub.warn, "- chrome@110: some reason");
            assert.notCalled(loggerStub.log);
            assert.notCalled(loggerStub.error);
        });

        it("failed to install browsers", async () => {
            installBrowsersWithDriversStub.resolves({ "chrome@110": { status: "error", reason: "some reason" } });
            testplaneStub.config.browsers = {};

            await installBrowsers_("chrome@110");

            assert.calledOnceWithMatch(loggerStub.error, "An error occured while trying to download these browsers:");
            assert.calledOnceWithMatch(loggerStub.error, "- chrome@110: some reason");
            assert.notCalled(loggerStub.log);
            assert.notCalled(loggerStub.warn);
        });
    });
});
