/* eslint-disable @typescript-eslint/no-var-requires */
const bundle = require("./cjs");

export const expandPaths: typeof import("glob-extra").expandPaths = bundle.globExtra.expandPaths;
export const isMask: typeof import("glob-extra").isMask = bundle.globExtra.isMask;
export type { GlobOpts, ExpandOpts } from "glob-extra";
