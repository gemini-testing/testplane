"use strict";

module.exports = {
    recursive: true,
    extension: [".js", ".ts"],
    ignore: ["./test/browser-env/**", "**/report/**", "**/basic-report/**", "**/exit-on-error/fixtures/**"],
    require: ["./test/setup", "./test/assert-ext", "./test/ts-node", "tsconfig-paths/register"],
};
