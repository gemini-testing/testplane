const path = require('path');
const fs = require('fs-extra');
exports.initInformer = async (opts) => {
    if (opts.path) {
        await fs.ensureDir(path.dirname(opts.path));
    }
    const informerType = opts.path ? 'file' : 'console';
    return require(`./${informerType}`).create(opts);
};
