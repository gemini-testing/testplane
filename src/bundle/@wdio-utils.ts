/* eslint-disable @typescript-eslint/no-var-requires */
const bundle = require("./cjs");

export const sessionEnvironmentDetector: typeof import("@wdio/utils").sessionEnvironmentDetector =
    bundle.wdioUtils.sessionEnvironmentDetector;
