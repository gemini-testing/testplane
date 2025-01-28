"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.format = void 0;
const node_path_1 = __importDefault(require("node:path"));
const format = (testCollection) => {
    const allSuitesById = new Map();
    const allTestsById = new Map();
    testCollection.eachTest((test, browserId) => {
        if (test.disabled) {
            return;
        }
        if (allTestsById.has(test.id)) {
            const treeTest = allTestsById.get(test.id);
            if (!treeTest.browserIds.includes(browserId)) {
                treeTest.browserIds.push(browserId);
            }
            return;
        }
        const treeTest = createTreeTest(test, browserId);
        allTestsById.set(treeTest.id, treeTest);
        collectSuites(test.parent, treeTest, allSuitesById);
    });
    return getTreeRunnables(allSuitesById, allTestsById);
};
exports.format = format;
function collectSuites(suite, child, allSuitesById) {
    if (allSuitesById.has(suite.id)) {
        const treeSuite = allSuitesById.get(suite.id);
        addChild(treeSuite, child);
        return;
    }
    if (!suite.parent) {
        return;
    }
    const treeSuite = createTreeSuite(suite);
    addChild(treeSuite, child);
    allSuitesById.set(treeSuite.id, treeSuite);
    collectSuites(suite.parent, treeSuite, allSuitesById);
}
function isTreeTest(runnable) {
    return Boolean(runnable.browserIds);
}
function createTreeTest(test, browserId) {
    return {
        id: test.id,
        title: test.title,
        pending: test.pending,
        skipReason: test.skipReason,
        ...test.location,
        browserIds: [browserId],
        ...getMainRunanbleFields(test),
    };
}
function createTreeSuite(suite) {
    return {
        id: suite.id,
        title: suite.title,
        pending: suite.pending,
        skipReason: suite.skipReason,
        ...suite.location,
        ...getMainRunanbleFields(suite),
        suites: [],
        tests: [],
    };
}
function addChild(treeSuite, child) {
    const fieldName = isTreeTest(child) ? "tests" : "suites";
    const foundRunnable = treeSuite[fieldName].find(test => test.id === child.id);
    if (!foundRunnable) {
        isTreeTest(child) ? addTest(treeSuite, child) : addSuite(treeSuite, child);
    }
}
function addTest(treeSuite, child) {
    treeSuite.tests.push(child);
}
function addSuite(treeSuite, child) {
    treeSuite.suites.push(child);
}
function getMainRunanbleFields(runanble) {
    const isMain = runanble.parent && runanble.parent.root;
    return {
        // "file" field must exists only in topmost runnables
        ...(isMain ? { file: node_path_1.default.relative(process.cwd(), runanble.file) } : {}),
    };
}
function getTreeRunnables(allSuitesById, allTestsById) {
    return [...allSuitesById.values(), ...allTestsById.values()].filter(suite => suite.file);
}
//# sourceMappingURL=tree.js.map