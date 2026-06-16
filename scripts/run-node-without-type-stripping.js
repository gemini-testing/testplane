"use strict";

const { spawnSync } = require("node:child_process");

const DISABLE_TYPE_STRIPPING_FLAG = "--no-experimental-strip-types";

const supportsDisableTypeStripping = () => {
    const result = spawnSync(process.execPath, [DISABLE_TYPE_STRIPPING_FLAG, "-e", ""], {
        stdio: "ignore",
    });

    return result.status === 0;
};

const nodeArgs = supportsDisableTypeStripping() ? [DISABLE_TYPE_STRIPPING_FLAG] : [];
const commandArgs = process.argv.slice(2);

const result = spawnSync(process.execPath, [...nodeArgs, ...commandArgs], {
    stdio: "inherit",
    env: process.env,
});

if (result.error) {
    throw result.error;
}

process.exit(result.status ?? 1);
