"use strict";

const crypto = require("crypto");

exports.getShortMD5 = str => crypto.createHash("md5").update(str, "ascii").digest("hex").substr(0, 7);
