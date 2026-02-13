"use strict";

const crypto = require("crypto");

exports.getMD5 = str => crypto.createHash("md5").update(str, "ascii").digest("hex");
exports.getShortMD5 = str => exports.getMD5(str).substr(0, 7);
