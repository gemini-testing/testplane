/// <reference types="node" />
export = FileInformer;
declare class FileInformer extends BaseInformer {
    constructor(opts: any);
    _fileStream: fs.WriteStream;
    _reporterType: any;
    log(message: any): void;
    warn(message: any): void;
    error(message: any): void;
    end(message: any): void;
    _prepareMsg(msg: any): string;
}
import BaseInformer = require("./base");
import fs = require("fs");
