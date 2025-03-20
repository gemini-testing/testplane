"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TRANSFORM_EXTENSIONS = exports.setupTransformHook = void 0;
/* eslint-disable @typescript-eslint/no-var-requires */
// TODO: use import instead require. Currently require is used because ts build filed from bundle folder even if it excluded in tsconfig
const bundle = require("./cjs");
exports.setupTransformHook = bundle.setupTransformHook;
exports.TRANSFORM_EXTENSIONS = bundle.TRANSFORM_EXTENSIONS;
//# sourceMappingURL=test-transformer.js.map