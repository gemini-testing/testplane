import fs from "fs";
import { fileURLToPath } from "url";

export const exists = async (path: string): Promise<boolean> => {
    try {
        await fs.promises.access(path);
        return true;
    } catch (_) {
        return false;
    }
};

export const softFileURLToPath = (fileName: string): string => {
    if (!fileName.startsWith("file://")) {
        return fileName;
    }

    try {
        return fileURLToPath(fileName);
    } catch (_) {
        return fileName;
    }
};
