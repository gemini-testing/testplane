import fs from "node:fs";
import path from "node:path";
import { URL } from "node:url";
import type { ProfilerError, ProfilerResultV1 } from "./schema";

const MAX_STRING_LENGTH = 2000;
const SECRET_PATTERN_FLAGS = "giu";
const DEFAULT_IGNORABLE = String.raw`\p{Default_Ignorable_Code_Point}`;
const CREDENTIAL_SPACE = String.raw`[\s${DEFAULT_IGNORABLE}]`;
const CREDENTIAL_PUNCTUATION = String.raw`[\p{P}\p{S}]`;
const CREDENTIAL_BOUNDARY = String.raw`[\s\p{P}\p{S}${DEFAULT_IGNORABLE}]`;
const CREDENTIAL_SEPARATOR = String.raw`${CREDENTIAL_BOUNDARY}*[:=]${CREDENTIAL_SPACE}*`;
const CREDENTIAL_VALUE = String.raw`(?:${DEFAULT_IGNORABLE}|[^\s,;])+`;
const CREDENTIAL_SUFFIX = String.raw`(?:${CREDENTIAL_SEPARATOR}${CREDENTIAL_VALUE})?`;
const CREDENTIAL_DELIMITER = String.raw`(?:${CREDENTIAL_SEPARATOR}|${CREDENTIAL_SPACE}+)`;
const credentialWords = (...words: string[]): string =>
    words.map(word => [...word].join(`${DEFAULT_IGNORABLE}*`)).join("|");
const AUTHORIZATION = credentialWords("authorization");
const BEARER = credentialWords("bearer");
const COOKIE = credentialWords("cookie");
const PASSWORD = credentialWords("password");
const SECRET_OR_TOKEN = credentialWords("secret", "token");
const COOKIE_PAIR_START = String.raw`(?:${DEFAULT_IGNORABLE}|[^\s,;:=])+${CREDENTIAL_SPACE}*=`;
const COOKIE_HEADER_VALUE = String.raw`(?:${CREDENTIAL_SEPARATOR}|${CREDENTIAL_SPACE}+(?=${COOKIE_PAIR_START}))[^\r\n]+`;
const SECRET_PATTERNS = [
    new RegExp(String.raw`(${COOKIE})${COOKIE_HEADER_VALUE}`, SECRET_PATTERN_FLAGS),
    new RegExp(
        String.raw`(${AUTHORIZATION})${CREDENTIAL_DELIMITER}[^\r\n,;]+${CREDENTIAL_SUFFIX}`,
        SECRET_PATTERN_FLAGS,
    ),
    new RegExp(
        String.raw`\b(${BEARER})${CREDENTIAL_SPACE}+${CREDENTIAL_VALUE}${CREDENTIAL_SUFFIX}`,
        SECRET_PATTERN_FLAGS,
    ),
    new RegExp(
        String.raw`(${COOKIE}|${PASSWORD}|${SECRET_OR_TOKEN})${CREDENTIAL_DELIMITER}${CREDENTIAL_VALUE}${CREDENTIAL_SUFFIX}`,
        SECRET_PATTERN_FLAGS,
    ),
];
// Prose exceptions end only at whitespace, string end, or closing punctuation.
// A following credential separator always wins.
const DISPLAY_PROSE_END = String.raw`(?!${CREDENTIAL_SEPARATOR})(?=$|${CREDENTIAL_SPACE}|${CREDENTIAL_PUNCTUATION}+(?=${CREDENTIAL_SPACE}|$))`;
const REQUIREMENT_ROOT = credentialWords("requirement");
const REQUIREMENT = String.raw`${REQUIREMENT_ROOT}(?:${DEFAULT_IGNORABLE}*s)?(?!${DEFAULT_IGNORABLE}*s)`;
const LENGTH = credentialWords("length");
const OF = credentialWords("of");
const DISPLAY_SECRET_PATTERNS = [
    new RegExp(String.raw`(${COOKIE})${COOKIE_HEADER_VALUE}`, SECRET_PATTERN_FLAGS),
    new RegExp(
        String.raw`(${AUTHORIZATION})${CREDENTIAL_SEPARATOR}[^\r\n,;]+${CREDENTIAL_SUFFIX}`,
        SECRET_PATTERN_FLAGS,
    ),
    new RegExp(
        String.raw`(${AUTHORIZATION})${CREDENTIAL_SPACE}+(?!(?:${REQUIREMENT})${DISPLAY_PROSE_END})[^\r\n,;]+${CREDENTIAL_SUFFIX}`,
        SECRET_PATTERN_FLAGS,
    ),
    new RegExp(
        String.raw`\b(${BEARER})${CREDENTIAL_SPACE}+(?!(?:${OF})${DISPLAY_PROSE_END})${CREDENTIAL_VALUE}${CREDENTIAL_SUFFIX}`,
        SECRET_PATTERN_FLAGS,
    ),
    new RegExp(
        String.raw`(${COOKIE}|${PASSWORD}|${SECRET_OR_TOKEN})${CREDENTIAL_SEPARATOR}${CREDENTIAL_VALUE}${CREDENTIAL_SUFFIX}`,
        SECRET_PATTERN_FLAGS,
    ),
    new RegExp(
        String.raw`(${COOKIE}|${SECRET_OR_TOKEN})${CREDENTIAL_SPACE}+${CREDENTIAL_VALUE}${CREDENTIAL_SUFFIX}`,
        SECRET_PATTERN_FLAGS,
    ),
    new RegExp(
        String.raw`(${PASSWORD})${CREDENTIAL_SPACE}+(?!(?:${REQUIREMENT}|${LENGTH})${DISPLAY_PROSE_END})${CREDENTIAL_VALUE}${CREDENTIAL_SUFFIX}`,
        SECRET_PATTERN_FLAGS,
    ),
];

