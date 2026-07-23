import fs from "node:fs/promises";
import path from "node:path";
import type { ProfilerResultV1 } from "../schema";

export const writeProfilerJson = async (
    outputPath: string,
    result: Readonly<ProfilerResultV1>,
    cwd = process.cwd(),
): Promise<void> => {
    const destination = path.resolve(cwd, outputPath);
    const directory = path.dirname(destination);
    const temporary = path.join(directory, `.${path.basename(destination)}.${result.run.id}.tmp`);

    await fs.mkdir(directory, { recursive: true });
    try {
        await fs.writeFile(temporary, `${JSON.stringify(result, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
        await fs.rename(temporary, destination);
    } catch (error) {
        await fs.rm(temporary, { force: true }).catch(() => undefined);
        throw error;
    }
};
