"use strict";
const fs = require("fs");
const chalk = require("chalk");
const BaseInformer = require("./base");
const logger = require("../../utils/logger");
module.exports = class FileInformer extends BaseInformer {
    constructor(opts) {
        super(opts);
        this._fileStream = fs.createWriteStream(opts.path);
        this._reporterType = opts.type;
        logger.log(`Information with test results for report: "${opts.type}" will be saved to a file: "${opts.path}"`);
    }
    log(message) {
        this._fileStream.write(`${this._prepareMsg(message)}\n`);
    }
    warn(message) {
        this.log(message);
    }
    error(message) {
        this.log(message);
    }
    end(message) {
        if (message) {
            this._fileStream.end(`${this._prepareMsg(message)}\n`);
        }
        else {
            this._fileStream.end();
        }
    }
    _prepareMsg(msg) {
        return typeof msg === "object" ? JSON.stringify(msg) : chalk.stripColor(msg);
    }
};
//# sourceMappingURL=file.js.map