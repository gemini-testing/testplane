import path from "node:path";
import Promise from "bluebird";
import browserify from "browserify";
import ClientBridge from "./client-bridge.js";

export { ClientBridge };

export const build = (browser, opts = {}) => {
    const script = browserify({
        entries: "./index",
        basedir: path.join(__dirname, "..", "client-scripts"),
    });

    script.transform(
        {
            sourcemap: false,
            global: true,
            compress: { screw_ie8: false }, // eslint-disable-line camelcase
            mangle: { screw_ie8: false }, // eslint-disable-line camelcase
            output: { screw_ie8: false }, // eslint-disable-line camelcase
        },
        "uglifyify",
    );

    const lib = opts.calibration && opts.calibration.needsCompatLib ? "./lib.compat.js" : "./lib.native.js";
    const ignoreAreas = opts.supportDeprecated ? "./ignore-areas.deprecated.js" : "./ignore-areas.js";

    script.transform(
        {
            aliases: {
                "./lib": { relative: lib },
                "./ignore-areas": { relative: ignoreAreas },
            },
            verbose: false,
        },
        "aliasify",
    );

    return Promise.fromCallback(cb => script.bundle(cb)).then(buf => {
        const scripts = buf.toString();

        return ClientBridge.create(browser, scripts);
    });
};
