const path = require("path");
const childProcess = require("node:child_process");
const esbuild = require("esbuild");
const swc = require("@swc/core");
const fs = require("fs-extra");

const compileTypescript = async (targetDir, tsConfigName = "tsconfig.json") => {
    const tsConfigPath = path.join(targetDir, tsConfigName);

    if (!(await fs.pathExists(tsConfigPath))) {
        throw new Error(`Could not find tsconfig: ${tsConfigPath}`);
    }

    childProcess.spawnSync(process.execPath, [require.resolve("typescript/bin/tsc"), "--project", tsConfigPath], {
        cwd: targetDir,
        stdio: "inherit"
    });
};

/**
 * @param {object} opts
 * @param {string} opts.entryFilePath
 * @param {string} opts.libPath
 * @param {string} opts.isomorphicPath
 * @param {boolean} opts.needsCompatLib
 * @returns {Promise<string>}
 */
const bundleScript = async opts => {
    const result = await esbuild.build({
        entryPoints: [opts.entryFilePath],
        alias: {
            "@lib": opts.libPath,
            "@isomorphic": opts.isomorphicPath
        },
        bundle: true,
        format: "iife",
        minify: true,
        platform: "browser",
        write: false
    });

    let bundledScript = result.outputFiles[0].text;

    if (opts.needsCompatLib) {
        const transformed = await swc.transform(bundledScript, {
            jsc: {
                parser: { syntax: "ecmascript" },
                target: "es5",
                minify: {
                    compress: true,
                    mangle: true
                }
            },
            minify: true
        });

        bundledScript = transformed.code;
    }

    return `(function (__geminiNamespace) { ${bundledScript} })(arguments[0])`;
};

async function main() {
    const targetDir = path.resolve(process.argv[2]);

    if (!(await fs.pathExists(targetDir))) {
        throw new Error(`Target directory does not exist: ${targetDir}`);
    }

    const tscOutDir = path.join(targetDir, "tsc-out");

    const compatLibPath = path.join(tscOutDir, "client-scripts", "shared", "lib.compat.js");
    const nativeLibPath = path.join(tscOutDir, "client-scripts", "shared", "lib.native.js");

    await Promise.all(
        [
            { needsCompatLib: true, fileName: "bundle.compat.js", libPath: compatLibPath },
            { needsCompatLib: false, fileName: "bundle.native.js", libPath: nativeLibPath }
        ].map(async ({ needsCompatLib, fileName, libPath }) => {
            await compileTypescript(targetDir, needsCompatLib ? "tsconfig.compat.json" : "tsconfig.json");

            const projectDirName = path.basename(targetDir);
            const entryFilePath = path.join(tscOutDir, "client-scripts", projectDirName, "inject.js");
            const isomorphicPath = path.join(tscOutDir, "isomorphic", "index.js");
            const buffer = await bundleScript({ entryFilePath, libPath, isomorphicPath, needsCompatLib });

            const buildDir = path.join(targetDir, "build");
            await fs.ensureDir(buildDir);
            const filePath = path.join(buildDir, fileName);

            await fs.writeFile(filePath, buffer);
        })
    );
}

module.exports = main();
