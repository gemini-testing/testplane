"use strict";

const { readFile } = require("node:fs/promises");
const path = require("node:path");
const { compileFunction } = require("node:vm");
const { fileURLToPath, pathToFileURL } = require("node:url");
const { Suite } = require("mocha");
// Our CommonJS build lowers import() to require(); use Mocha's untranspiled native import.
const { doImport, requireOrImport } = require("mocha/lib/nodejs/esm-utils.cjs");
const { loadPackageJSON } = require("local-pkg");

const { EVENT_FILE_PRE_REQUIRE, EVENT_FILE_REQUIRE, EVENT_FILE_POST_REQUIRE } = Suite.constants;

function canResolveWithRequire(error) {
    switch (error?.code) {
        case "ERR_MODULE_NOT_FOUND":
        case "ERR_UNSUPPORTED_DIR_IMPORT":
            try {
                return Boolean(require.resolve(fileURLToPath(error.url)));
            } catch {
                return false;
            }
        case "ERR_UNKNOWN_FILE_EXTENSION": {
            // Node exposes the extension in the diagnostic, but not as a separate property.
            const extension = /^Unknown file extension "([^"]+)" for /.exec(error.message)?.[1];
            return Boolean(extension && require.extensions[extension]);
        }
        default:
            return false;
    }
}

async function failedDuringLinking(url, originalError) {
    // A missing named export prevents evaluation, but only after Node resolves all static imports.
    // A linking failure is reproduced; a runtime error (including dynamic import) is not.
    const probe = `import { missing } from "data:text/javascript,"; import ${JSON.stringify(url)};`;
    try {
        await doImport(`data:text/javascript,${encodeURIComponent(probe)}`);
    } catch (error) {
        return error?.code === originalError.code && error.message === originalError.message;
    }
    return false;
}

async function parsesAsCommonJS(file) {
    const source = await readFile(file, "utf8");
    try {
        // For an ambiguous .js, Node detects ESM syntax that cannot parse inside its CommonJS wrapper.
        // Compile without executing so hooks/profiling still see a normal require for CommonJS tests.
        compileFunction(source, ["exports", "require", "module", "__filename", "__dirname"]);
        return true;
    } catch (error) {
        if (!(error instanceof SyntaxError)) {
            throw error;
        }
        return false;
    }
}

async function loadFile(file, esmDecorator, packageTypes) {
    if (path.extname(file) !== ".js") {
        // Mocha imports .mjs natively and honours require hooks for TypeScript and custom extensions.
        return requireOrImport(file, esmDecorator);
    }

    const directory = path.dirname(require.resolve(file));
    if (!packageTypes.has(directory)) {
        packageTypes.set(directory, (await loadPackageJSON(directory))?.type);
    }
    const type = packageTypes.get(directory);
    if (type === "commonjs" || (type !== "module" && (await parsesAsCommonJS(file)))) {
        return requireOrImport(file, esmDecorator);
    }

    // Mocha 12 tries require(esm) first for .js, bypassing the decorated URL and import conditions.
    const url = esmDecorator(pathToFileURL(file));
    try {
        const namespace = await doImport(url);
        return namespace.default ?? namespace;
    } catch (error) {
        if (!canResolveWithRequire(error) || !(await failedDuringLinking(url, error))) {
            throw error;
        }

        // Static imports such as "./helper" or "./style.css" may need the installed CommonJS hooks.
        return require(file);
    }
}

async function loadFiles(mocha, esmDecorator) {
    const packageTypes = new Map();
    mocha.lazyLoadFiles(true);
    for (const file of mocha.files) {
        mocha.suite.emit(EVENT_FILE_PRE_REQUIRE, global, file, mocha);
        const testModule = await loadFile(path.resolve(file), esmDecorator, packageTypes);
        mocha.suite.emit(EVENT_FILE_REQUIRE, testModule, file, mocha);
        mocha.suite.emit(EVENT_FILE_POST_REQUIRE, global, file, mocha);
    }
}

module.exports = { loadFiles };
