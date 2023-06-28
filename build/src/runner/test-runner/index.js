"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.create = void 0;
const skipped_test_runner_1 = __importDefault(require("./skipped-test-runner"));
const insistant_test_runner_1 = __importDefault(require("./insistant-test-runner"));
const create = function (test, config, browserAgent) {
    return test.pending || test.disabled
        ? skipped_test_runner_1.default.create(test)
        : insistant_test_runner_1.default.create(test, config, browserAgent);
};
exports.create = create;
//# sourceMappingURL=index.js.map