export class ProfilerSanitizer {
    readonly projectRoot: string;

    constructor(projectRoot = process.cwd()) {
        this.projectRoot = safeRealpath(projectRoot);
    }

    path(value: string): string {
        if (typeof value !== "string" || !value) {
            return "<unknown>";
        }
        const realPath = safeRealpath(value);
        const relative = path.relative(this.projectRoot, realPath);

        if (relative && !relative.startsWith("..") && !path.isAbsolute(relative)) {
            return toPosix(relative);
        }
        if (!relative) {
            return ".";
        }

        const packageMatch = realPath.match(/[\\/]node_modules[\\/]((?:@[^\\/]+[\\/])?[^\\/]+)/);
        return `<external>/${packageMatch?.[1]?.replace(/\\/g, "/") ?? path.basename(realPath)}`;
    }

    url(value: string): string {
        try {
            const parsed = new URL(value);
            parsed.username = "";
            parsed.password = "";
            parsed.search = "";
            parsed.hash = "";
            return parsed.toString();
        } catch {
            return "<invalid-url>";
        }
    }

    string(value: string): string {
        return redactSecrets(value, SECRET_PATTERNS).slice(0, MAX_STRING_LENGTH);
    }

    error(stage: string, error: unknown): ProfilerError {
        const typed = error as { code?: unknown; message?: unknown };
        return {
            stage: this.string(stage).slice(0, 200),
            code: typeof typed?.code === "string" ? this.string(typed.code).slice(0, 100) : undefined,
            message: this.embedded(String(typed?.message ?? error)).slice(0, 1000),
        };
    }

    embedded(value: string): string {
        const withoutUrlSecrets = value.replace(/https?:\/\/[^\s"'<>]+/gi, match => this.url(match));
        return this.string(withoutUrlSecrets).replace(/(?<![:/])\/(?:[^\s"'<>/]+\/)+[^\s"'<>:,;\])}]+/g, match =>
            this.path(match),
        );
    }

    sanitizeResult(result: ProfilerResultV1): ProfilerResultV1 {
        const seen = new WeakSet<object>();
        return this._walk(result, seen) as ProfilerResultV1;
    }

    freezeResult(result: ProfilerResultV1): Readonly<ProfilerResultV1> {
        return deepFreeze(result);
    }

    private _walk(value: unknown, seen: WeakSet<object>): unknown {
        if (value === null || typeof value === "boolean") {
            return value;
        }
        if (typeof value === "string") {
            return this.string(value);
        }
        if (typeof value === "number") {
            return Number.isFinite(value) ? value : null;
        }
        if (typeof value !== "object") {
            return;
        }
        if (seen.has(value)) {
            return;
        }

        seen.add(value);
        if (Array.isArray(value)) {
            const result = value.map(item => this._walk(item, seen)).filter(item => item !== undefined);
            seen.delete(value);
            return result;
        }

        const prototype = Object.getPrototypeOf(value);
        if (prototype !== Object.prototype && prototype !== null) {
            seen.delete(value);
            return;
        }

        const result: Record<string, unknown> = {};
        for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(value))) {
            if (!("value" in descriptor)) {
                continue;
            }
            const child = this._walkProperty(key, descriptor.value, seen);
            if (child !== undefined) {
                result[this.string(key).slice(0, 200)] = child;
            }
        }
        seen.delete(value);
        return result;
    }

    private _walkProperty(key: string, value: unknown, seen: WeakSet<object>): unknown {
        if (/^entityIds$/i.test(key) && Array.isArray(value)) {
            return value
                .filter((item): item is string => typeof item === "string")
                .map(item => this._displayString(item));
        }
        if (typeof value === "string") {
            if (/^(name|observation)$/i.test(key)) {
                return this._displayString(value);
            }
            if (/^(file|path|ownerFile|sourceFile|plugin)$/i.test(key)) {
                return this.path(value);
            }
            if (/url$/i.test(key)) {
                return this.url(value);
            }
            if (/message$/i.test(key)) {
                return this.embedded(value);
            }
        }
        return this._walk(value, seen);
    }

    private _displayString(value: string): string {
        return redactSecrets(value, DISPLAY_SECRET_PATTERNS).slice(0, MAX_STRING_LENGTH);
    }
}

function redactSecrets(value: string, patterns: RegExp[]): string {
    return patterns.reduce((result, pattern) => result.replace(pattern, "$1=<redacted>"), value);
}

function safeRealpath(value: string): string {
    try {
        return fs.realpathSync.native(path.resolve(value));
    } catch {
        return path.resolve(value);
    }
}

function toPosix(value: string): string {
    return value.split(path.sep).join("/");
}

function deepFreeze<T>(value: T): Readonly<T> {
    if (value && typeof value === "object" && !Object.isFrozen(value)) {
        Object.freeze(value);
        for (const child of Object.values(value)) {
            deepFreeze(child);
        }
    }

    return value;
}
