"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.polyfillPath = void 0;
const node_path_1 = require("node:path");
const node_module_1 = require("node:module");
const resolve_exports_1 = require("resolve.exports");
const local_pkg_1 = require("local-pkg");
// Just copy-pasted from https://github.com/Aslemammad/modern-node-polyfills to avoid potential errors
const polyfillPath = async (moduleName) => {
    if (moduleName.startsWith("node:")) {
        moduleName = moduleName.replace("node:", "");
    }
    if (!node_module_1.builtinModules.includes(moduleName))
        throw new Error(`Node.js does not have ${moduleName} in its builtin modules`);
    const jspmPath = (0, node_path_1.resolve)(require.resolve(`@jspm/core/nodelibs/${moduleName}`), 
    // ensure "fs/promises" is resolved properly
    "../../.." + (moduleName.includes("/") ? "/.." : ""));
    const jspmPackageJson = await (0, local_pkg_1.loadPackageJSON)(jspmPath);
    const exportPath = (0, resolve_exports_1.resolve)(jspmPackageJson, `./nodelibs/${moduleName}`, {
        browser: true,
    });
    const exportFullPath = (0, local_pkg_1.resolveModule)((0, node_path_1.join)(jspmPath, exportPath?.[0] || ""));
    if (!exportPath || !exportFullPath) {
        throw new Error("resolving failed");
    }
    return exportFullPath;
};
exports.polyfillPath = polyfillPath;
//# sourceMappingURL=polyfill.js.map