/*
MIT License

Copyright (c) 2023 Mohammad Bagher Abiat

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

import { join, resolve } from "node:path";
import { builtinModules } from "node:module";
import { resolve as resolveExports } from "resolve.exports";
import { loadPackageJSON, resolveModule } from "local-pkg";

// Just copy-pasted from https://github.com/Aslemammad/modern-node-polyfills to avoid potential errors
export const polyfillPath = async (moduleName: string): Promise<string> => {
    if (moduleName.startsWith("node:")) {
        moduleName = moduleName.replace("node:", "");
    }

    if (!builtinModules.includes(moduleName))
        throw new Error(`Node.js does not have ${moduleName} in its builtin modules`);

    const jspmPath = resolve(
        require.resolve(`@jspm/core/nodelibs/${moduleName}`),
        // ensure "fs/promises" is resolved properly
        "../../.." + (moduleName.includes("/") ? "/.." : ""),
    );
    const jspmPackageJson = await loadPackageJSON(jspmPath);
    const exportPath = resolveExports(jspmPackageJson, `./nodelibs/${moduleName}`, {
        browser: true,
    });

    const exportFullPath = resolveModule(join(jspmPath, exportPath?.[0] || ""));

    if (!exportPath || !exportFullPath) {
        throw new Error("resolving failed");
    }
    return exportFullPath;
};
