const TESTPLANE_FILES_TO_REMOVE = Symbol.for("testplaneFilesToRemove");

type TestplanaGlobal = typeof globalThis & {
    [TESTPLANE_FILES_TO_REMOVE]?: string[];
};

export const initGlobalFilesToRemove = (): void => {
    (global as TestplanaGlobal)[TESTPLANE_FILES_TO_REMOVE] = [];
};

export const useGlobalFilesToRemove = (): boolean =>
    Array.isArray((global as TestplanaGlobal)[TESTPLANE_FILES_TO_REMOVE]);

export const getGlobalFilesToRemove = (): string[] => (global as TestplanaGlobal)[TESTPLANE_FILES_TO_REMOVE] || [];

export const addGlobalFileToRemove = (path: string): void => {
    const filesToRemove = (global as TestplanaGlobal)[TESTPLANE_FILES_TO_REMOVE];

    if (filesToRemove) {
        filesToRemove.push(path);
    }
};
