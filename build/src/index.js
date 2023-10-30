"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = void 0;
// Declares global hooks
require("../typings/global");
// Augments browser and element methods
require("./browser/types");
// Declares global expect function
require("expect-webdriverio");
var hermione_1 = require("./hermione");
Object.defineProperty(exports, "default", { enumerable: true, get: function () { return hermione_1.Hermione; } });
//# sourceMappingURL=index.js.map