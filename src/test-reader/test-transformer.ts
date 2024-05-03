/* eslint-disable @typescript-eslint/no-var-requires */

// TODO: use import instead require. Currently require is used because ts build filed from bundle folder even if it excluded in tsconfig
export const setupTransformHook: (opts?: { removeNonJsImports?: boolean }) => VoidFunction =
    require("../bundle").setupTransformHook;
export const TRANSFORM_EXTENSIONS: string[] = require("../bundle").TRANSFORM_EXTENSIONS;
