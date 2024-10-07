import path from "path";
import { exists } from "./fs";

export const requireModule = async <T = unknown>(modulePath: string): Promise<T> => {
    const isModuleLocal = await exists(modulePath);

    return require(isModuleLocal ? path.resolve(modulePath) : modulePath);
};

export const requireModuleSync = (modulePath: string): unknown => {
    return require(modulePath);
};
