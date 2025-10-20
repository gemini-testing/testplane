import crypto from "node:crypto";
import fs from "node:fs";

export class FileHashProvider {
    private static readonly _hashStore: Map<string, Promise<string>> = new Map();

    async calculateFor(filePath: string): Promise<string> {
        const cachedHash = FileHashProvider._hashStore.get(filePath);

        if (cachedHash) {
            return cachedHash;
        }

        const hash = new Promise<string>((resolve, reject) => {
            const hash = crypto.createHash("md5");
            const fileReadStream = fs.createReadStream(filePath);

            fileReadStream.on("data", chunk => hash.update(chunk));
            fileReadStream.on("end", () => resolve(hash.digest("hex")));
            fileReadStream.on("error", err =>
                reject(new Error(`Selectivity: Couldn't calculate hash for ${filePath}: ${err}`)),
            );
        });

        FileHashProvider._hashStore.set(filePath, hash);

        return hash;
    }
}
