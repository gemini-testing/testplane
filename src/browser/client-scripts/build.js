const path = require("path");
const childProcess = require("node:child_process");
const browserify = require("browserify");
const uglifyify = require("uglifyify");
const aliasify = require("aliasify");
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
 * @param {boolean} opts.needsCompatLib
 * @param {string} opts.entryFilePath
 * @param {string} opts.libPath
 * @returns {Promise<Buffer>}
 */
const bundleScript = async opts => {
    const basedir = path.dirname(opts.entryFilePath);

    const script = browserify({
        entries: [opts.entryFilePath],
        basedir
    });

    script.transform(
        {
            sourcemap: false,
            global: true,
            compress: { screw_ie8: false }, // eslint-disable-line camelcase
            mangle: { screw_ie8: false }, // eslint-disable-line camelcase
            output: { screw_ie8: false } // eslint-disable-line camelcase
        },
        uglifyify
    );

    script.transform(
        {
            aliases: {
                "@lib": opts.libPath,
                "@isomorphic": opts.isomorphicPath
            },
            verbose: false
        },
        aliasify
    );

    return new Promise((resolve, reject) => {
        script.bundle((err, buffer) => {
            if (err) {
                console.error(err);
                reject(err);
            }

            const resultingScript = `(function (__geminiNamespace) { ${buffer.toString()} })(arguments[0])`;

            resolve(resultingScript);
        });
    });
};

async function main() {
    const targetDir = path.resolve(process.argv[2]);

    if (!(await fs.pathExists(targetDir))) {
        throw new Error(`Target directory does not exist: ${targetDir}`);
    }

    const tscOutDir = path.join(targetDir, "tsc-out");

    const compatLibPath =
        "./" + path.relative(process.cwd(), path.join(tscOutDir, "client-scripts", "shared", "lib.compat.js"));
    const nativeLibPath =
        "./" + path.relative(process.cwd(), path.join(tscOutDir, "client-scripts", "shared", "lib.native.js"));

    await Promise.all(
        [
            { needsCompatLib: true, fileName: "bundle.compat.js", libPath: compatLibPath },
            { needsCompatLib: false, fileName: "bundle.native.js", libPath: nativeLibPath }
        ].map(async ({ needsCompatLib, fileName, libPath }) => {
            await compileTypescript(targetDir, needsCompatLib ? "tsconfig.compat.json" : "tsconfig.json");

            const projectDirName = path.basename(targetDir);
            const entryFilePath = path.join(tscOutDir, "client-scripts", projectDirName, "inject.js");
            const isomorphicPath = path.join(tscOutDir, "isomorphic", "index.js");
            const buffer = await bundleScript({ needsCompatLib, entryFilePath, libPath, isomorphicPath });

            const buildDir = path.join(targetDir, "build");
            await fs.ensureDir(buildDir);
            const filePath = path.join(buildDir, fileName);

            await fs.writeFile(filePath, buffer);
        })
    );
}

module.exports = main();
