/* global process, __dirname */
const path = require("path");
const browserify = require("browserify");
const uglifyify = require("uglifyify");
const aliasify = require("aliasify");
const fs = require("fs-extra");

/**
 * @param {object} opts
 * @param {boolean} opts.needsCompatLib
 * @returns {Promise<Buffer>}
 */
const bundleScript = async opts => {
    const lib = opts.needsCompatLib ? "./lib.compat.js" : "./lib.native.js";
    const script = browserify({
        entries: "./index.js",
        basedir: __dirname
    });

    script.transform(
        {
            sourcemap: false,
            global: true,
            compress: false, // { screw_ie8: false }, // eslint-disable-line camelcase
            mangle: false, // { screw_ie8: false }, // eslint-disable-line camelcase
            output: { screw_ie8: false } // eslint-disable-line camelcase
        },
        uglifyify
    );

    script.transform(
        {
            aliases: {
                "./lib": { relative: lib }
            },
            verbose: false
        },
        aliasify
    );

    return new Promise((resolve, reject) => {
        script.bundle((err, buffer) => {
            if (err) {
                reject(err);
            }

            resolve(buffer);
        });
    });
};

async function main() {
    const targetDir = path.join("build", path.relative(process.cwd(), __dirname));

    await fs.ensureDir(targetDir);

    await Promise.all(
        [
            { needsCompatLib: true, fileName: "bundle.compat.js" },
            { needsCompatLib: false, fileName: "bundle.native.js" }
        ].map(async ({ needsCompatLib, fileName }) => {
            const buffer = await bundleScript({ needsCompatLib });
            const filePath = path.join(targetDir, fileName);

            await fs.writeFile(filePath, buffer);
        })
    );
}

module.exports = main();
