"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.format = void 0;
const node_path_1 = __importDefault(require("node:path"));
const format = (testCollection) => {
    const allTestsById = new Map();
    testCollection.eachTest((test, browserId) => {
        if (test.disabled) {
            return;
        }
        if (allTestsById.has(test.id)) {
            const foundTest = allTestsById.get(test.id);
            if (!foundTest.browserIds.includes(browserId)) {
                foundTest.browserIds.push(browserId);
            }
            return;
        }
        allTestsById.set(test.id, {
            id: test.id,
            titlePath: test.titlePath(),
            browserIds: [browserId],
            file: node_path_1.default.relative(process.cwd(), test.file),
            pending: test.pending,
            skipReason: test.skipReason,
        });
    });
    return [...allTestsById.values()];
};
exports.format = format;
//# sourceMappingURL=list.js.map