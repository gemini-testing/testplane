import crypto from "node:crypto";

export const getShortMD5 = str => crypto.createHash("md5").update(str, "ascii").digest("hex").substr(0, 7);
