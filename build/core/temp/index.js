'use strict';
const temp = require('temp');
const path = require('path');
const _ = require('lodash');
temp.track();
class Temp {
    constructor(dir, opts = {}) {
        this._tempDir = opts.attach
            ? dir
            : temp.mkdirSync({
                dir: dir && path.resolve(dir),
                prefix: '.screenshots.tmp.'
            });
    }
    path(opts = {}) {
        return temp.path(_.extend(opts, {
            dir: this._tempDir
        }));
    }
    serialize() {
        return { dir: this._tempDir };
    }
}
let tempInstance;
module.exports = {
    init: (dir) => {
        if (!tempInstance) {
            tempInstance = new Temp(dir);
        }
    },
    attach: (serializedTemp) => {
        if (!tempInstance) {
            tempInstance = new Temp(serializedTemp.dir, { attach: true });
        }
    },
    path: (opts) => tempInstance.path(opts),
    serialize: () => tempInstance.serialize()
};
