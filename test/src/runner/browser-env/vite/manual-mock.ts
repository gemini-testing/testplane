import path from "node:path";
import fs from "node:fs/promises";
import sinon, { SinonStub } from "sinon";

import type { Stats } from "node:fs";
import { ManualMock } from "../../../../../src/runner/browser-env/vite/manual-mock";
import { DEFAULT_AUTOMOCK_DIRECTORY } from "../../../../../src/runner/browser-env/vite/constants";

type ManualMockTestData = {
    name: string;
    opts?: { automock: boolean };
    cb: (manualMock: ManualMock, moduleName?: string) => void;
};

describe("runner/browser-env/vite/manual-mock", () => {
    const sandbox = sinon.createSandbox();

    beforeEach(() => {
        sandbox.stub(fs, "access").resolves();
        sandbox.stub(fs, "readdir").resolves([]);
        sandbox.stub(fs, "stat").resolves({ isDirectory: () => false } as Stats);
    });

    afterEach(() => sandbox.restore());

    describe("'resolveId' method", () => {
        const mockModuleName = "mock-module";

        (
            [
                {
                    name: "automock enabled",
                    opts: { automock: true },
                    cb: (): void => {},
                },
                {
                    name: "mock by user",
                    cb: (manualMock: ManualMock, moduleName: string = mockModuleName): void => {
                        manualMock.mock(moduleName);
                    },
                },
            ] as ManualMockTestData[]
        ).forEach(({ name, opts, cb }) => {
            describe(name, () => {
                describe("should not resolve if", () => {
                    it("automock directory is not exists", async () => {
                        const automockDir = path.resolve(DEFAULT_AUTOMOCK_DIRECTORY);
                        (fs.access as SinonStub).withArgs(automockDir).rejects(new Error("ENOENT"));

                        const manualMock = await ManualMock.create({}, opts);
                        cb(manualMock);
                        const resolvedId = await manualMock.resolveId(mockModuleName);

                        assert.isUndefined(resolvedId);
                    });

                    it("files are not exist in automock directory", async () => {
                        const automockDir = path.resolve(DEFAULT_AUTOMOCK_DIRECTORY);
                        (fs.access as SinonStub).withArgs(automockDir).resolves();
                        (fs.readdir as SinonStub).withArgs(automockDir).resolves([]);

                        const manualMock = await ManualMock.create({}, opts);
                        cb(manualMock);
                        const resolvedId = await manualMock.resolveId(mockModuleName);

                        assert.isUndefined(resolvedId);
                    });

                    it("only directories exist in automock directory", async () => {
                        const automockDir = path.resolve(DEFAULT_AUTOMOCK_DIRECTORY);
                        const subDir = path.join(automockDir, "some-dir");

                        (fs.access as SinonStub).withArgs(automockDir).resolves();
                        (fs.readdir as SinonStub).withArgs(automockDir).resolves(["some-dir"]);

                        (fs.stat as SinonStub).withArgs(subDir).resolves({ isDirectory: () => true });
                        (fs.access as SinonStub).withArgs(subDir).resolves();
                        (fs.readdir as SinonStub).withArgs(subDir).resolves([]);

                        const manualMock = await ManualMock.create({}, opts);
                        cb(manualMock);
                        const resolvedId = await manualMock.resolveId(mockModuleName);

                        assert.isUndefined(resolvedId);
                    });

                    it("module umocked by user", async () => {
                        const automockDir = path.resolve(DEFAULT_AUTOMOCK_DIRECTORY);
                        const filePath = path.join(automockDir, `${mockModuleName}.js`);

                        (fs.access as SinonStub).withArgs(automockDir).resolves();
                        (fs.readdir as SinonStub).withArgs(automockDir).resolves([`${mockModuleName}.js`]);
                        (fs.stat as SinonStub).withArgs(filePath).resolves({ isDirectory: () => false });

                        const manualMock = await ManualMock.create({}, opts);
                        cb(manualMock);
                        manualMock.unmock(mockModuleName);
                        const resolvedId = await manualMock.resolveId(mockModuleName);

                        assert.isUndefined(resolvedId);
                    });
                });

                describe("should resolve if", () => {
                    it("mocked module exists in automock directory", async () => {
                        const automockDir = path.resolve(DEFAULT_AUTOMOCK_DIRECTORY);
                        const filePath = path.join(automockDir, `${mockModuleName}.js`);

                        (fs.access as SinonStub).withArgs(automockDir).resolves();
                        (fs.readdir as SinonStub).withArgs(automockDir).resolves([`${mockModuleName}.js`]);
                        (fs.stat as SinonStub).withArgs(filePath).resolves({ isDirectory: () => false });

                        const manualMock = await ManualMock.create({}, opts);
                        cb(manualMock);
                        const resolvedId = await manualMock.resolveId(mockModuleName);

                        assert.equal(resolvedId, filePath);
                    });

                    it("mocked module exists in subdirectory of automock directory", async () => {
                        const automockDir = path.resolve(DEFAULT_AUTOMOCK_DIRECTORY);
                        const subDir = path.join(automockDir, "@scope");
                        const filePath = path.join(subDir, `${mockModuleName}.js`);

                        (fs.access as SinonStub).withArgs(automockDir).resolves();
                        (fs.readdir as SinonStub).withArgs(automockDir).resolves(["@scope"]);
                        (fs.stat as SinonStub).withArgs(subDir).resolves({ isDirectory: () => true });

                        (fs.access as SinonStub).withArgs(subDir).resolves();
                        (fs.readdir as SinonStub).withArgs(subDir).resolves([`${mockModuleName}.js`]);
                        (fs.stat as SinonStub).withArgs(filePath).resolves({ isDirectory: () => false });

                        const manualMock = await ManualMock.create({}, opts);
                        cb(manualMock, `@scope/${mockModuleName}`);
                        const resolvedId = await manualMock.resolveId(`@scope/${mockModuleName}`);

                        assert.equal(resolvedId, filePath);
                    });
                });
            });
        });
    });
});
