import fs from "fs";

export const exists = async (path: string): Promise<boolean> => {
    try {
        await fs.promises.access(path);
        return true;
    } catch (_) {
        return false;
    }
};
