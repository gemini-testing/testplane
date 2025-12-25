/*
    This functional with global determines if it's running in a browser launched from beforeAll/afterAll hooks.
    In this case, it does not delete the state file and passes it to a global variable for Testplane to clean up after all tests and hooks.
 */

const TESTPLANE_FILES_TO_REMOVE = Symbol.for("testplaneFilesToRemove");

type TestplaneGlobal = typeof globalThis & {
    [TESTPLANE_FILES_TO_REMOVE]?: string[];
};

export const initGlobalFilesToRemove = (): void => {
    (global as TestplaneGlobal)[TESTPLANE_FILES_TO_REMOVE] = [];
};

export const hasGlobalFilesToRemove = (): boolean =>
    Array.isArray((global as TestplaneGlobal)[TESTPLANE_FILES_TO_REMOVE]);

export const getGlobalFilesToRemove = (): string[] => (global as TestplaneGlobal)[TESTPLANE_FILES_TO_REMOVE] || [];

export const addGlobalFileToRemove = (path: string): void => {
    const filesToRemove = (global as TestplaneGlobal)[TESTPLANE_FILES_TO_REMOVE];

    if (filesToRemove) {
        filesToRemove.push(path);
    }
};
