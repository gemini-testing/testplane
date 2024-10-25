import path from "node:path";
import fs from "node:fs/promises";
import _ from "lodash";
import { DEFAULT_AUTOMOCK, DEFAULT_AUTOMOCK_DIRECTORY } from "./constants";

import type { InlineConfig } from "vite";
import type { BrowserTestRunEnvOptions } from "./types";

type MockOnFs = {
    fullPath: string;
    moduleName: string;
};

type ManualMockOptions = {
    automock: boolean;
    mocksOnFs: MockOnFs[];
};

export class ManualMock {
    private _automock: boolean;
    private _mocksOnFs: MockOnFs[];
    private _mocks: string[];
    private _unmocks: string[];

    static async create<T extends ManualMock>(
        this: new (opts: ManualMockOptions) => T,
        config: Partial<InlineConfig>,
        options?: BrowserTestRunEnvOptions,
    ): Promise<T> {
        const automock = typeof options?.automock === "boolean" ? options?.automock : DEFAULT_AUTOMOCK;
        const automockDir = path.resolve(config?.root || "", options?.automockDir || DEFAULT_AUTOMOCK_DIRECTORY);
        const mocksOnFs = await getMocksOnFs(automockDir);

        return new this({ automock, mocksOnFs });
    }

    constructor(options: ManualMockOptions) {
        this._automock = options.automock;
        this._mocksOnFs = options.mocksOnFs;
        this._mocks = [];
        this._unmocks = [];
    }

    async resolveId(id: string): Promise<string | void> {
        const foundMockOnFs = this._mocksOnFs.find(mock => id === mock.moduleName);

        if ((this._mocks.includes(id) || this._automock) && foundMockOnFs && !this._unmocks.includes(id)) {
            return foundMockOnFs.fullPath;
        }
    }

    mock(moduleName: string): void {
        this._mocks.push(moduleName);
    }

    unmock(moduleName: string): void {
        this._unmocks.push(moduleName);
    }

    resetMocks(): void {
        this._mocks = [];
        this._unmocks = [];
    }
}

async function getMocksOnFs(automockDir: string): Promise<{ fullPath: string; moduleName: string }[]> {
    const mockedModules = await getFilesFromDirectory(automockDir);

    return mockedModules.map(filePath => {
        const extName = path.extname(filePath);

        return {
            fullPath: filePath,
            moduleName: filePath.slice(automockDir.length + 1, -extName.length),
        };
    });
}

async function getFilesFromDirectory(dir: string): Promise<string[]> {
    const isDirExists = await fs.access(dir).then(
        () => true,
        () => false,
    );

    if (!isDirExists) {
        return [];
    }

    const files = await fs.readdir(dir);
    const allFiles = await Promise.all(
        files.map(async (file: string): Promise<string | string[]> => {
            const filePath = path.join(dir, file);
            const stats = await fs.stat(filePath);

            return stats.isDirectory() ? getFilesFromDirectory(filePath) : filePath;
        }),
    );

    return _.flatten(allFiles).filter(Boolean) as string[];
}
