/* eslint-disable @typescript-eslint/no-var-requires */
// TODO: use import instead require. Currently require is used because ts build filed from bundle folder even if it excluded in tsconfig
const bundle = require("./cjs");

export const setupTransformHook: (opts?: { removeNonJsImports?: boolean }) => VoidFunction = bundle.setupTransformHook;
export const TRANSFORM_EXTENSIONS: string[] = bundle.TRANSFORM_EXTENSIONS;
