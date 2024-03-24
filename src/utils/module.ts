import path from "node:path";
import { exists } from "./fs.js";

export const requireModule = async <T = unknown>(modulePath: string): Promise<T> => {
    const isModuleLocal = await exists(modulePath);

    return require(isModuleLocal ? path.resolve(modulePath) : modulePath);
};
