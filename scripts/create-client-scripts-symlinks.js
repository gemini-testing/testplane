#!/usr/bin/env node

/**
 * Creates symlinks from src/browser/client-scripts to built bundle files.
 * This allows to run TypeScript code, for example, in integration tests.
 */

const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const srcDir = path.join(rootDir, "src", "browser", "client-scripts");
const buildDir = path.join(rootDir, "build", "src", "browser", "client-scripts");
const files = ["bundle.native.js", "bundle.compat.js"];

files.forEach(file => {
    const srcPath = path.join(srcDir, file);
    const targetPath = path.join(buildDir, file);

    try {
        const relativePath = path.relative(srcDir, targetPath);
        fs.symlinkSync(relativePath, srcPath);

        console.log(`Created symlink: ${srcPath} -> ${relativePath}`);
    } catch (error) {
        console.warn(`Failed to create symlink for ${file}: ${error.message}`);
    }
});
