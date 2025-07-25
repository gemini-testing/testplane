import fs from "fs/promises";
import path from "path";

export const getFirefoxCSPAddOn = async (): Promise<string> => {
    const extension = await fs.readFile(path.join(__dirname, "../../../assets/csp-bypass@testplane.io.xpi"));
    return extension.toString("base64");
};
