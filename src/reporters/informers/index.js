import path from "node:path";
import fs from "fs-extra";

export const initInformer = async opts => {
    if (opts.path) {
        await fs.ensureDir(path.dirname(opts.path));
    }

    const informerType = opts.path ? "file" : "console";

    return await import(`./${informerType}.js`).create(opts);
};
