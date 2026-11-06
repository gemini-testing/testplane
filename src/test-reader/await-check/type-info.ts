import path from "node:path";
import ts from "typescript";

export const extensions = new Set([".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx", ".mts", ".cts"]);

const defaults: ts.CompilerOptions = {
    allowJs: true,
    checkJs: false,
    noEmit: true,
    skipLibCheck: true,
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    types: [],
};

export function createSourceProgram(source: string, file: string): ts.Program {
    const options = { ...defaults, noLib: true, noResolve: true };
    const host = ts.createCompilerHost(options);
    const original = host.getSourceFile;
    host.getSourceFile = (name, languageVersion, onError, shouldCreateNewSourceFile): ts.SourceFile | undefined =>
        name === file
            ? ts.createSourceFile(file, source, languageVersion, true)
            : original(name, languageVersion, onError, shouldCreateNewSourceFile);
    return ts.createProgram([file], options, host);
}

export function groupByConfig(files: Iterable<string>): Map<string | undefined, string[]> {
    const groups = new Map<string | undefined, string[]>();
    for (const file of files) {
        const config = ts.findConfigFile(path.dirname(file), ts.sys.fileExists);
        const group = groups.get(config) ?? [];
        group.push(file);
        groups.set(config, group);
    }
    return groups;
}

export function createTypeProgram(files: string[], sources: Map<string, string>, config?: string): ts.Program {
    let options = defaults;
    let roots = files;
    if (config) {
        const read = ts.readConfigFile(config, ts.sys.readFile);
        if (read.error) throw new Error(ts.flattenDiagnosticMessageText(read.error.messageText, "\n"));
        const parsed = ts.parseJsonConfigFileContent(read.config, ts.sys, path.dirname(config), undefined, config);
        // An empty include is harmless: selected tests are explicit roots.
        const error = parsed.errors.find(d => d.code !== 18003);
        if (error) throw new Error(ts.flattenDiagnosticMessageText(error.messageText, "\n"));
        options = { ...defaults, ...parsed.options, allowJs: true, noEmit: true, skipLibCheck: true };
        roots = [...new Set([...files, ...parsed.fileNames])];
    }
    const host = ts.createCompilerHost(options);
    const readFile = host.readFile;
    host.readFile = (file): string | undefined => sources.get(file) ?? readFile(file);
    return ts.createProgram(roots, options, host);
}

export function isPromiseType(checker: ts.TypeChecker, type: ts.Type, node: ts.Node): boolean {
    if ([ts.TypeFlags.Any, ts.TypeFlags.Unknown].includes(type.flags)) return false;
    if (type.isUnion()) return type.types.some(t => isPromiseType(checker, t, node));
    const then = type.getProperty("then");
    return Boolean(
        then &&
        checker.getSignaturesOfType(checker.getTypeOfSymbolAtLocation(then, node), ts.SignatureKind.Call).length,
    );
}

export function isArrayType(checker: ts.TypeChecker, node: ts.Node): boolean {
    const type = checker.getTypeAtLocation(node);
    return checker.isArrayType(type) || checker.isTupleType(type);
}

export function returnsPromise(checker: ts.TypeChecker, node: ts.CallExpression): boolean {
    return isPromiseType(checker, checker.getTypeAtLocation(node), node);
}

export function returnsPromiseArray(checker: ts.TypeChecker, node: ts.CallExpression): boolean {
    const type = checker.getTypeAtLocation(node);
    const item = checker.getIndexTypeOfType(type, ts.IndexKind.Number);
    return Boolean(item && isPromiseType(checker, item, node));
}
