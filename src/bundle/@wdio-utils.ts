/* eslint-disable @typescript-eslint/no-var-requires */
const bundle = require("./cjs");

export const sessionEnvironmentDetector: typeof import("@wdio/utils-cjs").sessionEnvironmentDetector =
    bundle.wdioUtils.sessionEnvironmentDetector;
