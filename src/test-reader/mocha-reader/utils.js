// When using "exports" mocha interface, "file" field is absent on suites, and available on tests only.
// This helper tries to resolve "file" field for suites, drilling down to child tests and using their file field.

const findTopmostSuite = mochaSuite => {
    if (mochaSuite.parent && mochaSuite.parent.root) {
        return mochaSuite;
    }

    if (!mochaSuite.parent) {
        return null;
    }

    return findTopmostSuite(mochaSuite.parent);
};

const getFile = mochaSuite => {
    if (mochaSuite.file) {
        return mochaSuite.file;
    }

    if (mochaSuite.tests.length > 0 && mochaSuite.tests[0].file) {
        return mochaSuite.tests[0].file;
    }

    for (const childSuite of mochaSuite.suites) {
        const computedFile = getFile(childSuite);
        if (computedFile) {
            return computedFile;
        }
    }

    return null;
};

const fillSuitesFileField = (mochaSuite, file) => {
    mochaSuite.file = file;

    if (mochaSuite.suites) {
        for (const childSuite of mochaSuite.suites) {
            fillSuitesFileField(childSuite, file);
        }
    }
};

const computeFile = mochaSuite => {
    if (mochaSuite.file) {
        return mochaSuite.file;
    }

    const topmostSuite = findTopmostSuite(mochaSuite);
    const file = topmostSuite && getFile(topmostSuite);

    if (topmostSuite && file) {
        fillSuitesFileField(topmostSuite, file);

        return file;
    }

    return null;
};

const getMethodsByInterface = (mochaInterface = "bdd") => {
    switch (mochaInterface) {
        case "tdd":
        case "qunit":
            return { suiteMethods: ["suite"], testMethods: ["test"] };
        case "bdd":
        default:
            return { suiteMethods: ["describe", "context"], testMethods: ["it", "specify"] };
    }
};

module.exports = {
    computeFile,
    getMethodsByInterface,
};
